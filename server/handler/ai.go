package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"

	"golang-qq/middleware"
)

// RAG 助手服务（智汇知识库 RAG-Assistant）的代理转发：
// QQ 前端 → /api/ai/*（带 JWT 鉴权）→ RAG_BASE_URL/api/*

var ragHTTPClient = &http.Client{Timeout: 5 * time.Minute}

func ragBaseURL() string {
	if v := os.Getenv("RAG_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:8000"
}

// AiHealth 检查 RAG 服务可用性
func AiHealth(c *gin.Context) {
	ragProxy(c, http.MethodGet, "/api/health", nil)
}

// AiDocList 知识库文档列表（按当前用户过滤，每个用户的小Q 独立知识库）
func AiDocList(c *gin.Context) {
	ragProxy(c, http.MethodGet, "/api/documents?owner_id="+middleware.GetUserID(c).Hex(), nil)
}

// AiDocUpload 上传知识库文档（注入 owner_id 归属当前用户）
func AiDocUpload(c *gin.Context) {
	// multipart body 无法直接追加字段 → 解析后重建
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad multipart"})
		return
	}
	userID := middleware.GetUserID(c).Hex()
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	defer file.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "read failed"})
		return
	}

	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	fw, _ := w.CreateFormFile("file", header.Filename)
	fw.Write(buf.Bytes())
	w.WriteField("owner_id", userID)
	w.Close()

	ragProxy(c, http.MethodPost, "/api/documents/upload", &b)
}

// AiDocDelete 删除知识库文档
func AiDocDelete(c *gin.Context) {
	ragProxy(c, http.MethodDelete, "/api/documents/"+c.Param("id"), nil)
}

// AiIndexRebuild 重建向量索引
func AiIndexRebuild(c *gin.Context) {
	ragProxy(c, http.MethodPost, "/api/index/rebuild", nil)
}

// AiChatStream 代理 RAG 的 SSE 问答流（citations / delta / done 事件原样透传）。
// 注入提问者身份（owner_id），使 RAG 能检索该用户的个人聊天归档。
func AiChatStream(c *gin.Context) {
	raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad body"})
		return
	}
	var body map[string]any
	if json.Unmarshal(raw, &body) == nil && body != nil {
		body["owner_id"] = middleware.GetUserID(c).Hex()
		if raw, err = json.Marshal(body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad body"})
			return
		}
	}
	ragProxy(c, http.MethodPost, "/api/chat/stream", bytes.NewReader(raw))
}

// AiRate 点赞/点踩 AI 回答（透传 RAG；点赞会使其进入热缓存）
func AiRate(c *gin.Context) {
	ragProxy(c, http.MethodPost, "/api/messages/"+c.Param("id")+"/rating", c.Request.Body)
}

// AiMcpTools 查看当前 Agent 工具池（内置 + 外部 MCP）
func AiMcpTools(c *gin.Context) {
	ragProxy(c, http.MethodGet, "/api/mcp-admin/tools", nil)
}

// AiMcpReload 热重载外部 MCP server（重新发现工具，无需重启）
func AiMcpReload(c *gin.Context) {
	ragProxy(c, http.MethodPost, "/api/mcp-admin/reload", c.Request.Body)
}

// AiMcpEndpoint RAG 自身作为 MCP server 的对外端点（JSON-RPC 透传，
// 供外部 Agent 复用小Q 工具；无 QQ JWT——MCP 客户端不携带业务 token）
func AiMcpEndpoint(c *gin.Context) {
	ragProxy(c, http.MethodPost, "/api/mcp", c.Request.Body)
}

func ragProxy(c *gin.Context, method, path string, body io.Reader) {
	req, err := http.NewRequestWithContext(c.Request.Context(), method, ragBaseURL()+path, body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ai upstream unavailable"})
		return
	}
	if body != nil {
		if ct := c.GetHeader("Content-Type"); ct != "" {
			req.Header.Set("Content-Type", ct)
		}
	}

	resp, err := ragHTTPClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ai upstream unreachable", "detail": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.Header.Get("Content-Type") == "text/event-stream" {
		// SSE：逐块透传并立即刷给客户端
		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("X-Accel-Buffering", "no")
		c.Writer.WriteHeader(resp.StatusCode)
		flusher, canFlush := c.Writer.(http.Flusher)
		buf := make([]byte, 4096)
		for {
			n, readErr := resp.Body.Read(buf)
			if n > 0 {
				if _, writeErr := c.Writer.Write(buf[:n]); writeErr != nil {
					return
				}
				if canFlush {
					flusher.Flush()
				}
			}
			if readErr != nil {
				return
			}
		}
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ai upstream read failed"})
		return
	}
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), data)
}
