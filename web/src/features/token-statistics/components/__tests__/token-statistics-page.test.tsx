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
// Test scoping: this test exercises the preset-tab path — clicking the
// "14 Days" preset (a non-default value) and asserting the last recorded
// api call has a ~14 day span, proving click → range recompute → refetch.
// DatePicker calendar interaction is NOT driven here: happy-dom makes
// calendar/portal DOM interaction unreliable, and the custom-date path is
// covered by typecheck plus the shared DatePicker component's own coverage.
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'

import type { ApiRequestConfig } from '@/lib/api'
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
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { TokenStatisticsPage } = await import('../../token-statistics-page')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        '1 Day': '1 Day',
        '7 Days': '7 Days',
        '14 Days': '14 Days',
        '29 Days': '29 Days',
        'Start Time': 'Start Time',
        'End Time': 'End Time',
        'Top Users': 'Top Users',
        'Top {{count}}': 'Top {{count}}',
        'Pick a date': 'Pick a date',
        'User Token Usage Ranking': 'User Token Usage Ranking',
        'Group Token Usage Ranking': 'Group Token Usage Ranking',
        'User Channel Token Usage': 'User Channel Token Usage',
        'Group Channel Token Usage': 'Group Channel Token Usage',
        Username: 'Username',
        Group: 'Group',
        'Token Used': 'Token Used',
        Quota: 'Quota',
        Requests: 'Requests',
        Users: 'Users',
        'No data': 'No data',
        'All Channels': 'All Channels',
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
// 这里记录的是线上等价参数。所有端点立即返回空成功响应。
// ============================================================================

type ApiResponse = { data: { success: boolean; data: unknown[] } }
type RecordedCall = { url: string; params: Record<string, unknown> }

const calls: RecordedCall[] = []

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
  return Promise.resolve({ data: { success: true, data: [] } })
}) as typeof api.get

before(() => {
  api.get = stubGet
})

beforeEach(() => {
  calls.length = 0
})

after(() => {
  api.get = originalGet
  domWindow.close()
})

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve()
  })
}

const TARGET_SECONDS = 14 * 24 * 60 * 60
const TOLERANCE_SECONDS = 1000

function assertSpan(call: RecordedCall) {
  const start = Number(call.params.start_timestamp)
  const end = Number(call.params.end_timestamp)
  const span = end - start
  assert.ok(
    span > TARGET_SECONDS - TOLERANCE_SECONDS &&
      span < TARGET_SECONDS + TOLERANCE_SECONDS,
    `${call.url} span ${span}s not within 14 days ± ${TOLERANCE_SECONDS}s`
  )
}

describe('token statistics page', () => {
  test('clicking the 14 Days preset fires queries with a ~14 day span', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <TokenStatisticsPage />
          </I18nextProvider>
        </QueryClientProvider>
      )
    })
    await flushAsyncUpdates()

    // 点击 "14 Days" 预设 trigger（非默认值，确保点击触发区间重算）
    const triggers = [...container.querySelectorAll('button')]
    const fourteenDaysTrigger = triggers.find((button) =>
      (button.textContent ?? '').includes('14 Days')
    )
    assert.ok(fourteenDaysTrigger, '14 Days preset trigger not found')
    await act(async () => fourteenDaysTrigger.click())
    await flushAsyncUpdates()

    // getUserQuotaSummary (/api/data/users/summary) 末次调用的区间跨度 ≈ 14 天
    const summaryCalls = calls.filter(
      (call) => call.url === '/api/data/users/summary'
    )
    assert.ok(summaryCalls.length > 0, 'user summary was not requested')
    assertSpan(summaryCalls.at(-1)!)

    // getChannelUsageSummaries (/api/data/channels) 末次调用的区间跨度 ≈ 14 天
    const channelCalls = calls.filter(
      (call) => call.url === '/api/data/channels'
    )
    assert.ok(channelCalls.length > 0, 'channel usage was not requested')
    assertSpan(channelCalls.at(-1)!)

    await act(async () => root.unmount())
    container.remove()
  })
})
