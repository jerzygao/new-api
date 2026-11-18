package channelperf

import (
	"math"
	"slices"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

var hotBuckets sync.Map

func Init() {
	if err := model.AutoMigrateChannelPerf(); err != nil {
		common.SysError("channel_perf: failed to auto migrate: " + err.Error())
	}
	go flushLoop()
}

func RecordRelaySample(info *relaycommon.RelayInfo, success bool, outputTokens int64) {
	if info == nil {
		return
	}
	now := time.Now()
	hasTtft := info.IsStream && info.HasSendResponse()
	ttftMs := int64(0)
	if hasTtft {
		ttftMs = info.FirstResponseTime.Sub(info.StartTime).Milliseconds()
	}
	latencyMs := now.Sub(info.StartTime).Milliseconds()
	generationMs := latencyMs
	if hasTtft {
		generationMs = now.Sub(info.FirstResponseTime).Milliseconds()
	}
	if generationMs <= 0 {
		generationMs = latencyMs
	}
	Record(Sample{
		Model:        info.OriginModelName,
		ChannelId:    info.GetChannelID(),
		LatencyMs:    latencyMs,
		TtftMs:       ttftMs,
		HasTtft:      hasTtft,
		Success:      success,
		OutputTokens: outputTokens,
		GenerationMs: generationMs,
	})
}

func Record(sample Sample) {
	setting := perf_metrics_setting.GetSetting()
	if !setting.Enabled || sample.Model == "" {
		return
	}
	if sample.LatencyMs < 0 {
		sample.LatencyMs = 0
	}
	key := bucketKey{
		model:     sample.Model,
		channelId: sample.ChannelId,
		bucketTs:  bucketStart(time.Now().Unix()),
	}
	actual, _ := hotBuckets.LoadOrStore(key, &atomicBucket{})
	actual.(*atomicBucket).add(sample)
}

func QuerySummary(params QueryParams) (SummaryResult, error) {
	params, startTs, endTs := normalizeQueryWindow(params)
	totals, err := loadSummaryTotals(params, startTs, endTs)
	if err != nil {
		return SummaryResult{}, err
	}

	summaries := make([]ChannelModelSummary, 0, len(totals))
	for k, total := range totals {
		if total.requestCount == 0 {
			continue
		}
		summaries = append(summaries, ChannelModelSummary{
			ChannelId:    k.channelId,
			ModelName:    k.model,
			AvgLatencyMs: avgInt64(total.totalLatencyMs, total.requestCount),
			AvgTtftMs:    avgInt64(total.ttftSumMs, total.ttftCount),
			SuccessRate:  successRate(total),
			AvgTps:       avgTps(total),
			RequestCount: total.requestCount,
		})
	}
	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].RequestCount > summaries[j].RequestCount
	})
	return SummaryResult{Summaries: summaries}, nil
}

func QueryModelSummary(params QueryParams) (ModelSummaryResult, error) {
	params, startTs, endTs := normalizeQueryWindow(params)
	params.ChannelId = 0
	modelFilter := params.Model
	params.Model = ""
	totals, err := loadSummaryTotals(params, startTs, endTs)
	if err != nil {
		return ModelSummaryResult{}, err
	}
	return collapseSummaryByModel(totals, modelFilter), nil
}

func QuerySeries(params QueryParams) (SeriesResult, error) {
	params, startTs, endTs := normalizeQueryWindow(params)
	bucketTotals, err := loadSeriesBuckets(params, startTs, endTs)
	if err != nil {
		return SeriesResult{}, err
	}

	bySeries := map[chanModelKey][]BucketPoint{}
	seriesTotals := map[chanModelKey]counters{}
	for k, total := range bucketTotals {
		if total.requestCount == 0 {
			continue
		}
		mk := chanModelKey{channelId: k.channelId, model: k.model}
		bySeries[mk] = append(bySeries[mk], BucketPoint{
			Ts:           k.bucketTs,
			AvgTtftMs:    avgInt64(total.ttftSumMs, total.ttftCount),
			AvgLatencyMs: avgInt64(total.totalLatencyMs, total.requestCount),
			SuccessRate:  successRate(total),
			AvgTps:       avgTps(total),
		})
		seriesTotals[mk] = addCounters(seriesTotals[mk], total)
	}

	items := make([]ChannelModelSeries, 0, len(bySeries))
	for mk, points := range bySeries {
		sort.Slice(points, func(i, j int) bool {
			return points[i].Ts < points[j].Ts
		})
		total := seriesTotals[mk]
		items = append(items, ChannelModelSeries{
			ChannelId:    mk.channelId,
			ModelName:    mk.model,
			AvgLatencyMs: avgInt64(total.totalLatencyMs, total.requestCount),
			AvgTtftMs:    avgInt64(total.ttftSumMs, total.ttftCount),
			SuccessRate:  successRate(total),
			AvgTps:       avgTps(total),
			RequestCount: total.requestCount,
			Series:       points,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].RequestCount > items[j].RequestCount
	})
	return SeriesResult{Items: items}, nil
}

func QueryModelSeries(params QueryParams) (ModelSeriesResult, error) {
	params, startTs, endTs := normalizeQueryWindow(params)
	params.ChannelId = 0
	modelFilter := params.Model
	params.Model = ""
	bucketTotals, err := loadSeriesBuckets(params, startTs, endTs)
	if err != nil {
		return ModelSeriesResult{}, err
	}
	return collapseSeriesByModel(bucketTotals, modelFilter), nil
}

func normalizeQueryWindow(params QueryParams) (QueryParams, int64, int64) {
	if params.Hours <= 0 {
		params.Hours = 24
	}
	if params.Hours > 24*30 {
		params.Hours = 24 * 30
	}
	endTs := time.Now().Unix()
	startTs := endTs - int64(params.Hours)*3600
	return params, startTs, endTs
}

func loadSummaryTotals(params QueryParams, startTs int64, endTs int64) (map[chanModelKey]counters, error) {
	channelIds := []int{}
	if params.ChannelId > 0 {
		channelIds = []int{params.ChannelId}
	}

	rows, err := model.GetChannelPerfMetricsSummary(startTs, endTs, channelIds, params.Model)
	if err != nil {
		return nil, err
	}

	totals := map[chanModelKey]counters{}
	for _, row := range rows {
		k := chanModelKey{channelId: row.ChannelId, model: row.ModelName}
		totals[k] = addCounters(totals[k], counters{
			requestCount:   row.RequestCount,
			successCount:   row.SuccessCount,
			totalLatencyMs: row.TotalLatencyMs,
			ttftSumMs:      row.TtftSumMs,
			ttftCount:      row.TtftCount,
			outputTokens:   row.OutputTokens,
			generationMs:   row.GenerationMs,
		})
	}
	mergeHotIntoTotals(totals, params, startTs, endTs)
	return totals, nil
}

func loadSeriesBuckets(params QueryParams, startTs int64, endTs int64) (map[chanModelBucketKey]counters, error) {
	channelIds := []int{}
	if params.ChannelId > 0 {
		channelIds = []int{params.ChannelId}
	}

	rows, err := model.GetChannelPerfMetricBuckets(startTs, endTs, channelIds, params.Model)
	if err != nil {
		return nil, err
	}

	bucketTotals := map[chanModelBucketKey]counters{}
	for _, row := range rows {
		k := chanModelBucketKey{channelId: row.ChannelId, model: row.ModelName, bucketTs: row.BucketTs}
		bucketTotals[k] = addCounters(bucketTotals[k], counters{
			requestCount:   row.RequestCount,
			successCount:   row.SuccessCount,
			totalLatencyMs: row.TotalLatencyMs,
			ttftSumMs:      row.TtftSumMs,
			ttftCount:      row.TtftCount,
			outputTokens:   row.OutputTokens,
			generationMs:   row.GenerationMs,
		})
	}

	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.bucketTs < startTs || k.bucketTs > endTs {
			return true
		}
		if params.Model != "" && k.model != params.Model {
			return true
		}
		if params.ChannelId > 0 && k.channelId != params.ChannelId {
			return true
		}
		bk := chanModelBucketKey{channelId: k.channelId, model: k.model, bucketTs: k.bucketTs}
		bucketTotals[bk] = addCounters(bucketTotals[bk], value.(*atomicBucket).snapshot())
		return true
	})
	return bucketTotals, nil
}

func collapseSummaryByModel(totals map[chanModelKey]counters, modelFilter string) ModelSummaryResult {
	byModel := map[string]counters{}
	for k, total := range totals {
		if total.requestCount == 0 {
			continue
		}
		byModel[k.model] = addCounters(byModel[k.model], total)
	}

	models := make([]string, 0, len(byModel))
	for modelName := range byModel {
		models = append(models, modelName)
	}
	slices.Sort(models)

	summaries := make([]ModelSummary, 0, len(byModel))
	for modelName, total := range byModel {
		if modelFilter != "" && modelName != modelFilter {
			continue
		}
		summaries = append(summaries, ModelSummary{
			ModelName:    modelName,
			AvgLatencyMs: avgInt64(total.totalLatencyMs, total.requestCount),
			AvgTtftMs:    avgInt64(total.ttftSumMs, total.ttftCount),
			SuccessRate:  successRate(total),
			AvgTps:       avgTps(total),
			RequestCount: total.requestCount,
		})
	}
	sort.Slice(summaries, func(i, j int) bool {
		if summaries[i].RequestCount == summaries[j].RequestCount {
			return summaries[i].ModelName < summaries[j].ModelName
		}
		return summaries[i].RequestCount > summaries[j].RequestCount
	})
	return ModelSummaryResult{Summaries: summaries, Models: models}
}

func collapseSeriesByModel(bucketTotals map[chanModelBucketKey]counters, modelFilter string) ModelSeriesResult {
	byModel := map[string]counters{}
	byPoint := map[modelBucketKey]counters{}
	for k, total := range bucketTotals {
		if total.requestCount == 0 {
			continue
		}
		byModel[k.model] = addCounters(byModel[k.model], total)
		pk := modelBucketKey{model: k.model, bucketTs: k.bucketTs}
		byPoint[pk] = addCounters(byPoint[pk], total)
	}

	pointsByModel := map[string][]BucketPoint{}
	for pk, total := range byPoint {
		if modelFilter != "" && pk.model != modelFilter {
			continue
		}
		pointsByModel[pk.model] = append(pointsByModel[pk.model], BucketPoint{
			Ts:           pk.bucketTs,
			AvgTtftMs:    avgInt64(total.ttftSumMs, total.ttftCount),
			AvgLatencyMs: avgInt64(total.totalLatencyMs, total.requestCount),
			SuccessRate:  successRate(total),
			AvgTps:       avgTps(total),
		})
	}

	items := make([]ModelSeries, 0, len(byModel))
	for modelName, total := range byModel {
		if modelFilter != "" && modelName != modelFilter {
			continue
		}
		points := pointsByModel[modelName]
		if points == nil {
			points = []BucketPoint{}
		}
		sort.Slice(points, func(i, j int) bool {
			return points[i].Ts < points[j].Ts
		})
		items = append(items, ModelSeries{
			ModelName:    modelName,
			AvgLatencyMs: avgInt64(total.totalLatencyMs, total.requestCount),
			AvgTtftMs:    avgInt64(total.ttftSumMs, total.ttftCount),
			SuccessRate:  successRate(total),
			AvgTps:       avgTps(total),
			RequestCount: total.requestCount,
			Series:       points,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].RequestCount == items[j].RequestCount {
			return items[i].ModelName < items[j].ModelName
		}
		return items[i].RequestCount > items[j].RequestCount
	})
	return ModelSeriesResult{Items: items}
}

func mergeHotIntoTotals(totals map[chanModelKey]counters, params QueryParams, startTs int64, endTs int64) {
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.bucketTs < startTs || k.bucketTs > endTs {
			return true
		}
		if params.Model != "" && k.model != params.Model {
			return true
		}
		if params.ChannelId > 0 && k.channelId != params.ChannelId {
			return true
		}
		mk := chanModelKey{channelId: k.channelId, model: k.model}
		totals[mk] = addCounters(totals[mk], value.(*atomicBucket).snapshot())
		return true
	})
}

func bucketStart(ts int64) int64 {
	bucket := perf_metrics_setting.GetBucketSeconds()
	if bucket <= 0 {
		bucket = 3600
	}
	return ts - (ts % bucket)
}

func avgInt64(sum int64, count int64) int64 {
	if count <= 0 {
		return 0
	}
	return sum / count
}

func successRate(c counters) float64 {
	if c.requestCount <= 0 {
		return 0
	}
	return round2(float64(c.successCount) / float64(c.requestCount) * 100)
}

func avgTps(c counters) float64 {
	if c.generationMs <= 0 {
		return 0
	}
	return round2(float64(c.outputTokens) / (float64(c.generationMs) / 1000.0))
}

func round2(f float64) float64 {
	return math.Round(f*100) / 100
}

type chanModelBucketKey struct {
	channelId int
	model     string
	bucketTs  int64
}

type modelBucketKey struct {
	model    string
	bucketTs int64
}
