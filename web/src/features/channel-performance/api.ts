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
import { api } from '@/lib/api'

import type { ChannelPerfSeriesData, ChannelPerfSummaryData } from './types'

export type ChannelPerfQueryParams = {
  hours?: number
  channel_id?: number
  model?: string
}

export type ChannelOption = {
  id: number
  name: string
}

export async function getChannelPerfSummary(
  params: ChannelPerfQueryParams = {}
): Promise<ChannelPerfSummaryData> {
  const res = await api.get<ChannelPerfSummaryData>(
    '/api/channel-perf/summary',
    { params }
  )
  return res.data
}

export async function getChannelPerfSeries(
  params: ChannelPerfQueryParams = {}
): Promise<ChannelPerfSeriesData> {
  const res = await api.get<ChannelPerfSeriesData>(
    '/api/channel-perf/series',
    { params }
  )
  return res.data
}

export async function getChannelOptions(): Promise<ChannelOption[]> {
  const res = await api.get<{
    success: boolean
    data?: { items: Array<{ id: number; name: string }> }
  }>('/api/channel/', { params: { page_size: 1000 } })
  return res.data?.data?.items ?? []
}

export async function getEnabledModelOptions(): Promise<string[]> {
  const res = await api.get<{
    success: boolean
    data?: string[]
  }>('/api/channel/models_enabled')
  return res.data?.data ?? []
}
