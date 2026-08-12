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
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')

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

const { ChannelUsageHeatmap, heatmapCellStyle } =
  await import('../channel-usage-heatmap')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderCard(
  props: React.ComponentProps<typeof ChannelUsageHeatmap>
): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ChannelUsageHeatmap {...props} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountCard(rendered: RenderedCard) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

function textOf(rendered: RenderedCard): string {
  return (rendered.container.textContent ?? '').replaceAll(/\s+/g, ' ')
}

describe('channel usage heatmap', () => {
  after(() => {
    domWindow.close()
  })

  test('renders row labels, column labels and cell values', async () => {
    const rendered = await renderCard({
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
    assert.ok(text.includes('User Channel Token Usage'))
    assert.ok(text.includes('bob') && text.includes('alice'))
    assert.ok(text.includes('Claude') && text.includes('OpenAI'))
    // 单元格数值以格式化后文本渲染
    assert.ok(text.includes('500') && text.includes('300'))

    await unmountCard(rendered)
  })

  test('shows empty text when there are no rows', async () => {
    const rendered = await renderCard({
      titleKey: 'User Channel Token Usage',
      icon: null,
      rowHeaderKey: 'Username',
      emptyText: 'No data',
      matrix: { rowLabels: [], columnLabels: [], cells: [], maxValue: 0 },
    })

    assert.ok(textOf(rendered).includes('No data'))

    await unmountCard(rendered)
  })

  test('renders skeleton rows while loading', async () => {
    const rendered = await renderCard({
      titleKey: 'User Channel Token Usage',
      icon: null,
      rowHeaderKey: 'Username',
      emptyText: 'No data',
      matrix: { rowLabels: [], columnLabels: [], cells: [], maxValue: 0 },
      isLoading: true,
    })

    // loading 时渲染骨架而非空态
    const text = textOf(rendered)
    assert.ok(!text.includes('No data'))
    // 5 行骨架行
    assert.equal(rendered.container.querySelectorAll('tbody tr').length, 5)

    await unmountCard(rendered)
  })
})

describe('heatmapCellStyle', () => {
  test('scales alpha by value ratio with a floor', () => {
    assert.deepEqual(heatmapCellStyle(0, 500), {})
    assert.deepEqual(heatmapCellStyle(500, 500), {
      backgroundColor: 'rgba(59, 130, 246, 0.85)',
    })
    // 最小值下限 0.08；低于 8% 的值用 0.08
    assert.deepEqual(heatmapCellStyle(10, 500), {
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
    })
    // maxValue <= 0 不着色
    assert.deepEqual(heatmapCellStyle(100, 0), {})
  })
})
