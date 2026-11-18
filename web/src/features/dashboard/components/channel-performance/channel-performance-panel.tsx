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
'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { Empty } from '@/components/ui/empty'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getChannelOptions, getChannelPerfSummary, getEnabledModelOptions } from '@/features/channel-performance/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateDotClass,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const HOUR_OPTIONS = [1, 6, 24, 72, 168]
const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6']

export function ChannelPerformancePanel() {
  const { t } = useTranslation()
  const isAdmin = useAuthStore(
    (state) => (state.auth.user?.role ?? 0) >= ROLE.ADMIN
  )
  const [hours, setHours] = useState(24)
  const [modelFilter, setModelFilter] = useState('')

  const channelsQuery = useQuery({
    queryKey: ['channel-perf', 'channels'],
    queryFn: () => getChannelOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: isAdmin,
  })

  const modelsQuery = useQuery({
    queryKey: ['channel-perf', 'models_enabled'],
    queryFn: () => getEnabledModelOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: isAdmin,
  })

  const channelMap = useMemo(() => {
    const items = channelsQuery.data ?? []
    const map = new Map<number, string>()
    for (const ch of items) {
      map.set(ch.id, ch.name)
    }
    return map
  }, [channelsQuery.data])

  const query = useQuery({
    queryKey: ['channel-perf-summary', isAdmin, hours, modelFilter],
    queryFn: () =>
      getChannelPerfSummary({
        hours,
        model: modelFilter || undefined,
      }),
    staleTime: 60 * 1000,
    retry: false,
  })

  const summaries = useMemo(() => {
    const items = query.data?.data?.summaries ?? []
    return [...items].sort((a, b) => b.request_count - a.request_count)
  }, [query.data])

  const modelOptions = useMemo(() => {
    const models = isAdmin
      ? (modelsQuery.data ?? [])
      : (query.data?.data?.models ?? [])
    return [...models].sort((a, b) => a.localeCompare(b))
  }, [isAdmin, modelsQuery.data, query.data])

  const formatChannelLabel = (id: number) => {
    const name = channelMap.get(id)
    return name ? `#${id} ${name}` : `#${id}`
  }

  let performanceContent
  if (query.isLoading) {
    performanceContent = (
      <div className='flex flex-col gap-2'>
        {SKELETON_ROW_KEYS.map((key) => (
          <Skeleton key={key} className='h-10 w-full' />
        ))}
      </div>
    )
  } else if (query.isError) {
    performanceContent = (
      <Empty>
        <p className='text-muted-foreground text-sm'>
          {t('Failed to load performance data')}
        </p>
      </Empty>
    )
  } else if (summaries.length === 0) {
    performanceContent = (
      <Empty>
        <p className='text-muted-foreground text-sm'>
          {t('No performance data available')}
        </p>
      </Empty>
    )
  } else {
    performanceContent = (
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>{t('Channel')}</TableHead>}
              <TableHead>{t('Model')}</TableHead>
              <TableHead className='text-right'>
                {t('Average latency')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Average TTFT')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Success rate')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Throughput')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Request count')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((s) => (
              <TableRow key={`${s.channel_id ?? 'model'}-${s.model_name}`}>
                {isAdmin && (
                  <TableCell className='font-medium'>
                    {formatChannelLabel(s.channel_id ?? 0)}
                  </TableCell>
                )}
                <TableCell className='font-medium'>{s.model_name}</TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatLatency(s.avg_latency_ms)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatLatency(s.avg_ttft_ms)}
                </TableCell>
                <TableCell className='text-right'>
                  <span className='inline-flex items-center gap-1.5 tabular-nums'>
                    <span
                      className={`inline-block size-2 rounded-full ${getSuccessRateDotClass(s.success_rate)}`}
                    />
                    <span className={getSuccessRateTextClass(s.success_rate)}>
                      {formatUptimePct(s.success_rate)}
                    </span>
                  </span>
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatThroughput(s.avg_tps)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {s.request_count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm'>
            {t('Time range')}
          </span>
          <NativeSelect
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            size='sm'
            className='w-32'
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h >= 24
                  ? `${Math.round(h / 24)}d`
                  : `${h}h`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm'>
            {t('Model')}
          </span>
          <NativeSelect
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            size='sm'
            className='w-48'
          >
            <option value=''>{t('All models')}</option>
            {modelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {performanceContent}
    </div>
  )
}
