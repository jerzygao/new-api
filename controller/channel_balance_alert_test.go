package controller

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func testChannelWithSetting(t *testing.T, settingJSON *string) *model.Channel {
	t.Helper()
	return &model.Channel{
		Id:      1,
		Name:    "test-channel",
		Type:    1,
		Setting: settingJSON,
	}
}

// setupBalanceAlertTestDB 提供内存 SQLite 连接。
// GetSetting() 在 Setting 解析失败时会清空 Setting 并调用 channel.Save()，因此非法 JSON 测试用例需要可用的 model.DB。
func setupBalanceAlertTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.Channel{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestCheckChannelBalanceAlert(t *testing.T) {
	// 无渠道配置（nil）→ 用全局阈值 10；余额 5 < 10 → 需要告警
	channel := testChannelWithSetting(t, nil)
	assert.Equal(t, balanceAlertNotify, checkChannelBalanceAlert(channel, 5, 10))

	// 已告警过 + 仍低于阈值 → 不重复通知
	channel.BalanceAlerted = true
	assert.Equal(t, balanceAlertNone, checkChannelBalanceAlert(channel, 5, 10))

	// 恢复（达到阈值）→ 清除告警标记
	assert.Equal(t, balanceAlertRecover, checkChannelBalanceAlert(channel, 10, 10))
	assert.Equal(t, balanceAlertRecover, checkChannelBalanceAlert(channel, 20, 10))

	// 余额耗尽交给禁用逻辑，不告警
	assert.Equal(t, balanceAlertNone, checkChannelBalanceAlert(channel, 0, 10))
	assert.Equal(t, balanceAlertNone, checkChannelBalanceAlert(channel, -1, 10))

	// 阈值 <= 0 = 关闭
	channel.BalanceAlerted = false
	assert.Equal(t, balanceAlertNone, checkChannelBalanceAlert(channel, 5, 0))
	assert.Equal(t, balanceAlertNone, checkChannelBalanceAlert(channel, 5, -1))
}

func TestResolveBalanceAlertThreshold(t *testing.T) {
	setupBalanceAlertTestDB(t) // 非法 JSON 用例中 GetSetting() 会调用 channel.Save()，需要 DB

	// 渠道未配置（nil）→ 返回全局阈值
	channel := testChannelWithSetting(t, nil)
	assert.Equal(t, 10.0, resolveBalanceAlertThreshold(channel, 10))

	// 渠道配置 >0 → 覆盖全局
	channel = testChannelWithSetting(t, common.GetPointer(`{"balance_alert_threshold":5}`))
	assert.Equal(t, 5.0, resolveBalanceAlertThreshold(channel, 10))

	// 渠道配置 0 → 关闭该渠道告警
	channel = testChannelWithSetting(t, common.GetPointer(`{"balance_alert_threshold":0}`))
	assert.Equal(t, 0.0, resolveBalanceAlertThreshold(channel, 10))

	// 渠道配置非法 JSON → 回退全局阈值，不报错
	channel = testChannelWithSetting(t, common.GetPointer(`{invalid`))
	assert.Equal(t, 10.0, resolveBalanceAlertThreshold(channel, 10))
}

func TestGetSettingBalanceAlertThreshold(t *testing.T) {
	channel := testChannelWithSetting(t, common.GetPointer(`{"balance_alert_threshold":3.5}`))
	require.NotNil(t, channel.GetSetting().BalanceAlertThreshold)
	assert.Equal(t, 3.5, *channel.GetSetting().BalanceAlertThreshold)
}
