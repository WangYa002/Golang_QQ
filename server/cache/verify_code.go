package cache

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// 验证码参数
const (
	verifyCodeTTL   = 5 * time.Minute // 验证码有效期
	verifyLimitTTL  = 1 * time.Minute // 发送频率限制
	verifyCodeLen   = 6
)

var ErrSendTooFrequent = errors.New("send too frequent")

// SetVerifyCode 保存邮箱验证码（5min 有效）。
func SetVerifyCode(ctx context.Context, email, code string) error {
	return RDB.Set(ctx, keyVerify+email, code, verifyCodeTTL).Err()
}

// GetVerifyCode 读取验证码（不删除，失败重试仍可用）。
func GetVerifyCode(ctx context.Context, email string) (string, error) {
	return RDB.Get(ctx, keyVerify+email).Result()
}

// DeleteVerifyCode 删除验证码（比对成功后调用，一次性使用防重放）。
func DeleteVerifyCode(ctx context.Context, email string) {
	RDB.Del(ctx, keyVerify+email)
}

// CheckSendLimit 检查是否在 1min 限流期内；未限流则设置限流标记并返回 nil。
func CheckSendLimit(ctx context.Context, email string) error {
	key := keyVerifyLimit + ":" + email
	ok, err := RDB.SetNX(ctx, key, "1", verifyLimitTTL).Result()
	if err != nil {
		return err
	}
	if !ok {
		return ErrSendTooFrequent
	}
	return nil
}

// GenVerifyCode 生成 6 位数字验证码。
func GenVerifyCode() string {
	return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
}
