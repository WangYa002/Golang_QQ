package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	MongoURI      string
	MongoDBName   string
	JWTSecret     string
	UploadDir     string
	AdminUsername string
}

var AppConfig *Config

func Load() {
	godotenv.Load()

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	AppConfig = &Config{
		Port:          getEnv("PORT", "8080"),
		MongoURI:      getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDBName:   getEnv("MONGO_DB", "golang_qq"),
		JWTSecret:     jwtSecret,
		UploadDir:     getEnv("UPLOAD_DIR", "../uploads"),
		AdminUsername: os.Getenv("ADMIN_USERNAME"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
