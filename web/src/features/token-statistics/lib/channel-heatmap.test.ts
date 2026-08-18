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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildChannelHeatmap } from './channel-heatmap'

describe('buildChannelHeatmap', () => {
  test('builds sorted matrix with top-N rows and sorted columns', () => {
    const matrix = buildChannelHeatmap(
      [
        { username: 'bob', channel_id: 2, channel_name: 'Claude', token_used: 500 },
        { username: 'alice', channel_id: 1, channel_name: 'OpenAI', token_used: 300 },
        { username: 'bob', channel_id: 1, channel_name: 'OpenAI', token_used: 100 },
        { username: 'alice', channel_id: 2, channel_name: 'Claude', token_used: 200 },
        { username: 'erin', channel_id: 1, channel_name: 'OpenAI', token_used: 50 },
      ],
      2
    )

    // 行按总量降序取前 2：bob(600) > alice(500)，erin 被截断
    assert.deepEqual(matrix.rowLabels, ['bob', 'alice'])
    // 列按渠道总量降序：Claude(700) > OpenAI(450)
    assert.deepEqual(matrix.columnLabels, ['Claude', 'OpenAI'])
    // cells[r][c] 与行列对应：bob×Claude=500, bob×OpenAI=100, alice×Claude=200, alice×OpenAI=300
    assert.deepEqual(matrix.cells, [
      [500, 100],
      [200, 300],
    ])
    assert.equal(matrix.maxValue, 500)
  })

  test('fills zero for missing user-channel pairs', () => {
    const matrix = buildChannelHeatmap(
      [
        { username: 'alice', channel_id: 1, channel_name: 'OpenAI', token_used: 100 },
        { username: 'bob', channel_id: 2, channel_name: 'Claude', token_used: 200 },
      ],
      10
    )

    assert.deepEqual(matrix.rowLabels, ['bob', 'alice'])
    assert.deepEqual(matrix.columnLabels, ['Claude', 'OpenAI'])
    // bob×Claude=200, bob×OpenAI=0, alice×Claude=0, alice×OpenAI=100
    assert.deepEqual(matrix.cells, [
      [200, 0],
      [0, 100],
    ])
    assert.equal(matrix.maxValue, 200)
  })

  test('returns empty matrix for empty input', () => {
    const matrix = buildChannelHeatmap([], 10)
    assert.deepEqual(matrix.rowLabels, [])
    assert.deepEqual(matrix.columnLabels, [])
    assert.deepEqual(matrix.cells, [])
    assert.equal(matrix.maxValue, 0)
  })

  test('groups use use_group as the row key', () => {
    const matrix = buildChannelHeatmap(
      [
        { use_group: 'vip', channel_id: 1, channel_name: 'OpenAI', token_used: 400 },
        { use_group: 'default', channel_id: 1, channel_name: 'OpenAI', token_used: 100 },
      ],
      10
    )
    assert.deepEqual(matrix.rowLabels, ['vip', 'default'])
    assert.deepEqual(matrix.cells, [[400], [100]])
  })

  test('falls back to channel_id when channel_name is missing', () => {
    const matrix = buildChannelHeatmap(
      [{ username: 'alice', channel_id: 7, token_used: 100 }],
      10
    )
    assert.deepEqual(matrix.columnLabels, ['7'])
  })
})
