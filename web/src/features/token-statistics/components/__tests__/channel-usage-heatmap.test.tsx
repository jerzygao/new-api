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
import { render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')

const { ChannelUsageHeatmap, heatmapCellStyle } =
  await import('../channel-usage-heatmap')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'User Channel Token Usage': 'User Channel Token Usage',
        Username: 'Username',
        'No data': 'No data',
      },
    },
  },
})

type RenderedCard = ReturnType<typeof render>

function renderCard(
  props: ComponentProps<typeof ChannelUsageHeatmap>
): RenderedCard {
  return render(
    <I18nextProvider i18n={i18n}>
      <ChannelUsageHeatmap {...props} />
    </I18nextProvider>
  )
}

function textOf(rendered: RenderedCard): string {
  return (rendered.container.textContent ?? '').replaceAll(/\s+/g, ' ')
}

describe('channel usage heatmap', () => {
  test('renders row labels, column labels and cell values', () => {
    const rendered = renderCard({
      titleKey: 'User Channel Token Usage',
      icon: null,
      rowHeaderKey: 'Username',
      emptyText: 'No data',
      matrix: {
        rowLabels: ['bob', 'alice'],
        columnLabels: ['Claude', 'OpenAI'],
        cells: [
          [500, 100],
          [200, 300],
        ],
        maxValue: 500,
      },
    })

    const text = textOf(rendered)
    expect(text.includes('User Channel Token Usage')).toBe(true)
    expect(text.includes('bob') && text.includes('alice')).toBe(true)
    expect(text.includes('Claude') && text.includes('OpenAI')).toBe(true)
    // 单元格数值以格式化后文本渲染
    expect(text.includes('500') && text.includes('300')).toBe(true)
  })

  test('shows empty text when there are no rows', () => {
    const rendered = renderCard({
      titleKey: 'User Channel Token Usage',
      icon: null,
      rowHeaderKey: 'Username',
      emptyText: 'No data',
      matrix: { rowLabels: [], columnLabels: [], cells: [], maxValue: 0 },
    })

    expect(textOf(rendered).includes('No data')).toBe(true)
  })

  test('renders skeleton rows while loading', () => {
    const rendered = renderCard({
      titleKey: 'User Channel Token Usage',
      icon: null,
      rowHeaderKey: 'Username',
      emptyText: 'No data',
      matrix: { rowLabels: [], columnLabels: [], cells: [], maxValue: 0 },
      isLoading: true,
    })

    // loading 时渲染骨架而非空态
    const text = textOf(rendered)
    expect(text.includes('No data')).toBe(false)
    // 5 行骨架行
    expect(rendered.container.querySelectorAll('tbody tr')).toHaveLength(5)
  })
})

describe('heatmapCellStyle', () => {
  test('scales alpha by value ratio with a floor', () => {
    expect(heatmapCellStyle(0, 500)).toEqual({})
    expect(heatmapCellStyle(500, 500)).toEqual({
      backgroundColor: 'rgba(59, 130, 246, 0.85)',
    })
    // 最小值下限 0.08；低于 8% 的值用 0.08
    expect(heatmapCellStyle(10, 500)).toEqual({
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
    })
    // maxValue <= 0 不着色
    expect(heatmapCellStyle(100, 0)).toEqual({})
  })
})
