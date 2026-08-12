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
import { after, before, beforeEach, describe, test } from 'node:test'

import type { QueryClient as QueryClientType } from '@tanstack/react-query'
import { Window } from 'happy-dom'

import type { ApiRequestConfig } from '@/lib/api'

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
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { UserSummaryTable } = await import('../usage-summary-tables')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'User Token Usage Ranking': 'User Token Usage Ranking',
        'All Channels': 'All Channels',
        'No data': 'No data',
        Username: 'Username',
        'Token Used': 'Token Used',
        Quota: 'Quota',
        Requests: 'Requests',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

// ============================================================================
// api 传输边界打桩：替换共享 axios 实例的 get，让真实 queryFn 代码路径执行。
// 记录 (url, params)，并剔除 undefined 参数——axios 拼 URL 时丢弃 undefined，
// 这里记录的是线上等价参数。
// ============================================================================

type ApiResponse = { data: { success: boolean; data: unknown[] } }
type RecordedCall = { url: string; params: Record<string, unknown> }

const calls: RecordedCall[] = []
let channelsCallCount = 0
let channelsRequest: Promise<ApiResponse> | undefined
let resolveChannels: ((value: ApiResponse) => void) | undefined

const originalGet = api.get

const stubGet = ((
  url: string,
  config: ApiRequestConfig = {}
): Promise<ApiResponse> => {
  const params: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config.params ?? {})) {
    if (value !== undefined) {
      params[key] = value
    }
  }
  calls.push({ url, params })

  if (url === '/api/data/channels') {
    channelsCallCount += 1
    if (channelsCallCount > 1) {
      // 时间范围变化后的渠道查询：立即返回空选项，触发选中渠道回落
      return Promise.resolve({ data: { success: true, data: [] } })
    }
    channelsRequest ??= new Promise((resolve) => {
      resolveChannels = resolve
    })
    return channelsRequest
  }
  return Promise.resolve({ data: { success: true, data: [] } })
}) as typeof api.get

before(() => {
  api.get = stubGet
})

beforeEach(() => {
  calls.length = 0
  channelsCallCount = 0
  channelsRequest = undefined
  resolveChannels = undefined
})

after(() => {
  api.get = originalGet
  domWindow.close()
})

function summaryCalls(): RecordedCall[] {
  return calls.filter((call) => call.url === '/api/data/users/summary')
}

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve()
  })
}

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

function tableTree(queryClient: QueryClientType, selectedRange: number) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <UserSummaryTable selectedRange={selectedRange} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

async function renderTable(
  queryClient: QueryClientType,
  selectedRange: number
): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(tableTree(queryClient, selectedRange))
  })

  return { container, root }
}

async function rerenderTable(
  rendered: RenderedCard,
  queryClient: QueryClientType,
  selectedRange: number
) {
  await act(async () => {
    rendered.root.render(tableTree(queryClient, selectedRange))
  })
}

async function unmountTable(rendered: RenderedCard) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

async function selectChannelOption(rendered: RenderedCard, label: string) {
  const trigger = rendered.container.querySelector('button')
  assert.ok(trigger)
  await act(async () => trigger.click())
  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
  const option = options.find((el) => (el.textContent ?? '').includes(label))
  assert.ok(option)
  await act(async () => option.click())
}

describe('user summary table queries', () => {
  test('initial summary request omits channel_id (All Channels)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderTable(queryClient, 1)
    await flushAsyncUpdates()

    const calls = summaryCalls()
    assert.equal(calls.length, 1)
    assert.ok(!('channel_id' in calls[0].params))

    await unmountTable(rendered)
  })

  test('selecting a channel sends channel_id in the summary request', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderTable(queryClient, 1)

    // resolve 渠道选项 deferred，让下拉框出现 OpenAI 选项
    await act(async () => {
      resolveChannels?.({
        data: {
          success: true,
          data: [{ channel_id: 1, channel_name: 'OpenAI' }],
        },
      })
    })
    await flushAsyncUpdates()

    await selectChannelOption(rendered, 'OpenAI')
    await flushAsyncUpdates()

    const calls = summaryCalls()
    assert.equal(calls.length, 2)
    assert.equal(calls.at(-1)?.params.channel_id, 1)

    await unmountTable(rendered)
  })

  test('switching range falls back to All Channels when the selected channel is gone', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderTable(queryClient, 1)

    // 制造选中态：resolve 渠道选项 → 下拉 → 选中 OpenAI（channel_id = 1）
    await act(async () => {
      resolveChannels?.({
        data: {
          success: true,
          data: [{ channel_id: 1, channel_name: 'OpenAI' }],
        },
      })
    })
    await flushAsyncUpdates()
    await selectChannelOption(rendered, 'OpenAI')
    await flushAsyncUpdates()
    assert.equal(summaryCalls().at(-1)?.params.channel_id, 1)

    // 切换时间范围：新 timeRange 触发渠道查询 #2（立即返回空选项），
    // effectiveChannel 回落为 0，summary 请求不再携带 channel_id
    await rerenderTable(rendered, queryClient, 2)
    await flushAsyncUpdates()

    const calls = summaryCalls()
    assert.ok(calls.length >= 3)
    const lastSummaryCall = calls.at(-1)
    assert.ok(lastSummaryCall)
    assert.ok(!('channel_id' in lastSummaryCall.params))

    await unmountTable(rendered)
  })
})
