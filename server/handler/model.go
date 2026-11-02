package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const maxModelImageBytes = 5 << 20
const maxModelResultBytes = 16 << 20

var modelHTTPClient = &http.Client{Timeout: 90 * time.Second}

var modelIDs = []string{"Crack500", "CrackMap", "DeepCrack", "Facade390", "TUT"}

func validModelID(id string) bool {
	for _, allowed := range modelIDs {
		if id == allowed {
			return true
		}
	}
	return false
}

func ModelWeights(c *gin.Context) {
	models := make([]gin.H, 0, len(modelIDs))
	for _, id := range modelIDs {
		models = append(models, gin.H{"id": id, "label": id})
	}
	c.JSON(http.StatusOK, gin.H{"models": models})
}

func ModelPredict(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxModelImageBytes+64<<10)
	modelID := c.PostForm("model")
	if !validModelID(modelID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown model"})
		return
	}
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image required"})
		return
	}
	defer file.Close()
	image, err := io.ReadAll(io.LimitReader(file, maxModelImageBytes+1))
	if err != nil || len(image) == 0 || len(image) > maxModelImageBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image must be 1 byte to 5 MiB"})
		return
	}
	contentType := http.DetectContentType(image)
	if contentType != "image/png" && contentType != "image/jpeg" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only PNG and JPEG images are supported"})
		return
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err = writer.WriteField("model", modelID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare request"})
		return
	}
	part, err := writer.CreateFormFile("file", "image")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare request"})
		return
	}
	if _, err = part.Write(image); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare request"})
		return
	}
	if err = writer.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare request"})
		return
	}
	baseURL := os.Getenv("MODEL_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8001"
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, strings.TrimRight(baseURL, "/")+"/predict", &body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "model service unavailable"})
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := modelHTTPClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "model service unavailable"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 500 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "model inference unavailable"})
		return
	}
	payload, err := io.ReadAll(io.LimitReader(resp.Body, maxModelResultBytes+1))
	if err != nil || len(payload) > maxModelResultBytes || !json.Valid(payload) {
		c.JSON(http.StatusBadGateway, gin.H{"error": "invalid model response"})
		return
	}
	c.Data(resp.StatusCode, "application/json", payload)
}
