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
        { username: 'bob', use_group: '', model_name: 'claude', token_used: 500 },
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 300 },
        { username: 'bob', use_group: '', model_name: 'gpt-4', token_used: 100 },
        { username: 'alice', use_group: '', model_name: 'claude', token_used: 200 },
        { username: 'erin', use_group: '', model_name: 'gpt-4', token_used: 50 },
      ],
      2
    )

    // 行按总量降序取前 2：bob(600) > alice(500)，erin 被截断
    expect(matrix.rowLabels).toEqual(['bob', 'alice'])
    // 列按模型总量降序：claude(700) > gpt-4(450)
    expect(matrix.columnLabels).toEqual(['claude', 'gpt-4'])
    // cells[r][c] 与行列对应：bob×claude=500, bob×gpt-4=100, alice×claude=200, alice×gpt-4=300
    expect(matrix.cells).toEqual([
      [500, 100],
      [200, 300],
    ])
    expect(matrix.maxValue).toBe(500)
  })

  test('fills zero for missing user-model pairs', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 100 },
        { username: 'bob', use_group: '', model_name: 'claude', token_used: 200 },
      ],
      10
    )

    expect(matrix.rowLabels).toEqual(['bob', 'alice'])
    expect(matrix.columnLabels).toEqual(['claude', 'gpt-4'])
    // bob×claude=200, bob×gpt-4=0, alice×claude=0, alice×gpt-4=100
    expect(matrix.cells).toEqual([
      [200, 0],
      [0, 100],
    ])
    expect(matrix.maxValue).toBe(200)
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
        { username: '', use_group: 'vip', model_name: 'gpt-4', token_used: 400 },
        { username: '', use_group: 'default', model_name: 'gpt-4', token_used: 100 },
      ],
      10
    )
    expect(matrix.rowLabels).toEqual(['vip', 'default'])
    expect(matrix.cells).toEqual([[400], [100]])
  })

  test('prefers username over use_group as the row key', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: 'vip', model_name: 'gpt-4', token_used: 100 },
      ],
      10
    )
    expect(matrix.rowLabels).toEqual(['alice'])
    expect(matrix.columnLabels).toEqual(['gpt-4'])
  })

  test('accumulates token_used across duplicate row-model pairs', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 100 },
        { username: 'alice', use_group: '', model_name: 'gpt-4', token_used: 250 },
      ],
      10
    )
    expect(matrix.rowLabels).toEqual(['alice'])
    expect(matrix.columnLabels).toEqual(['gpt-4'])
    expect(matrix.cells).toEqual([[350]])
    expect(matrix.maxValue).toBe(350)
  })

  test('keeps all columns sorted by total descending', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'alice', use_group: '', model_name: 'a-model', token_used: 10 },
        { username: 'alice', use_group: '', model_name: 'b-model', token_used: 500 },
        { username: 'alice', use_group: '', model_name: 'c-model', token_used: 100 },
      ],
      10
    )
    expect(matrix.columnLabels).toEqual(['b-model', 'c-model', 'a-model'])
  })

  test('keeps rows sorted by total descending after top-N truncation', () => {
    const matrix = buildModelHeatmap(
      [
        { username: 'a', use_group: '', model_name: 'm', token_used: 10 },
        { username: 'b', use_group: '', model_name: 'm', token_used: 500 },
        { username: 'c', use_group: '', model_name: 'm', token_used: 100 },
        { username: 'd', use_group: '', model_name: 'm', token_used: 300 },
      ],
      2
    )
    // 行按总量降序取前 2：b(500) > d(300)
    expect(matrix.rowLabels).toEqual(['b', 'd'])
  })
})
