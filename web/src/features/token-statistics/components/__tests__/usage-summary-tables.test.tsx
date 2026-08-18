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
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
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
        'User Token Usage Ranking': 'User Token Usage Ranking',
        'Group Token Usage Ranking': 'Group Token Usage Ranking',
        Username: 'Username',
        Group: 'Group',
        'Token Used': 'Token Used',
        Quota: 'Quota',
        Requests: 'Requests',
        Users: 'Users',
        'No data': 'No data',
      },
    },
  },
})

const { SummaryTableCard, USER_COLUMNS, GROUP_COLUMNS } =
  await import('../usage-summary-tables')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedCard = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderCard(
  props: React.ComponentProps<typeof SummaryTableCard>
): Promise<RenderedCard> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <SummaryTableCard {...props} />
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

describe('usage summary tables', () => {
  after(() => {
    domWindow.close()
  })

  test('renders user rows in given order with formatted values', async () => {
    const rendered = await renderCard({
      titleKey: 'User Token Usage Ranking',
      icon: null,
      columns: USER_COLUMNS,
      emptyText: 'No data',
      rows: [
        { username: 'alice', token_used: 1234, quota: 5000, count: 7 },
        { username: 'bob', token_used: 50, quota: 100, count: 1 },
      ],
      cellRenderer: (row, column) => {
        switch (column.key) {
          case 'username':
            return row.username || '-'
          case 'token_used':
            return String(row.token_used ?? 0)
          case 'quota':
            return String(row.quota ?? 0)
          case 'count':
            return String(row.count ?? 0)
          default:
            return '-'
        }
      },
    })

    const text = textOf(rendered)
    assert.ok(text.includes('User Token Usage Ranking'))
    assert.ok(text.includes('Username') && text.includes('Token Used'))
    // 按后端返回顺序展示：alice 在 bob 之前
    assert.ok(text.indexOf('alice') < text.indexOf('bob'))

    await unmountCard(rendered)
  })

  test('renders group columns including user count', async () => {
    const rendered = await renderCard({
      titleKey: 'Group Token Usage Ranking',
      icon: null,
      columns: GROUP_COLUMNS,
      emptyText: 'No data',
      rows: [
        {
          use_group: 'vip',
          token_used: 75,
          quota: 750,
          count: 3,
          user_count: 2,
        },
      ],
      cellRenderer: (row, column) => {
        switch (column.key) {
          case 'use_group':
            return row.use_group || '-'
          case 'user_count':
            return String(row.user_count ?? 0)
          default:
            return String(row[column.key] ?? 0)
        }
      },
    })

    const text = textOf(rendered)
    assert.ok(text.includes('vip'))
    assert.ok(text.includes('2')) // user_count

    await unmountCard(rendered)
  })

  test('shows empty text when there are no rows', async () => {
    const rendered = await renderCard({
      titleKey: 'User Token Usage Ranking',
      icon: null,
      columns: USER_COLUMNS,
      emptyText: 'No data',
      rows: [],
      cellRenderer: () => '-',
    })

    assert.ok(textOf(rendered).includes('No data'))

    await unmountCard(rendered)
  })

  test('renders the optional filter node in the card header', async () => {
    const rendered = await renderCard({
      titleKey: 'User Token Usage Ranking',
      icon: null,
      columns: USER_COLUMNS,
      emptyText: 'No data',
      rows: [],
      cellRenderer: () => '-',
      filter: <span>filter-ui</span>,
    })

    assert.ok(textOf(rendered).includes('filter-ui'))

    await unmountCard(rendered)
  })
})
