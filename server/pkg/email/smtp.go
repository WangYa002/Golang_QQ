package email

import (
	"fmt"
	"net/smtp"

	"golang-qq/config"
)

// SendVerifyCode 通过 SMTP 发送验证码邮件。
// 返回 nil 表示发送成功。
func SendVerifyCode(to, code string) error {
	cfg := config.AppConfig
	from := cfg.SMTPUser
	if from == "" {
		return fmt.Errorf("SMTP_USER not configured")
	}

	auth := smtp.PlainAuth("", from, cfg.SMTPPassword, cfg.SMTPHost)
	addr := fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort)

	subject := "Golang QQ 登录验证码"
	body := fmt.Sprintf("您的登录验证码是：%s，5 分钟内有效。", code)
	msg := []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, to, subject, body,
	))

	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}
