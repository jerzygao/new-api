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
import type { ChannelDimensionTokenUsage } from '@/features/dashboard/types'

export interface ChannelHeatmapMatrix {
  rowLabels: string[]
  columnLabels: string[]
  cells: number[][]
  maxValue: number
}

// 把扁平的 (用户/分组 × 渠道) token 用量行构建成热力图矩阵：
// 行按跨渠道总量降序取前 topLimit，列按跨行总量降序，单元格为该行×该列 token_used（缺失为 0）。
export function buildChannelHeatmap(
  rows: ChannelDimensionTokenUsage[],
  topLimit: number
): ChannelHeatmapMatrix {
  // 行键：按人填 username，按分组填 use_group
  const rowKey = (row: ChannelDimensionTokenUsage): string =>
    row.username || row.use_group || ''

  // 列：以 channel_id 为键，渠道名取第一条出现（缺失回退为 id 字符串）
  const columnNameByID = new Map<number, string>()
  for (const row of rows) {
    if (!columnNameByID.has(row.channel_id ?? 0)) {
      columnNameByID.set(row.channel_id ?? 0, row.channel_name ?? String(row.channel_id ?? 0))
    }
  }

  // 行聚合：rowKey → 总量；列聚合：channel_id → 总量
  const rowTotals = new Map<string, number>()
  const columnTotals = new Map<number, number>()
  const valueByKey = new Map<string, Map<number, number>>()
  for (const row of rows) {
    const key = rowKey(row)
    const channelId = row.channel_id ?? 0
    const value = row.token_used ?? 0
    rowTotals.set(key, (rowTotals.get(key) ?? 0) + value)
    columnTotals.set(channelId, (columnTotals.get(channelId) ?? 0) + value)
    let valueMap = valueByKey.get(key)
    if (!valueMap) {
      valueMap = new Map()
      valueByKey.set(key, valueMap)
    }
    valueMap.set(channelId, (valueMap.get(channelId) ?? 0) + value)
  }

  // 行按总量降序取前 topLimit；列按总量降序
  const rowLabels = [...rowTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)
    .map(([key]) => key)
  const columnIDs = [...columnTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
  const columnLabels = columnIDs.map((id) => columnNameByID.get(id) ?? String(id))

  const cells = rowLabels.map((key) =>
    columnIDs.map((channelId) => valueByKey.get(key)?.get(channelId) ?? 0)
  )
  const maxValue = cells.reduce(
    (max, cellRow) =>
      cellRow.reduce((rowMax, value) => Math.max(rowMax, value), max),
    0
  )
  return { rowLabels, columnLabels, cells, maxValue }
}
