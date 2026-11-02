package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	MongoURI      string
	MongoDBName   string
	JWTSecret     string
	UploadDir     string
	AdminUsername string
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	SMTPHost      string
	SMTPPort      int
	SMTPUser      string
	SMTPPassword  string
	// 大文件存储：≥ HdfsThresholdMB 的文件转存 HDFS（WebHDFS），为分布式部署预留
	HdfsWebhdfsURL  string // NameNode WebHDFS 地址，如 http://hdfs-nn:9870；留空 = 不启用 HDFS
	HdfsUser        string
	HdfsBasePath    string // HDFS 根目录，如 /golang-qq
	HdfsThresholdMB int    // 转存阈值（文件 ≥ 此大小时进 HDFS）
	UploadMaxMB     int    // 单文件上传大小上限
}

var AppConfig *Config

func Load() {
	godotenv.Load()

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	AppConfig = &Config{
		Port:            getEnv("PORT", "8080"),
		MongoURI:        getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDBName:     getEnv("MONGO_DB", "golang_qq"),
		JWTSecret:       jwtSecret,
		UploadDir:       getEnv("UPLOAD_DIR", "../uploads"),
		AdminUsername:   os.Getenv("ADMIN_USERNAME"),
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:   os.Getenv("REDIS_PASSWORD"),
		RedisDB:         getEnvInt("REDIS_DB", 0),
		SMTPHost:        getEnv("SMTP_HOST", "smtp.qq.com"),
		SMTPPort:        getEnvInt("SMTP_PORT", 587),
		SMTPUser:        os.Getenv("SMTP_USER"),
		SMTPPassword:    os.Getenv("SMTP_PASSWORD"),
		HdfsWebhdfsURL:  os.Getenv("HDFS_WEBHDFS_URL"),
		HdfsUser:        getEnv("HDFS_USER", "root"),
		HdfsBasePath:    getEnv("HDFS_BASE_PATH", "/golang-qq"),
		HdfsThresholdMB: getEnvInt("HDFS_THRESHOLD_MB", 10),
		UploadMaxMB:     getEnvInt("UPLOAD_MAX_MB", 512),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return fallback
}
