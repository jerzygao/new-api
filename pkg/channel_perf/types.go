package channelperf

import "sync/atomic"

type Sample struct {
	Model        string
	ChannelId    int
	LatencyMs    int64
	TtftMs       int64
	HasTtft      bool
	Success      bool
	OutputTokens int64
	GenerationMs int64
}

type QueryParams struct {
	Hours     int
	ChannelId int
	Model     string
}

type ChannelModelSummary struct {
	ChannelId     int     `json:"channel_id"`
	ModelName     string  `json:"model_name"`
	AvgLatencyMs  int64   `json:"avg_latency_ms"`
	AvgTtftMs     int64   `json:"avg_ttft_ms"`
	SuccessRate   float64 `json:"success_rate"`
	AvgTps        float64 `json:"avg_tps"`
	RequestCount  int64   `json:"request_count"`
}

type BucketPoint struct {
	Ts           int64   `json:"ts"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
}

type ChannelModelSeries struct {
	ChannelId     int           `json:"channel_id"`
	ModelName     string        `json:"model_name"`
	AvgLatencyMs  int64         `json:"avg_latency_ms"`
	AvgTtftMs     int64         `json:"avg_ttft_ms"`
	SuccessRate   float64       `json:"success_rate"`
	AvgTps        float64       `json:"avg_tps"`
	RequestCount  int64         `json:"request_count"`
	Series        []BucketPoint `json:"series"`
}

type SummaryResult struct {
	Summaries []ChannelModelSummary `json:"summaries"`
}

type SeriesResult struct {
	Items []ChannelModelSeries `json:"items"`
}

type bucketKey struct {
	model     string
	channelId int
	bucketTs  int64
}

type counters struct {
	requestCount    int64
	successCount    int64
	totalLatencyMs  int64
	ttftSumMs       int64
	ttftCount       int64
	outputTokens    int64
	generationMs    int64
}

type atomicBucket struct {
	requestCount    atomic.Int64
	successCount    atomic.Int64
	totalLatencyMs  atomic.Int64
	ttftSumMs       atomic.Int64
	ttftCount       atomic.Int64
	outputTokens    atomic.Int64
	generationMs    atomic.Int64
}

func (b *atomicBucket) add(s Sample) {
	b.requestCount.Add(1)
	if s.Success {
		b.successCount.Add(1)
	}
	b.totalLatencyMs.Add(s.LatencyMs)
	if s.HasTtft {
		b.ttftSumMs.Add(s.TtftMs)
		b.ttftCount.Add(1)
	}
	if s.OutputTokens > 0 {
		b.outputTokens.Add(s.OutputTokens)
	}
	if s.GenerationMs > 0 {
		b.generationMs.Add(s.GenerationMs)
	}
}

func (b *atomicBucket) snapshot() counters {
	return counters{
		requestCount:   b.requestCount.Load(),
		successCount:   b.successCount.Load(),
		totalLatencyMs: b.totalLatencyMs.Load(),
		ttftSumMs:      b.ttftSumMs.Load(),
		ttftCount:      b.ttftCount.Load(),
		outputTokens:   b.outputTokens.Load(),
		generationMs:   b.generationMs.Load(),
	}
}

func (b *atomicBucket) drain() counters {
	return counters{
		requestCount:   b.requestCount.Swap(0),
		successCount:   b.successCount.Swap(0),
		totalLatencyMs: b.totalLatencyMs.Swap(0),
		ttftSumMs:      b.ttftSumMs.Swap(0),
		ttftCount:      b.ttftCount.Swap(0),
		outputTokens:   b.outputTokens.Swap(0),
		generationMs:   b.generationMs.Swap(0),
	}
}

func addCounters(a counters, b counters) counters {
	return counters{
		requestCount:   a.requestCount + b.requestCount,
		successCount:   a.successCount + b.successCount,
		totalLatencyMs: a.totalLatencyMs + b.totalLatencyMs,
		ttftSumMs:      a.ttftSumMs + b.ttftSumMs,
		ttftCount:      a.ttftCount + b.ttftCount,
		outputTokens:   a.outputTokens + b.outputTokens,
		generationMs:   a.generationMs + b.generationMs,
	}
}

type chanModelKey struct {
	channelId int
	model     string
}
