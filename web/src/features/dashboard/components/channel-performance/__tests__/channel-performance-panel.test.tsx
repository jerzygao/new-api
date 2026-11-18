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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { ChannelPerformancePanel } from '../channel-performance-panel'

const userSummary = {
  success: true,
  data: {
    models: ['claude', 'gpt'],
    summaries: [
      {
        model_name: 'gpt',
        avg_latency_ms: 250,
        avg_ttft_ms: 25,
        success_rate: 100,
        avg_tps: 100,
        request_count: 4,
      },
    ],
  },
}

const adminSummary = {
  success: true,
  data: {
    summaries: [
      {
        channel_id: 3,
        model_name: 'gpt',
        avg_latency_ms: 100,
        avg_ttft_ms: 40,
        success_rate: 100,
        avg_tps: 10,
        request_count: 1,
      },
    ],
  },
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ChannelPerformancePanel />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

describe('ChannelPerformancePanel', () => {
  it('shows model metrics to a regular user without channel names or channel APIs', async () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'member',
      role: ROLE.USER,
    })
    const urls: string[] = []
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      urls.push(String(url))
      if (url === '/api/channel-perf/summary') {
        return { data: userSummary }
      }
      throw new Error(`unexpected ${url}`)
    })

    renderPanel()

    expect(await screen.findByRole('cell', { name: 'gpt' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Channel' })).toBeNull()
    expect(screen.queryByText(/#3/)).toBeNull()
    expect(urls.every((url) => url === '/api/channel-perf/summary')).toBe(true)

    const modelSelect = screen.getAllByRole('combobox')[1]
    expect(
      [...modelSelect.querySelectorAll('option')].map((option) => option.value)
    ).toEqual(['', 'claude', 'gpt'])

    await userEvent.selectOptions(modelSelect, 'gpt')
    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        '/api/channel-perf/summary',
        expect.objectContaining({
          params: expect.objectContaining({ model: 'gpt' }),
        })
      )
    })
    expect(
      [...modelSelect.querySelectorAll('option')].map((option) => option.value)
    ).toEqual(['', 'claude', 'gpt'])
  })

  it('keeps the channel column for an administrator', async () => {
    useAuthStore.getState().auth.setUser({
      id: 2,
      username: 'admin',
      role: ROLE.ADMIN,
    })
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/channel/') {
        return {
          data: { success: true, data: { items: [{ id: 3, name: 'upstream' }] } },
        }
      }
      if (url === '/api/channel/models_enabled') {
        return { data: { success: true, data: ['gpt'] } }
      }
      if (url === '/api/channel-perf/summary') {
        return { data: adminSummary }
      }
      throw new Error(`unexpected ${url}`)
    })

    renderPanel()

    expect(
      await screen.findByRole('columnheader', { name: 'Channel' })
    ).toBeInTheDocument()
    expect(await screen.findByText('#3 upstream')).toBeInTheDocument()
  })
})
