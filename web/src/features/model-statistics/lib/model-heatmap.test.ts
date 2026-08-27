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
import { describe, expect, test } from 'vitest'

import { buildModelHeatmap } from './model-heatmap'

describe('buildModelHeatmap', () => {
  test('builds sorted matrix with top-N rows and sorted columns', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'bob', use_group: '', model_name: 'claude', token_used: 50000 },
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 30000 },
        { username: 'bob', use_group: '', model_name: 'gpt-4', token_used: 10000 },
        { username: 'alice', use_group: '', model_name: 'claude', token_used: 20000 },
        { username: 'erin', use_group: '', model_name: 'gpt-4', token_used: 5000 },
      ],
      2
    )
    // 行按保留列总量降序取前 2：bob(60000) > alice(50000)，erin 被截断
    expect(matrix.rowLabels).toEqual(['bob', 'alice'])
    // 列按总量降序：claude(70000) > gpt-4(45000)
    expect(matrix.columnLabels).toEqual(['claude', 'gpt-4'])
    expect(matrix.cells).toEqual([
      [50000, 10000],
      [20000, 30000],
    ])
    expect(matrix.maxValue).toBe(50000)
  })

  test('fills zero for missing user-model pairs', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 10000 },
        { username: 'bob', use_group: '', model_name: 'claude', token_used: 20000 },
      ],
      10
    )
    expect(matrix.rowLabels).toEqual(['bob', 'alice'])
    expect(matrix.columnLabels).toEqual(['claude', 'gpt-4'])
    expect(matrix.cells).toEqual([
      [20000, 0],
      [0, 10000],
    ])
    expect(matrix.maxValue).toBe(20000)
  })

  test('returns empty matrix for empty input', () => {
    const matrix = buildModelHeatmap([], 10)
    expect(matrix.rowLabels).toEqual([])
    expect(matrix.columnLabels).toEqual([])
    expect(matrix.cells).toEqual([])
    expect(matrix.maxValue).toBe(0)
  })

  test('uses use_group as the row key when username is empty', () => {
    const matrix = buildModelHeatmap(
      [
        { username: '', use_group: 'vip', model_name: 'gpt-4', token_used: 40000 },
        { username: '', use_group: 'default', model_name: 'gpt-4', token_used: 10000 },
      ],
      10
    )
    expect(matrix.rowLabels).toEqual(['vip', 'default'])
    expect(matrix.cells).toEqual([[40000], [10000]])
  })

  test('prefers username over use_group as the row key', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: 'vip', model_name: 'gpt-4', token_used: 10000 },
      ],
      10
    )
    expect(matrix.rowLabels).toEqual(['alice'])
    expect(matrix.columnLabels).toEqual(['gpt-4'])
  })

  test('accumulates token_used across duplicate row-model pairs', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 10000 },
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 25000 },
      ],
      10
    )
    expect(matrix.rowLabels).toEqual(['alice'])
    expect(matrix.columnLabels).toEqual(['gpt-4'])
    expect(matrix.cells).toEqual([[35000]])
    expect(matrix.maxValue).toBe(35000)
  })

  test('keeps all columns sorted by total descending', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'a-model', token_used: 10000 },
        { username: 'alice', use_group: '', model_name: 'b-model', token_used: 50000 },
        { username: 'alice', use_group: '', model_name: 'c-model', token_used: 20000 },
      ],
      10
    )
    expect(matrix.columnLabels).toEqual(['b-model', 'c-model', 'a-model'])
  })

  test('keeps rows sorted by total descending after top-N truncation', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'a', use_group: '', model_name: 'm', token_used: 10000 },
        { username: 'b', use_group: '', model_name: 'm', token_used: 50000 },
        { username: 'c', use_group: '', model_name: 'm', token_used: 20000 },
        { username: 'd', use_group: '', model_name: 'm', token_used: 30000 },
      ],
      2
    )
    expect(matrix.rowLabels).toEqual(['b', 'd'])
  })

  test('filters out models below the token threshold', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'big', token_used: 50000 },
        { username: 'alice', use_group: '', model_name: 'small', token_used: 5000 },
      ],
      10
    )
    // small (5000) < 10K 被排除，只保留 big 列
    expect(matrix.columnLabels).toEqual(['big'])
    expect(matrix.cells).toEqual([[50000]])
  })

  test('filters out models with zero usage', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'zero', token_used: 0 },
      ],
      10
    )
    // 0 < 10K，列被排除，无列可显示 → 空矩阵
    expect(matrix.columnLabels).toEqual([])
    expect(matrix.rowLabels).toEqual([])
    expect(matrix.cells).toEqual([])
  })
})
