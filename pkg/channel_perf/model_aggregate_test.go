/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package channelperf

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCollapseSummaryByModelWeightsRequestsAndKeepsModelList(t *testing.T) {
	totals := map[chanModelKey]counters{
		{channelId: 7, model: "gpt"}: {
			requestCount: 1, successCount: 1, totalLatencyMs: 100,
			ttftSumMs: 40, ttftCount: 1, outputTokens: 100, generationMs: 1000,
		},
		{channelId: 8, model: "gpt"}: {
			requestCount: 3, successCount: 3, totalLatencyMs: 900,
			ttftSumMs: 60, ttftCount: 3, outputTokens: 300, generationMs: 3000,
		},
		{channelId: 9, model: "claude"}: {
			requestCount: 2, successCount: 1, totalLatencyMs: 200,
			ttftSumMs: 20, ttftCount: 2, outputTokens: 20, generationMs: 2000,
		},
	}

	result := collapseSummaryByModel(totals, "gpt")

	assert.Equal(t, []string{"claude", "gpt"}, result.Models)
	require.Len(t, result.Summaries, 1)
	row := result.Summaries[0]
	assert.Equal(t, "gpt", row.ModelName)
	assert.Equal(t, int64(4), row.RequestCount)
	assert.Equal(t, int64(250), row.AvgLatencyMs)
	assert.Equal(t, int64(25), row.AvgTtftMs)
	assert.Equal(t, 100.0, row.SuccessRate)
	assert.Equal(t, 100.0, row.AvgTps)

	encoded, err := common.Marshal(result)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "channel_id")
}

func TestCollapseSeriesByModelMergesSameTimestamp(t *testing.T) {
	buckets := map[chanModelBucketKey]counters{
		{channelId: 1, model: "gpt", bucketTs: 100}: {
			requestCount: 1, successCount: 1, totalLatencyMs: 100,
			ttftSumMs: 10, ttftCount: 1, outputTokens: 10, generationMs: 1000,
		},
		{channelId: 2, model: "gpt", bucketTs: 100}: {
			requestCount: 1, successCount: 0, totalLatencyMs: 300,
			ttftSumMs: 30, ttftCount: 1, outputTokens: 30, generationMs: 1000,
		},
		{channelId: 1, model: "gpt", bucketTs: 200}: {
			requestCount: 2, successCount: 2, totalLatencyMs: 400,
			ttftSumMs: 40, ttftCount: 2, outputTokens: 40, generationMs: 2000,
		},
	}

	result := collapseSeriesByModel(buckets, "")

	require.Len(t, result.Items, 1)
	item := result.Items[0]
	assert.Equal(t, "gpt", item.ModelName)
	assert.Equal(t, int64(4), item.RequestCount)
	assert.Equal(t, int64(200), item.AvgLatencyMs)
	require.Len(t, item.Series, 2)
	assert.Equal(t, int64(100), item.Series[0].Ts)
	assert.Equal(t, int64(200), item.Series[0].AvgLatencyMs)
	assert.Equal(t, int64(200), item.Series[1].Ts)

	encoded, err := common.Marshal(result)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "channel_id")
}
