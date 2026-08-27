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
import { useQuery } from '@tanstack/react-query'
import { Layers, Users } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ChannelUsageHeatmap } from '@/features/token-statistics/components/channel-usage-heatmap'

import { getGroupModelTokenUsage, getUserModelTokenUsage } from '../api'
import { buildModelHeatmap } from '../lib/model-heatmap'

export function UserModelUsageHeatmap({
  timeRange,
  topLimit,
  userIds,
}: {
  timeRange: { start_timestamp: number; end_timestamp: number }
  topLimit: number
  userIds: number[]
}) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'user-model-tokens', timeRange, userIds],
    queryFn: () =>
      getUserModelTokenUsage({
        ...timeRange,
        user_ids: userIds.length ? userIds : undefined,
      }),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })
  const rows = useMemo(() => data ?? [], [data])
  const matrix = useMemo(
    () => buildModelHeatmap(rows, topLimit),
    [rows, topLimit]
  )

  return (
    <ChannelUsageHeatmap
      titleKey='User Model Token Usage'
      icon={<Users />}
      rowHeaderKey='Username'
      matrix={matrix}
      isLoading={isLoading}
      emptyText={t('No data')}
    />
  )
}

export function GroupModelUsageHeatmap({
  timeRange,
  topLimit,
}: {
  timeRange: { start_timestamp: number; end_timestamp: number }
  topLimit: number
}) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'group-model-tokens', timeRange],
    queryFn: () => getGroupModelTokenUsage(timeRange),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })
  const rows = useMemo(() => data ?? [], [data])
  const matrix = useMemo(
    () => buildModelHeatmap(rows, topLimit),
    [rows, topLimit]
  )

  return (
    <ChannelUsageHeatmap
      titleKey='Group Model Token Usage'
      icon={<Layers />}
      rowHeaderKey='Group'
      matrix={matrix}
      isLoading={isLoading}
      emptyText={t('No data')}
    />
  )
}
