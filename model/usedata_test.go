package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createQuotaDataTestRows 插入 3 个用户、2 个分组、2 个小时的聚合数据：
//   alice: default 组, 第一小时, 100+200 token / 1000+2000 quota / 2 次请求
//   bob:   vip 组,    第一小时, 50 token / 500 quota / 1 次请求
//   carol: vip 组,    第二小时, 25 token / 250 quota / 2 次请求
func createQuotaDataTestRows(t *testing.T) {
	t.Helper()
	base := time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC).Unix()
	rows := []*QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: base, UseGroup: "default", TokenID: 1, ChannelID: 1, TokenUsed: 100, Count: 1, Quota: 1000},
		{UserID: 1, Username: "alice", ModelName: "gpt-4o", CreatedAt: base, UseGroup: "default", TokenID: 2, ChannelID: 1, TokenUsed: 200, Count: 1, Quota: 2000},
		{UserID: 2, Username: "bob", ModelName: "gpt-4o-mini", CreatedAt: base, UseGroup: "vip", TokenID: 3, ChannelID: 1, TokenUsed: 50, Count: 1, Quota: 500},
		{UserID: 3, Username: "carol", ModelName: "claude-3", CreatedAt: base + 3600, UseGroup: "vip", TokenID: 4, ChannelID: 2, TokenUsed: 25, Count: 2, Quota: 250},
	}
	for _, row := range rows {
		require.NoError(t, DB.Create(row).Error)
	}
}

func TestGetQuotaDataSummaryByUser(t *testing.T) {
	truncateTables(t)
	createQuotaDataTestRows(t)
	base := time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC).Unix()

	summaries, err := GetQuotaDataSummaryByUser(base, base+3600)
	require.NoError(t, err)
	require.Len(t, summaries, 3)

	// 按 token_used 降序：alice(300) > bob(50) > carol(25)
	assert.Equal(t, "alice", summaries[0].Username)
	assert.Equal(t, 300, summaries[0].TokenUsed)
	assert.Equal(t, 3000, summaries[0].Quota)
	assert.Equal(t, 2, summaries[0].Count)

	assert.Equal(t, "bob", summaries[1].Username)
	assert.Equal(t, 50, summaries[1].TokenUsed)
	assert.Equal(t, 1, summaries[1].Count)

	assert.Equal(t, "carol", summaries[2].Username)
	assert.Equal(t, 25, summaries[2].TokenUsed)

	// 时间范围过滤：只查第一小时，排除第二小时的 carol
	rangeSummaries, err := GetQuotaDataSummaryByUser(base, base)
	require.NoError(t, err)
	require.Len(t, rangeSummaries, 2)
}

func TestGetQuotaDataSummaryByGroup(t *testing.T) {
	truncateTables(t)
	createQuotaDataTestRows(t)
	base := time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC).Unix()

	summaries, err := GetQuotaDataSummaryByGroup(base, base+3600)
	require.NoError(t, err)
	require.Len(t, summaries, 2)

	// 按 token_used 降序：default(300) > vip(75)
	assert.Equal(t, "default", summaries[0].UseGroup)
	assert.Equal(t, 300, summaries[0].TokenUsed)
	assert.Equal(t, 3000, summaries[0].Quota)
	assert.Equal(t, 2, summaries[0].Count)
	assert.Equal(t, 1, summaries[0].UserCount)

	assert.Equal(t, "vip", summaries[1].UseGroup)
	assert.Equal(t, 75, summaries[1].TokenUsed)
	assert.Equal(t, 750, summaries[1].Quota)
	assert.Equal(t, 3, summaries[1].Count)
	assert.Equal(t, 2, summaries[1].UserCount)
}

func TestGetQuotaDataSummaryEmpty(t *testing.T) {
	truncateTables(t)

	userSummaries, err := GetQuotaDataSummaryByUser(0, 0)
	require.NoError(t, err)
	assert.Empty(t, userSummaries)

	groupSummaries, err := GetQuotaDataSummaryByGroup(0, 0)
	require.NoError(t, err)
	assert.Empty(t, groupSummaries)
}
