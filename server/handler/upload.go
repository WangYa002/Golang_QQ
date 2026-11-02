package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"golang-qq/config"
	"golang-qq/storage"
)

var allowedExtensions = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
	".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
	".txt": true, ".zip": true, ".mp3": true, ".mp4": true,
}

// HDFS 文件名白名单（时间戳 + 扩展名，防目录穿越）
var hdfsNamePattern = regexp.MustCompile(`^[0-9]+\.[a-z0-9]{1,8}$`)

// HDFS 文件由本路由流式提供（WebHDFS），任意 server 实例可服务，支持分布式部署。
// 懒加载：包初始化时 AppConfig 尚未 Load。
var (
	hdfsOnce sync.Once
	hdfs     *storage.HdfsClient
)

func getHdfs() *storage.HdfsClient {
	hdfsOnce.Do(func() {
		hdfs = storage.NewHdfsClient(
			config.AppConfig.HdfsWebhdfsURL,
			config.AppConfig.HdfsUser,
			config.AppConfig.HdfsBasePath,
		)
	})
	return hdfs
}

func UploadFile(c *gin.Context) {
	maxBytes := int64(config.AppConfig.UploadMaxMB) << 20
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("file required or file too large (max %dMB)", config.AppConfig.UploadMaxMB),
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExtensions[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file type not allowed"})
		return
	}

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dir := config.AppConfig.UploadDir
	os.MkdirAll(dir, 0755)
	tmp := filepath.Join(dir, "tmp-"+filename)

	if err := c.SaveUploadedFile(file, tmp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
		return
	}

	// 大文件转存 HDFS（转存成功后删除本地临时文件）；
	// HDFS 未启用或未达阈值 → 留本地磁盘（保持原行为）。
	st, _ := os.Stat(tmp)
	useHdfs := config.AppConfig.HdfsWebhdfsURL != "" &&
		st != nil && st.Size() >= int64(config.AppConfig.HdfsThresholdMB)<<20

	var url string
	if useHdfs {
		if err := getHdfs().PutFile(tmp, filename); err != nil {
			os.Remove(tmp)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "hdfs transfer failed", "detail": err.Error()})
			return
		}
		os.Remove(tmp)
		url = "/hdfs-files/" + filename
	} else {
		dst := filepath.Join(dir, filename)
		if err := os.Rename(tmp, dst); err != nil {
			os.Remove(tmp)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
			return
		}
		url = "/uploads/" + filename
	}

	c.JSON(http.StatusOK, gin.H{"url": url, "filename": file.Filename, "storage": map[string]bool{"hdfs": useHdfs}})
}

// ServeHDFSFile 流式提供转存到 HDFS 的大文件。
// 支持多实例部署：文件在共享的 HDFS 上，任意 server 节点都能服务该下载。
func ServeHDFSFile(c *gin.Context) {
	if config.AppConfig.HdfsWebhdfsURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "hdfs storage disabled"})
		return
	}
	name := c.Param("name")
	if !hdfsNamePattern.MatchString(name) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file name"})
		return
	}
	stream, size, err := getHdfs().OpenStream(name)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "hdfs unavailable"})
		return
	}
	defer stream.Close()

	ext := strings.ToLower(filepath.Ext(name))
	contentType := "application/octet-stream"
	switch ext {
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".gif":
		contentType = "image/gif"
	case ".webp":
		contentType = "image/webp"
	case ".pdf":
		contentType = "application/pdf"
	case ".txt", ".md":
		contentType = "text/plain; charset=utf-8"
	case ".mp4":
		contentType = "video/mp4"
	case ".mp3":
		contentType = "audio/mpeg"
	}
	c.Header("Content-Type", contentType)
	if size > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", size))
	}
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	_, _ = io.Copy(c.Writer, stream)
}
