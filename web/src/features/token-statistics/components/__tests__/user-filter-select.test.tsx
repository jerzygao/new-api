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
import { act, fireEvent } from '@testing-library/react'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'

import type { QueryClient as QueryClientType } from '@tanstack/react-query'

import type { ApiRequestConfig } from '@/lib/api'

const { createRoot } = await import('react-dom/client')
const { useState } = await import('react')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const {
  UserFilterSelect,
  filterUsers,
  groupUsers,
  getSelectionState,
  toggleUserId,
  toggleVisible,
} = await import('../user-filter-select')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'All Users': 'All Users',
        'Search users': 'Search users',
        'Select all': 'Select all',
        '{{count}} users selected': '{{count}} users selected',
        'No results found.': 'No results found.',
      },
    },
  },
})

// ============================================================================
// Test fixtures
// ============================================================================

const userOptions = [
  { id: 1, username: 'alice', display_name: 'Alice', group: 'default' },
  { id: 2, username: 'bob', display_name: 'Bob', group: 'default' },
  { id: 3, username: 'carol', display_name: 'Carol', group: 'vip' },
]

// ============================================================================
// api transport stub: replace shared axios instance get so real queryFn runs.
// ============================================================================

type ApiResponse = { data: { success: boolean; data: unknown[] } }

const calls: { ids: number[] }[] = []
const originalGet = api.get

const stubGet = ((
  url: string,
  _config: ApiRequestConfig = {}
): Promise<ApiResponse> => {
  if (url === '/api/user/options') {
    return Promise.resolve({
      data: { success: true, data: userOptions },
    })
  }
  return Promise.resolve({ data: { success: true, data: [] } })
}) as typeof api.get

beforeAll(() => {
  api.get = stubGet
})

afterAll(() => {
  api.get = originalGet
})

beforeEach(() => {
  calls.length = 0
})

// ============================================================================
// Helpers
// ============================================================================

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve()
  })
}

// Stateful wrapper that records onValueChange calls and updates value
function TestWrapper() {
  const [value, setValue] = useState<number[]>([])
  return (
    <UserFilterSelect
      value={value}
      onValueChange={(ids) => {
        calls.push({ ids })
        setValue(ids)
      }}
    />
  )
}

function renderTree(queryClient: QueryClientType) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TestWrapper />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderComponent(
  queryClient: QueryClientType
): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(renderTree(queryClient))
  })

  return { container, root }
}

async function unmountComponent(rendered: RenderedCard) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

async function openPopover(rendered: RenderedCard) {
  const trigger = rendered.container.querySelector('button')
  if (!trigger) {
    throw new Error('trigger button not found')
  }
  await act(async () => trigger.click())
}

async function clickOption(label: string) {
  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
  const option = options.find((el) => (el.textContent ?? '').includes(label))
  if (!option) {
    throw new Error(`option "${label}" not found`)
  }
  await act(async () => option.click())
}

// ============================================================================
// Pure function tests
// ============================================================================

describe('user filter pure functions', () => {
  const users = [
    { id: 1, username: 'alice', display_name: 'Alice', group: 'default' },
    { id: 2, username: 'bob', display_name: 'Bob', group: 'default' },
    { id: 3, username: 'carol', display_name: 'Carol', group: 'vip' },
  ]

  test('filterUsers matches username, display_name, and group case-insensitively', () => {
    expect(filterUsers(users, 'alice')).toHaveLength(1)
    expect(filterUsers(users, 'Alice')).toHaveLength(1)
    expect(filterUsers(users, 'default')).toHaveLength(2)
    expect(filterUsers(users, 'vip')).toHaveLength(1)
    expect(filterUsers(users, 'carol')).toHaveLength(1)
    expect(filterUsers(users, '')).toHaveLength(3)
    expect(filterUsers(users, '  ')).toHaveLength(3)
    expect(filterUsers(users, 'xyz')).toHaveLength(0)
  })

  test('groupUsers groups by group and sorts by group name ascending', () => {
    const grouped = groupUsers(users)
    expect(grouped).toHaveLength(2)
    expect(grouped[0].group).toBe('default')
    expect(grouped[0].users).toHaveLength(2)
    expect(grouped[1].group).toBe('vip')
    expect(grouped[1].users).toHaveLength(1)
  })

  test('toggleUserId adds and removes an id', () => {
    expect(toggleUserId([], 1)).toEqual([1])
    expect(toggleUserId([1], 1)).toEqual([])
    expect(toggleUserId([1, 2], 1)).toEqual([2])
    expect(toggleUserId([2, 1], 3)).toEqual([2, 1, 3])
  })

  test('getSelectionState returns correct state', () => {
    expect(getSelectionState([], users)).toBe('none')
    expect(getSelectionState([1, 2, 3], users)).toBe('all')
    expect(getSelectionState([1], users)).toBe('partial')
    expect(getSelectionState([1, 2], users)).toBe('partial')
    expect(getSelectionState([], [])).toBe('none')
  })

  test('toggleVisible selects all visible when not all selected', () => {
    expect(toggleVisible([], users)).toEqual([1, 2, 3])
    expect(toggleVisible([1], users)).toEqual([1, 2, 3])
  })

  test('toggleVisible deselects all visible when all selected', () => {
    expect(toggleVisible([1, 2, 3], users)).toEqual([])
    // Only visible users are deselected; non-visible selections are preserved
    expect(toggleVisible([1, 2, 3, 99], users)).toEqual([99])
  })

  test('toggleVisible on a subset (group) selects only that subset', () => {
    const defaultGroup = users.filter((u) => u.group === 'default')
    expect(toggleVisible([], defaultGroup)).toEqual([1, 2])
    expect(toggleVisible([1, 2], defaultGroup)).toEqual([])
  })
})

// ============================================================================
// Component tests
// ============================================================================

describe('user filter select component', () => {
  test('initial trigger text shows All Users', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    const trigger = rendered.container.querySelector('button')
    expect(trigger?.textContent).toContain('All Users')

    await unmountComponent(rendered)
  })

  test('clicking a user option calls onValueChange with that user id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)
    await clickOption('Alice')

    expect(calls.at(-1)?.ids).toEqual([1])

    await unmountComponent(rendered)
  })

  test('Select all toggles between all visible and none', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)
    await clickOption('Select all')
    expect(calls.at(-1)?.ids).toEqual([1, 2, 3])

    await clickOption('Select all')
    expect(calls.at(-1)?.ids).toEqual([])

    await unmountComponent(rendered)
  })

  test('clicking a group toggle selects all users in that group', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)
    await clickOption('default')

    expect(calls.at(-1)?.ids).toEqual([1, 2])

    await unmountComponent(rendered)
  })

  test('search input stays controlled after popover close/reopen', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    // Open popover and type "alice" in search
    await openPopover(rendered)
    const input = document.querySelector<HTMLInputElement>(
      '[data-slot="command-input"]'
    )
    if (!input) {
      throw new Error('search input not found')
    }
    await act(async () => {
      fireEvent.input(input, { target: { value: 'alice' } })
    })
    await flushAsyncUpdates()

    // Verify filtered list: only Alice visible, Bob/Carol absent
    const optionTexts = (function () {
      return [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
        (el) => el.textContent ?? ''
      )
    })()
    expect(optionTexts.some((t) => t.includes('Alice'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Bob'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Carol'))).toBe(false)
    expect(input.value).toBe('alice')

    // Close popover by toggling the trigger
    const closeTrigger = rendered.container.querySelector('button')
    if (!closeTrigger) {
      throw new Error('trigger not found for close')
    }
    await act(async () => closeTrigger.click())
    await flushAsyncUpdates()

    // Popover content should be unmounted (no command-input in document)
    expect(
      document.querySelector('[data-slot="command-input"]')
    ).toBeNull()

    // Reopen popover
    const reopenTrigger = rendered.container.querySelector('button')
    if (!reopenTrigger) {
      throw new Error('trigger not found for reopen')
    }
    await act(async () => reopenTrigger.click())
    await flushAsyncUpdates()

    // Input value should still be "alice" (controlled) and list still filtered
    const reopenedInput =
      document.querySelector<HTMLInputElement>('[data-slot="command-input"]')
    if (!reopenedInput) {
      throw new Error('search input not found after reopen')
    }
    expect(reopenedInput.value).toBe('alice')

    const reopenedOptionTexts = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ].map((el) => el.textContent ?? '')
    expect(reopenedOptionTexts.some((t) => t.includes('Alice'))).toBe(true)
    expect(reopenedOptionTexts.some((t) => t.includes('Bob'))).toBe(false)
    expect(reopenedOptionTexts.some((t) => t.includes('Carol'))).toBe(false)

    await unmountComponent(rendered)
  })
})
