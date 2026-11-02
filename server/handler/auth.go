package handler

import (
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"

	"golang-qq/cache"
	"golang-qq/config"
	"golang-qq/middleware"
	"golang-qq/model"
	"golang-qq/pkg/email"
)

type RegisterReq struct {
	Username string `json:"username" binding:"required,min=3,max=20"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname" binding:"required"`
}

type LoginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// SendCodeReq 发送邮箱验证码请求
type SendCodeReq struct {
	Email string `json:"email" binding:"required,email"`
}

// EmailLoginReq 邮箱验证码登录请求
type EmailLoginReq struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

var emailRe = regexp.MustCompile(`^[\w.+-]+@[\w-]+\.[\w.-]+$`)

// SendVerifyCode 发送邮箱验证码（真实 SMTP 发送）
func SendVerifyCode(c *gin.Context) {
	var req SendCodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱格式错误"})
		return
	}
	if !emailRe.MatchString(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱格式错误"})
		return
	}

	// 频率限制：1 分钟一次
	if err := cache.CheckSendLimit(c, req.Email); err != nil {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "发送太频繁，请稍后再试"})
		return
	}

	code := cache.GenVerifyCode()
	if config.AppConfig.SMTPUser == "" || config.AppConfig.SMTPPassword == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "SMTP 未配置，请在 .env 中填写 SMTP_USER 与 SMTP_PASSWORD（QQ 邮箱授权码）"})
		return
	}
	if err := email.SendVerifyCode(req.Email, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证码发送失败：" + err.Error()})
		return
	}

	if err := cache.SetVerifyCode(c, req.Email, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证码保存失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "验证码已发送，请查收邮箱"})
}

// EmailLogin 邮箱验证码登录（无账号则自动注册）
func EmailLogin(c *gin.Context) {
	var req EmailLoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	// 校验验证码（比对失败不删除，允许重试；成功后删除，一次性使用）
	saved, err := cache.GetVerifyCode(c, req.Email)
	if err != nil || saved != req.Code {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "验证码错误或已过期"})
		return
	}
	cache.DeleteVerifyCode(c, req.Email)

	var user model.User
	err = model.Users.FindOne(c, bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		// 邮箱不存在 → 自动注册（用户名用邮箱前缀，昵称默认邮箱前缀）
		username := emailPrefix(req.Email)
		// 用户名冲突处理：追加后缀
		for i := 0; ; i++ {
			candidate := username
			if i > 0 {
				candidate = username + "_" + strconv.Itoa(i)
			}
			count, _ := model.Users.CountDocuments(c, bson.M{"username": candidate})
			if count == 0 {
				username = candidate
				break
			}
		}

		user = model.User{
			ID:        primitive.NewObjectID(),
			Username:  username,
			Password:  "", // 验证码登录无需密码
			Nickname:  emailPrefix(req.Email),
			Avatar:    "",
			Email:     req.Email,
			Status:    "offline",
			Role:      "user",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// 第一个注册的用户自动成为管理员
		userCount, _ := model.Users.CountDocuments(c, bson.M{})
		if userCount == 0 {
			user.Role = "admin"
		}

		if _, err := model.Users.InsertOne(c, user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "自动注册失败"})
			return
		}
	}

	token, _ := middleware.GenerateToken(user.ID)
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user.ToPublic()})
}

func emailPrefix(emailAddr string) string {
	for i, ch := range emailAddr {
		if ch == '@' {
			return emailAddr[:i]
		}
	}
	return emailAddr
}

func Register(c *gin.Context) {
	var req RegisterReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	count, _ := model.Users.CountDocuments(c, bson.M{"username": req.Username})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	user := model.User{
		ID:        primitive.NewObjectID(),
		Username:  req.Username,
		Password:  string(hash),
		Nickname:  req.Nickname,
		Avatar:    "",
		Status:    "offline",
		Role:      "user",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 第一个注册的用户自动成为管理员（空库引导）
	userCount, _ := model.Users.CountDocuments(c, bson.M{})
	if userCount == 0 {
		user.Role = "admin"
	}

	_, err := model.Users.InsertOne(c, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "register failed"})
		return
	}

	token, _ := middleware.GenerateToken(user.ID)
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": user.ToPublic()})
}

func Login(c *gin.Context) {
	var req LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user model.User
	err := model.Users.FindOne(c, bson.M{"username": req.Username}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, _ := middleware.GenerateToken(user.ID)
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user.ToPublic()})
}
