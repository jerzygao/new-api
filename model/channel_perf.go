package model

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ChannelPerfMetric struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	ModelName      string `json:"model_name" gorm:"size:128;uniqueIndex:idx_channel_perf_model_channel_bucket,priority:1"`
	ChannelId      int    `json:"channel_id" gorm:"default:0;uniqueIndex:idx_channel_perf_model_channel_bucket,priority:2;index:idx_channel_perf_channel"`
	BucketTs       int64  `json:"bucket_ts" gorm:"uniqueIndex:idx_channel_perf_model_channel_bucket,priority:3;index:idx_channel_perf_bucket_ts"`
	RequestCount   int64  `json:"-" gorm:"default:0"`
	SuccessCount   int64  `json:"-" gorm:"default:0"`
	TotalLatencyMs int64  `json:"-" gorm:"default:0"`
	TtftSumMs      int64  `json:"-" gorm:"default:0"`
	TtftCount      int64  `json:"-" gorm:"default:0"`
	OutputTokens   int64  `json:"-" gorm:"default:0"`
	GenerationMs   int64  `json:"-" gorm:"default:0"`
}

func (ChannelPerfMetric) TableName() string {
	return "channel_perf_metrics"
}

func AutoMigrateChannelPerf() error {
	return DB.AutoMigrate(&ChannelPerfMetric{})
}

func UpsertChannelPerfMetric(metric *ChannelPerfMetric) error {
	if metric == nil || metric.RequestCount == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "model_name"},
			{Name: "channel_id"},
			{Name: "bucket_ts"},
		},
		// PostgreSQL rejects a table-qualified column on the SET left-hand side
		// (e.g. "channel_perf_metrics"."request_count") with SQLSTATE 42703, so
		// every flush upsert silently failed and channel_perf_metrics stayed empty.
		// Use bare column names here, matching UpsertPerfMetric. The right-hand
		// gorm.Expr may still reference the table-qualified column as a value.
		DoUpdates: clause.Assignments(map[string]interface{}{
			"request_count":    gorm.Expr("channel_perf_metrics.request_count + ?", metric.RequestCount),
			"success_count":    gorm.Expr("channel_perf_metrics.success_count + ?", metric.SuccessCount),
			"total_latency_ms": gorm.Expr("channel_perf_metrics.total_latency_ms + ?", metric.TotalLatencyMs),
			"ttft_sum_ms":      gorm.Expr("channel_perf_metrics.ttft_sum_ms + ?", metric.TtftSumMs),
			"ttft_count":       gorm.Expr("channel_perf_metrics.ttft_count + ?", metric.TtftCount),
			"output_tokens":    gorm.Expr("channel_perf_metrics.output_tokens + ?", metric.OutputTokens),
			"generation_ms":    gorm.Expr("channel_perf_metrics.generation_ms + ?", metric.GenerationMs),
		}),
	}).Create(metric).Error
}

type ChannelPerfMetricSummary struct {
	ChannelId      int    `json:"channel_id"`
	ModelName      string `json:"model_name"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	TtftSumMs      int64  `json:"ttft_sum_ms"`
	TtftCount      int64  `json:"ttft_count"`
	OutputTokens  int64  `json:"output_tokens"`
	GenerationMs  int64  `json:"generation_ms"`
}

func GetChannelPerfMetricsSummary(startTs int64, endTs int64, channelIds []int, modelName string) ([]ChannelPerfMetricSummary, error) {
	var summaries []ChannelPerfMetricSummary
	query := DB.Model(&ChannelPerfMetric{}).
		Select("channel_id, model_name, "+
			"SUM(request_count) as request_count, "+
			"SUM(success_count) as success_count, "+
			"SUM(total_latency_ms) as total_latency_ms, "+
			"SUM(ttft_sum_ms) as ttft_sum_ms, "+
			"SUM(ttft_count) as ttft_count, "+
			"SUM(output_tokens) as output_tokens, "+
			"SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if len(channelIds) > 0 {
		query = query.Where("channel_id IN ?", channelIds)
	}
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	err := query.
		Group("channel_id, model_name").
		Having("SUM(request_count) > 0").
		Find(&summaries).Error
	return summaries, err
}

type ChannelPerfMetricBucket struct {
	ChannelId      int    `json:"channel_id"`
	ModelName      string `json:"model_name"`
	BucketTs       int64  `json:"bucket_ts"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	TtftSumMs      int64  `json:"ttft_sum_ms"`
	TtftCount      int64  `json:"ttft_count"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

func GetChannelPerfMetricBuckets(startTs int64, endTs int64, channelIds []int, modelName string) ([]ChannelPerfMetricBucket, error) {
	var buckets []ChannelPerfMetricBucket
	query := DB.Model(&ChannelPerfMetric{}).
		Select("channel_id, model_name, bucket_ts, "+
			"SUM(request_count) as request_count, "+
			"SUM(success_count) as success_count, "+
			"SUM(total_latency_ms) as total_latency_ms, "+
			"SUM(ttft_sum_ms) as ttft_sum_ms, "+
			"SUM(ttft_count) as ttft_count, "+
			"SUM(output_tokens) as output_tokens, "+
			"SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if len(channelIds) > 0 {
		query = query.Where("channel_id IN ?", channelIds)
	}
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	err := query.
		Group("channel_id, model_name, bucket_ts").
		Having("SUM(request_count) > 0").
		Order("bucket_ts ASC").
		Find(&buckets).Error
	return buckets, err
}

func DeleteChannelPerfMetricsBefore(cutoffTs int64) error {
	if cutoffTs <= 0 {
		return nil
	}
	return DB.Where("bucket_ts < ?", cutoffTs).Delete(&ChannelPerfMetric{}).Error
}
