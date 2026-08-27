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
import type { ChannelHeatmapMatrix } from '@/features/token-statistics/lib/channel-heatmap'

import type { ModelDimensionTokenUsage } from '../types'

// 把扁平的 (用户/分组 × 模型) token 用量行构建成热力图矩阵：
// 行按跨模型总量降序取前 topLimit，列按跨行总量降序，单元格为该行×该列 token_used（缺失为 0）。
export function buildModelHeatmap(
  rows: ModelDimensionTokenUsage[],
  topLimit: number
): ChannelHeatmapMatrix {
  // 行键：按人填 username，按分组填 use_group
  const rowKey = (row: ModelDimensionTokenUsage): string =>
    row.username || row.use_group

  // 列：模型名直接作列名，无需 id→name 映射
  // 行聚合：rowKey → 总量；列聚合：model_name → 总量
  const rowTotals = new Map<string, number>()
  const columnTotals = new Map<string, number>()
  const valueByKey = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const key = rowKey(row)
    const model = row.model_name
    const value = row.token_used
    rowTotals.set(key, (rowTotals.get(key) ?? 0) + value)
    columnTotals.set(model, (columnTotals.get(model) ?? 0) + value)
    let valueMap = valueByKey.get(key)
    if (!valueMap) {
      valueMap = new Map()
      valueByKey.set(key, valueMap)
    }
    valueMap.set(model, (valueMap.get(model) ?? 0) + value)
  }

  // 行按总量降序取前 topLimit；列按总量降序
  const rowLabels = [...rowTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)
    .map(([key]) => key)
  const columnLabels = [...columnTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  const cells = rowLabels.map((key) =>
    columnLabels.map((model) => valueByKey.get(key)?.get(model) ?? 0)
  )
  const maxValue = cells.reduce(
    (max, cellRow) =>
      cellRow.reduce((rowMax, value) => Math.max(rowMax, value), max),
    0
  )
  return { rowLabels, columnLabels, cells, maxValue }
}
