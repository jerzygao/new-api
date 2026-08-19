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
  { id: 1, username: 'root', display_name: 'Root', group: 'default' },
  { id: 2, username: 'alice', display_name: 'Alice', group: 'default' },
  { id: 3, username: 'bob', display_name: 'Bob', group: 'vip' },
  { id: 4, username: 'carol', display_name: 'Carol', group: 'vip' },
  { id: 5, username: 'dave', display_name: 'Dave', group: 'team-b' },
  { id: 6, username: 'eve', display_name: 'Eve', group: 'team-b' },
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

function getOptionTexts(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
    (el) => el.textContent ?? ''
  )
}

function findOptionEl(label: string): HTMLElement {
  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
  const option = options.find((el) => (el.textContent ?? '').includes(label))
  if (!option) {
    throw new Error(`option "${label}" not found`)
  }
  return option
}

// Click a row (focuses its scope); targets the [role="option"] div itself so the
// nested indicator button is not triggered.
async function clickOption(label: string) {
  await act(async () => findOptionEl(label).click())
}

// Click the checkbox indicator button nested inside the row matching `label`,
// toggling selection for that scope without focusing it.
async function clickIndicator(label: string) {
  const btn = findOptionEl(label).querySelector<HTMLButtonElement>('button')
  if (!btn) {
    throw new Error(`indicator button not found in "${label}" row`)
  }
  await act(async () => btn.click())
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
// Component tests (two-pane picker)
// ============================================================================

describe('user filter select component', () => {
  test('initial trigger shows All Users and popover renders both panes', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    const trigger = rendered.container.querySelector('button')
    expect(trigger?.textContent).toContain('All Users')

    await openPopover(rendered)

    const optionTexts = getOptionTexts()
    // Left pane: All Users + 3 groups (default, team-b, vip after sort)
    expect(optionTexts.some((t) => t.includes('All Users'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('default'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('team-b'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('vip'))).toBe(true)
    // Right pane: all 6 users (focused = All)
    expect(optionTexts.some((t) => t.includes('Root'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Alice'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Bob'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Carol'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Dave'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Eve'))).toBe(true)

    await unmountComponent(rendered)
  })

  test('focusing a group shows its users and the group indicator toggles its members', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)

    // Focus the vip group row
    await clickOption('vip')
    const optionTexts = getOptionTexts()
    expect(optionTexts.some((t) => t.includes('Bob'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Carol'))).toBe(true)
    expect(optionTexts.some((t) => t.includes('Alice'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Root'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Dave'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Eve'))).toBe(false)

    // Toggle the vip group indicator -> select bob (3) + carol (4)
    await clickIndicator('vip')
    expect(calls.at(-1)?.ids).toEqual([3, 4])

    // Toggle again -> deselect
    await clickIndicator('vip')
    expect(calls.at(-1)?.ids).toEqual([])

    await unmountComponent(rendered)
  })

  test('All Users indicator toggles all users', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)

    await clickIndicator('All Users')
    expect(calls.at(-1)?.ids).toEqual([1, 2, 3, 4, 5, 6])

    await clickIndicator('All Users')
    expect(calls.at(-1)?.ids).toEqual([])

    await unmountComponent(rendered)
  })

  test('clicking a user row toggles that user id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)

    await clickOption('Alice')
    expect(calls.at(-1)?.ids).toEqual([2])

    await unmountComponent(rendered)
  })

  test('right pane search filters the user list', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Search users"]'
    )
    if (!input) {
      throw new Error('search input not found')
    }
    await act(async () => {
      fireEvent.input(input, { target: { value: 'carol' } })
    })
    await flushAsyncUpdates()

    const optionTexts = getOptionTexts()
    expect(optionTexts.filter((t) => t.includes('Carol')).length).toBe(1)
    expect(optionTexts.some((t) => t.includes('Alice'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Bob'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Root'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Dave'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Eve'))).toBe(false)

    await unmountComponent(rendered)
  })

  test('keyboard Enter on a user row toggles selection and aria-selected', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)

    // Focus the vip group so the right pane lists bob (3) + carol (4)
    await clickOption('vip')

    await act(async () => {
      fireEvent.keyDown(findOptionEl('Bob'), { key: 'Enter' })
    })
    expect(calls.at(-1)?.ids).toEqual([3])
    expect(findOptionEl('Bob').getAttribute('aria-selected')).toBe('true')

    // Enter again toggles off; aria-selected reflects the cleared state
    await act(async () => {
      fireEvent.keyDown(findOptionEl('Bob'), { key: 'Enter' })
    })
    expect(calls.at(-1)?.ids).toEqual([])
    expect(findOptionEl('Bob').getAttribute('aria-selected')).toBe('false')

    await unmountComponent(rendered)
  })

  test('right pane shows no results when search matches nothing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rendered = await renderComponent(queryClient)
    await flushAsyncUpdates()

    await openPopover(rendered)

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Search users"]'
    )
    if (!input) {
      throw new Error('search input not found')
    }
    await act(async () => {
      fireEvent.input(input, { target: { value: 'zzz' } })
    })
    await flushAsyncUpdates()

    const popoverContent = document.querySelector('[data-slot="popover-content"]')
    expect(popoverContent?.textContent ?? '').toContain('No results found.')
    // No user rows rendered in the right pane (left pane groups remain)
    const optionTexts = getOptionTexts()
    expect(optionTexts.some((t) => t.includes('Root'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Alice'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Bob'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Carol'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Dave'))).toBe(false)
    expect(optionTexts.some((t) => t.includes('Eve'))).toBe(false)

    await unmountComponent(rendered)
  })
})
