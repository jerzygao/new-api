package channelperf

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

func flushLoop() {
	interval := perf_metrics_setting.GetFlushIntervalMinutes()
	if interval <= 0 {
		interval = 5
	}
	ticker := time.NewTicker(time.Duration(interval) * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		flushHotBuckets()
		cleanupExpired()
	}
}

func flushHotBuckets() {
	hotBuckets.Range(func(key, value any) bool {
		bk := key.(bucketKey)
		if isBucketCurrent(bk.bucketTs) {
			return true
		}
		bucket := value.(*atomicBucket)
		counters := bucket.drain()
		if counters.requestCount == 0 {
			return true
		}
		metric := &model.ChannelPerfMetric{
			ModelName:      bk.model,
			ChannelId:      bk.channelId,
			BucketTs:       bk.bucketTs,
			RequestCount:   counters.requestCount,
			SuccessCount:   counters.successCount,
			TotalLatencyMs: counters.totalLatencyMs,
			TtftSumMs:      counters.ttftSumMs,
			TtftCount:      counters.ttftCount,
			OutputTokens:   counters.outputTokens,
			GenerationMs:   counters.generationMs,
		}
		if err := model.UpsertChannelPerfMetric(metric); err != nil {
			common.SysError("channel_perf: failed to upsert metric: " + err.Error())
			bucket.addCounters(counters)
		}
		return true
	})
}

func cleanupExpired() {
	retentionDays := perf_metrics_setting.GetSetting().RetentionDays
	if retentionDays <= 0 {
		retentionDays = 30
	}
	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour).Unix()
	if err := model.DeleteChannelPerfMetricsBefore(cutoff); err != nil {
		common.SysError("channel_perf: failed to delete expired metrics: " + err.Error())
	}
}

func isBucketCurrent(bucketTs int64) bool {
	current := bucketStart(time.Now().Unix())
	return bucketTs >= current
}

func (b *atomicBucket) addCounters(c counters) {
	b.requestCount.Add(c.requestCount)
	b.successCount.Add(c.successCount)
	b.totalLatencyMs.Add(c.totalLatencyMs)
	b.ttftSumMs.Add(c.ttftSumMs)
	b.ttftCount.Add(c.ttftCount)
	b.outputTokens.Add(c.outputTokens)
	b.generationMs.Add(c.generationMs)
}
