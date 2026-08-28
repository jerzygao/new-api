package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func parseFlowQuotaTimeRange(c *gin.Context) (int64, int64, bool) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil || startTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid start_timestamp")
		return 0, 0, false
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil || endTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid end_timestamp")
		return 0, 0, false
	}
	if endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "invalid time range")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

// parseUserIDs 解析逗号分隔的 user_ids 查询参数为 int 切片。
// 空串或缺失返回 nil（不过滤）；遇到非正整数 token 返回错误。
func parseUserIDs(raw string) ([]int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	ids := make([]int, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, err := strconv.Atoi(part)
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("invalid user_ids: %s", part)
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil, nil
	}
	return ids, nil
}

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetQuotaDatesByUser(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	dates, err := model.GetQuotaDataGroupByUser(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

func GetUserQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	// 判断时间跨度是否超过 1 个月
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	dates, err := model.GetQuotaDataByUserId(userId, startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetAllFlowQuotaDates(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	username := c.Query("username")
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, username, 0, c.GetInt("role"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetUserFlowQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, "", userId, common.RoleCommonUser)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetQuotaDataSummaryByUser(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelID, _ := strconv.ParseInt(c.Query("channel_id"), 10, 64)
	userIDs, err := parseUserIDs(c.Query("user_ids"))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	summaries, err := model.GetQuotaDataSummaryByUser(startTimestamp, endTimestamp, int(channelID), userIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summaries,
	})
	return
}

func GetQuotaDataSummaryByGroup(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelID, _ := strconv.ParseInt(c.Query("channel_id"), 10, 64)
	summaries, err := model.GetQuotaDataSummaryByGroup(startTimestamp, endTimestamp, int(channelID))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summaries,
	})
	return
}

func GetChannelUsageSummaries(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	summaries, err := model.GetChannelUsageSummaries(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channelIDs := make([]int, 0, len(summaries))
	for _, summary := range summaries {
		channelIDs = append(channelIDs, summary.ChannelID)
	}
	nameByID, err := model.ResolveChannelNames(channelIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for _, summary := range summaries {
		if name := nameByID[summary.ChannelID]; name != "" {
			summary.ChannelName = name
			continue
		}
		summary.ChannelName = fmt.Sprintf("Channel %d", summary.ChannelID)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summaries,
	})
}

// fillChannelDimensionNames 批量填充渠道名：先收集去重 channel_id，经 ResolveChannelNames 解析，缺失回退 "Channel {{id}}"
func fillChannelDimensionNames(rows []*model.ChannelDimensionTokenUsage) error {
	seen := make(map[int]struct{})
	channelIDs := make([]int, 0, len(rows))
	for _, row := range rows {
		if _, ok := seen[row.ChannelID]; ok {
			continue
		}
		seen[row.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, row.ChannelID)
	}
	if len(channelIDs) == 0 {
		return nil
	}
	nameByID, err := model.ResolveChannelNames(channelIDs)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if name := nameByID[row.ChannelID]; name != "" {
			row.ChannelName = name
			continue
		}
		row.ChannelName = fmt.Sprintf("Channel %d", row.ChannelID)
	}
	return nil
}

func GetChannelTokenUsageByUser(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	userIDs, err := parseUserIDs(c.Query("user_ids"))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	rows, err := model.GetChannelTokenUsageByUser(startTimestamp, endTimestamp, userIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := fillChannelDimensionNames(rows); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

func GetChannelTokenUsageByGroup(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	rows, err := model.GetChannelTokenUsageByGroup(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := fillChannelDimensionNames(rows); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

func GetModelTokenUsageByUser(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	userIDs, err := parseUserIDs(c.Query("user_ids"))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	rows, err := model.GetModelTokenUsageByUser(startTimestamp, endTimestamp, userIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

func GetModelTokenUsageByGroup(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	rows, err := model.GetModelTokenUsageByGroup(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

func GetModelTokenUsageSummary(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	userIDs, err := parseUserIDs(c.Query("user_ids"))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	rows, err := model.GetModelTokenUsageSummary(startTimestamp, endTimestamp, userIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}
