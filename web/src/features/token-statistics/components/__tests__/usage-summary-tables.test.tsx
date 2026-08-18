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

const { SummaryTableCard, USER_COLUMNS, GROUP_COLUMNS } =
  await import('../usage-summary-tables')

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

type RenderedCard = ReturnType<typeof render>

function renderCard(
  props: ComponentProps<typeof SummaryTableCard>
): RenderedCard {
  return render(
    <I18nextProvider i18n={i18n}>
      <SummaryTableCard {...props} />
    </I18nextProvider>
  )
}

function textOf(rendered: RenderedCard): string {
  return (rendered.container.textContent ?? '').replaceAll(/\s+/g, ' ')
}

describe('usage summary tables', () => {
  test('renders user rows in given order with formatted values', () => {
    const rendered = renderCard({
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
    expect(text.includes('User Token Usage Ranking')).toBe(true)
    expect(text.includes('Username') && text.includes('Token Used')).toBe(true)
    // 按后端返回顺序展示：alice 在 bob 之前
    expect(text.indexOf('alice')).toBeLessThan(text.indexOf('bob'))
  })

  test('renders group columns including user count', () => {
    const rendered = renderCard({
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
    expect(text.includes('vip')).toBe(true)
    expect(text.includes('2')).toBe(true) // user_count
  })

  test('shows empty text when there are no rows', () => {
    const rendered = renderCard({
      titleKey: 'User Token Usage Ranking',
      icon: null,
      columns: USER_COLUMNS,
      emptyText: 'No data',
      rows: [],
      cellRenderer: () => '-',
    })

    expect(textOf(rendered).includes('No data')).toBe(true)
  })

  test('renders the optional filter node in the card header', () => {
    const rendered = renderCard({
      titleKey: 'User Token Usage Ranking',
      icon: null,
      columns: USER_COLUMNS,
      emptyText: 'No data',
      rows: [],
      cellRenderer: () => '-',
      filter: <span>filter-ui</span>,
    })

    expect(textOf(rendered).includes('filter-ui')).toBe(true)
  })
})
