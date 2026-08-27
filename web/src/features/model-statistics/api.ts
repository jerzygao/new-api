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

import type { ModelDimensionTokenUsage } from './types'

// Get per-user per-model token usage within a time range (admin only)
export async function getUserModelTokenUsage(params: {
  start_timestamp: number
  end_timestamp: number
  user_ids?: number[]
}) {
  const { user_ids, ...rest } = params
  const res = await api.get<{
    success: boolean
    data: ModelDimensionTokenUsage[]
  }>('/api/data/users/model-tokens', {
    params: {
      ...rest,
      user_ids: user_ids?.length ? user_ids.join(',') : undefined,
    },
  })
  return res.data
}

// Get per-group per-model token usage within a time range (admin only)
export async function getGroupModelTokenUsage(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{
    success: boolean
    data: ModelDimensionTokenUsage[]
  }>('/api/data/groups/model-tokens', { params })
  return res.data
}
