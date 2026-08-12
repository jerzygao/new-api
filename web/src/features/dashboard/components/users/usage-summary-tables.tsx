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
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getChannelUsageSummaries,
  getGroupQuotaSummary,
  getUserQuotaSummary,
} from '@/features/dashboard/api'
import { ChannelFilterSelect } from './channel-filter-select'
import type { QuotaDataSummary } from '@/features/dashboard/types'
import { formatNumber, formatQuota, formatTokens } from '@/lib/format'
import { getRollingDateRange } from '@/lib/time'

const TOP_LIMIT = 100

export interface SummaryColumn {
  key: 'username' | 'use_group' | 'token_used' | 'quota' | 'count' | 'user_count'
  labelKey: string
  align?: 'left' | 'right'
}

export const USER_COLUMNS = [
  { key: 'username', labelKey: 'Username' },
  { key: 'token_used', labelKey: 'Token Used', align: 'right' },
  { key: 'quota', labelKey: 'Quota', align: 'right' },
  { key: 'count', labelKey: 'Requests', align: 'right' },
] as const satisfies SummaryColumn[]

export const GROUP_COLUMNS = [
  { key: 'use_group', labelKey: 'Group' },
  { key: 'token_used', labelKey: 'Token Used', align: 'right' },
  { key: 'quota', labelKey: 'Quota', align: 'right' },
  { key: 'count', labelKey: 'Requests', align: 'right' },
  { key: 'user_count', labelKey: 'Users', align: 'right' },
] as const satisfies SummaryColumn[]

export interface SummaryTableCardProps {
  titleKey: string
  icon: ReactNode
  columns: readonly SummaryColumn[]
  rows: QuotaDataSummary[]
  cellRenderer: (row: QuotaDataSummary, column: SummaryColumn) => ReactNode
  isLoading?: boolean
  emptyText: string
  filter?: ReactNode
}

export function SummaryTableCard(props: SummaryTableCardProps) {
  const { t } = useTranslation()
  const {
    titleKey,
    icon,
    columns,
    rows,
    cellRenderer,
    isLoading,
    emptyText,
    filter,
  } = props

  let tableBody: ReactNode
  if (isLoading) {
    tableBody = Array.from({ length: 5 }, (_, index) => (
      <tr key={index}>
        {columns.map((column) => (
          <td key={column.key} className='px-3 py-2 sm:px-5'>
            <Skeleton className='h-4 w-full' />
          </td>
        ))}
      </tr>
    ))
  } else if (rows.length === 0) {
    tableBody = (
      <tr>
        <td
          colSpan={columns.length}
          className='text-muted-foreground px-3 py-8 text-center sm:px-5'
        >
          {emptyText}
        </td>
      </tr>
    )
  } else {
    tableBody = rows.map((row, index) => (
      <tr
        key={row.username ?? row.use_group ?? `row-${index}`}
        className='border-b last:border-b-0'
      >
        {columns.map((column) => (
          <td
            key={column.key}
            className={`px-3 py-2 sm:px-5 ${
              column.align === 'right' ? 'text-right' : ''
            }`}
          >
            {cellRenderer(row, column)}
          </td>
        ))}
      </tr>
    ))
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full items-center justify-between gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='info' size='sm'>
            {icon}
          </IconBadge>
          <div className='text-sm font-semibold'>{t(titleKey)}</div>
        </div>
        {filter}
      </div>
      <div className='max-h-96 overflow-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-muted-foreground border-b text-xs'>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2 font-medium sm:px-5 ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {t(column.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{tableBody}</tbody>
        </table>
      </div>
    </div>
  )
}

interface SummaryTableProps {
  selectedRange: number
}

export function UserSummaryTable({ selectedRange }: SummaryTableProps) {
  const { t } = useTranslation()
  const timeRange = useMemo(() => {
    const { start, end } = getRollingDateRange(selectedRange)
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  }, [selectedRange])

  const { data: channelData } = useQuery({
    queryKey: ['dashboard', 'channel-summary', timeRange],
    queryFn: () => getChannelUsageSummaries(timeRange),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })
  const channels = channelData ?? []
  const [selectedChannel, setSelectedChannel] = useState(0)
  // 渠道选项随时间范围重建；选中渠道若已不在选项中则回落为全部渠道
  const effectiveChannel =
    selectedChannel !== 0 &&
    channels.some((channel) => channel.channel_id === selectedChannel)
      ? selectedChannel
      : 0

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'user-summary', timeRange, effectiveChannel],
    queryFn: () =>
      getUserQuotaSummary({
        ...timeRange,
        channel_id: effectiveChannel || undefined,
      }),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })
  const rows = useMemo(() => (data ?? []).slice(0, TOP_LIMIT), [data])

  return (
    <SummaryTableCard
      titleKey='User Token Usage Ranking'
      icon={<Users />}
      columns={USER_COLUMNS}
      rows={rows}
      isLoading={isLoading}
      emptyText={t('No data')}
      filter={
        <ChannelFilterSelect
          channels={channels}
          value={effectiveChannel}
          onValueChange={setSelectedChannel}
        />
      }
      cellRenderer={(row, column) => {
        switch (column.key) {
          case 'username':
            return row.username || '-'
          case 'token_used':
            return formatTokens(row.token_used ?? 0)
          case 'quota':
            return formatQuota(row.quota ?? 0)
          case 'count':
            return formatNumber(row.count ?? 0)
          default:
            return '-'
        }
      }}
    />
  )
}

export function GroupSummaryTable({ selectedRange }: SummaryTableProps) {
  const { t } = useTranslation()
  const timeRange = useMemo(() => {
    const { start, end } = getRollingDateRange(selectedRange)
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  }, [selectedRange])

  const { data: channelData } = useQuery({
    queryKey: ['dashboard', 'channel-summary', timeRange],
    queryFn: () => getChannelUsageSummaries(timeRange),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })
  const channels = channelData ?? []
  const [selectedChannel, setSelectedChannel] = useState(0)
  // 渠道选项随时间范围重建；选中渠道若已不在选项中则回落为全部渠道
  const effectiveChannel =
    selectedChannel !== 0 &&
    channels.some((channel) => channel.channel_id === selectedChannel)
      ? selectedChannel
      : 0

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'group-summary', timeRange, effectiveChannel],
    queryFn: () =>
      getGroupQuotaSummary({
        ...timeRange,
        channel_id: effectiveChannel || undefined,
      }),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })
  const rows = useMemo(() => (data ?? []).slice(0, TOP_LIMIT), [data])

  return (
    <SummaryTableCard
      titleKey='Group Token Usage Ranking'
      icon={<Layers />}
      columns={GROUP_COLUMNS}
      rows={rows}
      isLoading={isLoading}
      emptyText={t('No data')}
      filter={
        <ChannelFilterSelect
          channels={channels}
          value={effectiveChannel}
          onValueChange={setSelectedChannel}
        />
      }
      cellRenderer={(row, column) => {
        switch (column.key) {
          case 'use_group':
            return row.use_group || '-'
          case 'token_used':
            return formatTokens(row.token_used ?? 0)
          case 'quota':
            return formatQuota(row.quota ?? 0)
          case 'count':
            return formatNumber(row.count ?? 0)
          case 'user_count':
            return formatNumber(row.user_count ?? 0)
          default:
            return '-'
        }
      }}
    />
  )
}

export function UsageSummaryTables({ selectedRange }: SummaryTableProps) {
  return (
    <div className='mt-3 grid gap-3'>
      <UserSummaryTable selectedRange={selectedRange} />
      <GroupSummaryTable selectedRange={selectedRange} />
    </div>
  )
}
