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

import type {
  ChannelDimensionTokenUsage,
  ChannelUsageSummary,
  QuotaDataSummary,
} from './types'

// Get per-user token usage summary (admin only)
export async function getUserQuotaSummary(params: {
  start_timestamp: number
  end_timestamp: number
  channel_id?: number
}) {
  const res = await api.get<{ success: boolean; data: QuotaDataSummary[] }>(
    '/api/data/users/summary',
    { params }
  )
  return res.data
}

// Get per-group token usage summary (admin only)
export async function getGroupQuotaSummary(params: {
  start_timestamp: number
  end_timestamp: number
  channel_id?: number
}) {
  const res = await api.get<{ success: boolean; data: QuotaDataSummary[] }>(
    '/api/data/groups',
    { params }
  )
  return res.data
}

// Get per-channel token usage summary within a time range (admin only)
export async function getChannelUsageSummaries(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{ success: boolean; data: ChannelUsageSummary[] }>(
    '/api/data/channels',
    { params }
  )
  return res.data
}

// Get per-user per-channel token usage within a time range (admin only)
export async function getUserChannelTokenUsage(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{
    success: boolean
    data: ChannelDimensionTokenUsage[]
  }>('/api/data/users/channel-tokens', { params })
  return res.data
}

// Get per-group per-channel token usage within a time range (admin only)
export async function getGroupChannelTokenUsage(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{
    success: boolean
    data: ChannelDimensionTokenUsage[]
  }>('/api/data/groups/channel-tokens', { params })
  return res.data
}
