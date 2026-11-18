package model

import (
	"github.com/QuantumNous/new-api/common"
)

// QuotaDataSummary 按人 / 按分组的用量汇总统计
type QuotaDataSummary struct {
	Username  string `json:"username"`
	UseGroup  string `json:"use_group"`
	TokenUsed int    `json:"token_used"`
	Quota     int    `json:"quota"`
	Count     int    `json:"count"`
	UserCount int    `json:"user_count"` // 仅按分组统计时返回
}

// GetQuotaDataSummaryByUser 按用户名汇总 token 用量/额度/请求数，按 token_used 降序
// channelID > 0 时只统计该渠道的用量；userIDs 非空时只统计这些用户
func GetQuotaDataSummaryByUser(startTime int64, endTime int64, channelID int, userIDs []int) (summaries []*QuotaDataSummary, err error) {
	query := DB.Table("quota_data").
		Select("username, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if channelID > 0 {
		query = query.Where("channel_id = ?", channelID)
	}
	if len(userIDs) > 0 {
		query = query.Where("user_id IN ?", userIDs)
	}
	err = query.Group("username").
		Order("token_used desc").
		Find(&summaries).Error
	return summaries, err
}

// GetQuotaDataSummaryByGroup 按 use_group 汇总，附带去重用户数，按 token_used 降序
// channelID > 0 时只统计该渠道的用量
func GetQuotaDataSummaryByGroup(startTime int64, endTime int64, channelID int) (summaries []*QuotaDataSummary, err error) {
	query := DB.Table("quota_data").
		Select("use_group, count(distinct user_id) as user_count, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if channelID > 0 {
		query = query.Where("channel_id = ?", channelID)
	}
	err = query.Group("use_group").
		Order("token_used desc").
		Find(&summaries).Error
	return summaries, err
}

// ChannelUsageSummary 按渠道汇总的用量统计
type ChannelUsageSummary struct {
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"` // 名称由 controller 经 ResolveChannelNames 填充
	TokenUsed   int    `json:"token_used"`
	Quota       int    `json:"quota"`
	Count       int    `json:"count"`
}

// GetChannelUsageSummaries 按 channel_id 汇总时间范围内的用量，排除无渠道(0)行，按 token_used 降序
func GetChannelUsageSummaries(startTime int64, endTime int64) (summaries []*ChannelUsageSummary, err error) {
	err = DB.Table("quota_data").
		Select("channel_id, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Where("channel_id > 0").
		Group("channel_id").
		Order("token_used desc").
		Find(&summaries).Error
	return summaries, err
}

// ChannelDimensionTokenUsage 渠道维度下的用量（按人 / 按分组，一次只填一个维度）
type ChannelDimensionTokenUsage struct {
	Username    string `json:"username"`
	UseGroup    string `json:"use_group"`
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"` // 名称由 controller 经 ResolveChannelNames 填充
	TokenUsed   int    `json:"token_used"`
}

// GetChannelTokenUsageByUser 按 username + channel_id 汇总 token 用量，排除无渠道(0)行，按 token_used 降序
// userIDs 非空时只统计这些用户
func GetChannelTokenUsageByUser(startTime int64, endTime int64, userIDs []int) (rows []*ChannelDimensionTokenUsage, err error) {
	query := DB.Table("quota_data").
		Select("username, channel_id, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Where("channel_id > 0")
	if len(userIDs) > 0 {
		query = query.Where("user_id IN ?", userIDs)
	}
	err = query.Group("username, channel_id").
		Order("token_used desc").
		Find(&rows).Error
	return rows, err
}

// GetChannelTokenUsageByGroup 按 use_group + channel_id 汇总 token 用量，排除无渠道(0)行，按 token_used 降序
func GetChannelTokenUsageByGroup(startTime int64, endTime int64) (rows []*ChannelDimensionTokenUsage, err error) {
	err = DB.Table("quota_data").
		Select("use_group, channel_id, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Where("channel_id > 0").
		Group("use_group, channel_id").
		Order("token_used desc").
		Find(&rows).Error
	return rows, err
}

// ResolveChannelNames 批量解析渠道名：内存缓存开启时走 CacheGetChannel，否则查 channels 表。
// 已删除或解析不到的渠道不产生条目，由调用方决定展示回退（如 "Channel 3"）。
func ResolveChannelNames(channelIDs []int) (map[int]string, error) {
	nameByID := make(map[int]string, len(channelIDs))
	if common.MemoryCacheEnabled {
		for _, channelID := range channelIDs {
			if channel, err := CacheGetChannel(channelID); err == nil {
				nameByID[channelID] = channel.Name
			}
		}
		return nameByID, nil
	}
	var channels []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
		return nil, err
	}
	for _, channel := range channels {
		nameByID[channel.Id] = channel.Name
	}
	return nameByID, nil
}

// ModelDimensionTokenUsage 模型维度下的用量（按人 / 按分组，一次只填一个维度）
type ModelDimensionTokenUsage struct {
	Username  string `json:"username"`
	UseGroup  string `json:"use_group"`
	ModelName string `json:"model_name"`
	TokenUsed int    `json:"token_used"`
}

// GetModelTokenUsageByUser 按 username + model_name 汇总 token 用量，排除空模型名行与 root 用户，按 token_used 降序
// userIDs 非空时只统计这些用户
func GetModelTokenUsageByUser(startTime int64, endTime int64, userIDs []int) (rows []*ModelDimensionTokenUsage, err error) {
	query := DB.Table("quota_data").
		Select("username, model_name, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Where("model_name != ''").
		Where("username != 'root'")
	if len(userIDs) > 0 {
		query = query.Where("user_id IN ?", userIDs)
	}
	err = query.Group("username, model_name").
		Order("token_used desc").
		Find(&rows).Error
	return rows, err
}

// GetModelTokenUsageByGroup 按 use_group + model_name 汇总 token 用量，排除空模型名行，按 token_used 降序
func GetModelTokenUsageByGroup(startTime int64, endTime int64) (rows []*ModelDimensionTokenUsage, err error) {
	err = DB.Table("quota_data").
		Select("use_group, model_name, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Where("model_name != ''").
		Group("use_group, model_name").
		Order("token_used desc").
		Find(&rows).Error
	return rows, err
}

// ModelTokenUsageSummary 按模型汇总的用量统计
type ModelTokenUsageSummary struct {
	ModelName string `json:"model_name"`
	TokenUsed int    `json:"token_used"`
	Count     int    `json:"count"`
}

// GetModelTokenUsageSummary 按 model_name 汇总 token 用量与调用次数，排除空模型名行与 root 用户，按 token_used 降序
// userIDs 非空时只统计这些用户
func GetModelTokenUsageSummary(startTime int64, endTime int64, userIDs []int) (rows []*ModelTokenUsageSummary, err error) {
	query := DB.Table("quota_data").
		Select("model_name, sum(token_used) as token_used, sum(count) as count").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Where("model_name != ''").
		Where("username != 'root'")
	if len(userIDs) > 0 {
		query = query.Where("user_id IN ?", userIDs)
	}
	err = query.Group("model_name").
		Order("token_used desc").
		Find(&rows).Error
	return rows, err
}
