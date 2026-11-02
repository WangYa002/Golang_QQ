package handler

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func modelRequest(t *testing.T, model string, filename string, file []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("model", model); err != nil {
		t.Fatal(err)
	}
	if filename != "" {
		part, err := writer.CreateFormFile("file", filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(file); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/model/predict", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func modelRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/model/weights", ModelWeights)
	r.POST("/api/model/predict", ModelPredict)
	return r
}

func TestModelWeights(t *testing.T) {
	w := httptest.NewRecorder()
	modelRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/model/weights", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var got struct {
		Models []struct {
			ID string `json:"id"`
		} `json:"models"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Models) != 5 || got.Models[0].ID != "Crack500" || got.Models[4].ID != "TUT" {
		t.Fatalf("unexpected model list: %+v", got.Models)
	}
}

func TestModelPredictRejectsInvalidInputs(t *testing.T) {
	for _, tc := range []struct {
		name  string
		model string
		file  string
		data  []byte
	}{
		{"unknown model", "Other", "a.png", []byte("bad")},
		{"missing image", "TUT", "", nil},
		{"invalid image", "TUT", "a.png", []byte("bad")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			modelRouter().ServeHTTP(w, modelRequest(t, tc.model, tc.file, tc.data))
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestModelPredictProxiesValidatedImage(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/predict" || r.FormValue("model") != "CrackMap" {
			t.Errorf("upstream request: %s, %s", r.URL.Path, r.FormValue("model"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"mask":"data:image/png;base64,YQ==","width":1,"height":1,"inference_ms":2.5}`))
	}))
	defer upstream.Close()
	t.Setenv("MODEL_BASE_URL", upstream.URL)

	var imageBytes bytes.Buffer
	if err := png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	modelRouter().ServeHTTP(w, modelRequest(t, "CrackMap", "a.png", imageBytes.Bytes()))
	if w.Code != http.StatusOK || !bytes.Contains(w.Body.Bytes(), []byte(`"inference_ms":2.5`)) {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestModelPredictRejectsOversizedImage(t *testing.T) {
	var imageBytes bytes.Buffer
	if err := png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		t.Fatal(err)
	}
	oversized := make([]byte, maxModelImageBytes+1)
	copy(oversized, imageBytes.Bytes())
	w := httptest.NewRecorder()
	modelRouter().ServeHTTP(w, modelRequest(t, "TUT", "large.png", oversized))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestModelPredictRejectsInvalidUpstreamResponse(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("not json"))
	}))
	defer upstream.Close()
	t.Setenv("MODEL_BASE_URL", upstream.URL)
	var imageBytes bytes.Buffer
	if err := png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	modelRouter().ServeHTTP(w, modelRequest(t, "TUT", "a.png", imageBytes.Bytes()))
	if w.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}
