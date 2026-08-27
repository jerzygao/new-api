package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup  string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"index;default:0"`
	ChannelID int    `json:"channel_id" gorm:"index;default:0"`
	NodeName  string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID    int
	Username  string
	ModelName string
	Quota     int
	CreatedAt int64
	TokenUsed int
	UseGroup  string
	TokenID   int
	ChannelID int
	NodeName  string
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

func logQuotaDataCache(quotaData *QuotaData) {
	key := fmt.Sprintf("%d\x00%s\x00%s\x00%d\x00%s\x00%d\x00%d\x00%s",
		quotaData.UserID,
		quotaData.Username,
		quotaData.ModelName,
		quotaData.CreatedAt,
		quotaData.UseGroup,
		quotaData.TokenID,
		quotaData.ChannelID,
		quotaData.NodeName,
	)
	count := quotaData.Count
	quota := quotaData.Quota
	tokenUsed := quotaData.TokenUsed
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.TokenUsed += tokenUsed
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:    params.UserID,
		Username:  params.Username,
		ModelName: params.ModelName,
		CreatedAt: createdAt,
		UseGroup:  params.UseGroup,
		TokenID:   params.TokenID,
		ChannelID: params.ChannelID,
		NodeName:  params.NodeName,
		Count:     1,
		Quota:     params.Quota,
		TokenUsed: params.TokenUsed,
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	// 如果缓存中有数据，就保存到数据库中
	// 1. 先查询数据库中是否有数据
	// 2. 如果有数据，就更新数据
	// 3. 如果没有数据，就插入数据
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").
			Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
				quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
			First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
			increaseQuotaData(quotaData)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(quotaData *QuotaData) {
	err := DB.Table("quota_data").
		Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
		Updates(map[string]interface{}{
			"count":      gorm.Expr("count + ?", quotaData.Count),
			"quota":      gorm.Expr("quota + ?", quotaData.Quota),
			"token_used": gorm.Expr("token_used + ?", quotaData.TokenUsed),
		}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData error: %s", err))
	}
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

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
