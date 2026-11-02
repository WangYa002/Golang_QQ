package storage

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"
)

/**
 * WebHDFS 客户端（REST）：无需 JVM/原生库，纯 HTTP 交互。
 *
 * HDFS 部署形态（compose）：namenode(9870 webhdfs) + datanode，
 * 服务器多实例部署时任意节点都能读写 HDFS，文件不再绑定单机磁盘。
 *
 * 两段式协议：首跳请求 NameNode → 307 重定向到 DataNode → 数据传输。
 * CREATE 首跳不带文件体；OPEN 跟随重定向得到数据流。
 */

type HdfsClient struct {
	BaseURL  string // NameNode WebHDFS，如 http://hdfs-nn:9870
	User     string
	BasePath string // 如 /golang-qq
	HTTP     *http.Client
}

func NewHdfsClient(baseURL, user, basePath string) *HdfsClient {
	return &HdfsClient{
		BaseURL:  strings.TrimRight(baseURL, "/"),
		User:     user,
		BasePath: "/" + strings.Trim(basePath, "/"),
		HTTP: &http.Client{
			Timeout: 30 * time.Minute,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse // 手动处理 NameNode → DataNode 重定向
			},
		},
	}
}

func (h *HdfsClient) fileURL(name string) string {
	// WebHDFS REST 路径前缀：/webhdfs/v1
	return fmt.Sprintf("%s/webhdfs/v1%s/files/%s", h.BaseURL, h.BasePath, url.PathEscape(name))
}

func (h *HdfsClient) opURL(path, query string) string {
	sep := "?"
	if strings.Contains(path, "?") {
		sep = "&"
	}
	u := path + sep + "user.name=" + url.QueryEscape(h.User)
	if query != "" {
		u += "&" + query
	}
	return u
}

// HdfsPutFile 将本地文件转存到 HDFS（overwrite 语义：同名覆盖）。
func (h *HdfsClient) PutFile(localPath, remoteName string) error {
	f, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return err
	}

	// 首跳：请求 NameNode 创建（不带数据），拿到 DataNode 重定向地址。
	// 注意：用空 reader 触发 Content-Length/Transfer-Encoding 头，
	// Jetty 对无长度信息的 PUT 会直接 405。
	req1, err := http.NewRequest(http.MethodPut, h.opURL(h.fileURL(remoteName), "op=CREATE&overwrite=true"), strings.NewReader(""))
	if err != nil {
		return err
	}
	if dump, derr := httputil.DumpRequestOut(req1, false); derr == nil {
		fmt.Printf("[hdfs-debug] REQUEST:\n%s\n", dump)
	}
	resp1, err := h.HTTP.Do(req1)
	if err != nil {
		return err
	}
	if rdump, derr := httputil.DumpResponse(resp1, true); derr == nil {
		fmt.Printf("[hdfs-debug] RESPONSE:\n%s\n", string(rdump))
	}
	resp1.Body.Close()
	if resp1.StatusCode != http.StatusTemporaryRedirect {
		return fmt.Errorf("hdfs create %s: expect 307, got %d", remoteName, resp1.StatusCode)
	}
	loc := resp1.Header.Get("Location")
	if loc == "" {
		return fmt.Errorf("hdfs create %s: empty redirect location", remoteName)
	}

	// 二跳：向 DataNode 写入文件数据
	req2, err := http.NewRequest(http.MethodPut, loc, f)
	if err != nil {
		return err
	}
	req2.Header.Set("Content-Type", "application/octet-stream")
	req2.ContentLength = st.Size()
	resp2, err := h.HTTP.Do(req2)
	if err != nil {
		return err
	}
	io.Copy(io.Discard, resp2.Body)
	resp2.Body.Close()
	if resp2.StatusCode < 200 || resp2.StatusCode >= 300 {
		return fmt.Errorf("hdfs put %s: status %d", remoteName, resp2.StatusCode)
	}
	return nil
}

// HdfsOpenStream 打开 HDFS 文件读取流（调用方负责关闭）。跟随 NN → DN 的 307 重定向。
func (h *HdfsClient) OpenStream(remoteName string) (io.ReadCloser, int64, error) {
	req, err := http.NewRequest(http.MethodGet, h.opURL(h.fileURL(remoteName), "op=OPEN"), nil)
	if err != nil {
		return nil, 0, err
	}
	resp, err := h.HTTP.Do(req)
	if err != nil {
		return nil, 0, err
	}
	if resp.StatusCode == http.StatusTemporaryRedirect {
		loc := resp.Header.Get("Location")
		resp.Body.Close()
		if loc == "" {
			return nil, 0, fmt.Errorf("hdfs open %s: empty redirect location", remoteName)
		}
		req2, err := http.NewRequest(http.MethodGet, loc, nil)
		if err != nil {
			return nil, 0, err
		}
		resp, err = h.HTTP.Do(req2)
		if err != nil {
			return nil, 0, err
		}
	}
	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		return nil, 0, os.ErrNotExist
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		resp.Body.Close()
		return nil, 0, fmt.Errorf("hdfs open %s: status %d", remoteName, resp.StatusCode)
	}
	return resp.Body, resp.ContentLength, nil
}
