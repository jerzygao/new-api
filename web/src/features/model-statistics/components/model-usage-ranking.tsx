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
import { Boxes } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatTokens } from '@/lib/format'

import { getModelTokenUsage } from '../api'

const TOP_LIMIT = 100

export function ModelTokenUsageRanking({
  timeRange,
  userIds,
}: {
  timeRange: { start_timestamp: number; end_timestamp: number }
  userIds: number[]
}) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'model-summary', timeRange, userIds],
    queryFn: () =>
      getModelTokenUsage({
        ...timeRange,
        user_ids: userIds.length ? userIds : undefined,
      }),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })
  const rows = (data ?? []).slice(0, TOP_LIMIT)

  let tableBody: ReactNode
  if (isLoading) {
    tableBody = Array.from({ length: 5 }, (_, index) => (
      <tr key={index}>
        <td className='px-3 py-2 sm:px-5'>
          <Skeleton className='h-4 w-full' />
        </td>
        <td className='px-3 py-2 text-right sm:px-5'>
          <Skeleton className='h-4 w-full' />
        </td>
        <td className='px-3 py-2 text-right sm:px-5'>
          <Skeleton className='h-4 w-full' />
        </td>
      </tr>
    ))
  } else if (rows.length === 0) {
    tableBody = (
      <tr>
        <td
          colSpan={3}
          className='text-muted-foreground px-3 py-8 text-center sm:px-5'
        >
          {t('No data')}
        </td>
      </tr>
    )
  } else {
    tableBody = rows.map((row, index) => (
      <tr
        key={row.model_name || `row-${index}`}
        className='border-b last:border-b-0'
      >
        <td className='px-3 py-2 sm:px-5'>{row.model_name || '-'}</td>
        <td className='px-3 py-2 text-right sm:px-5'>
          {formatTokens(row.token_used ?? 0)}
        </td>
        <td className='px-3 py-2 text-right sm:px-5'>
          {formatNumber(row.count ?? 0)}
        </td>
      </tr>
    ))
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full items-center justify-between gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='info' size='sm'>
            <Boxes />
          </IconBadge>
          <div className='text-sm font-semibold'>
            {t('Model Token Usage Ranking')}
          </div>
        </div>
      </div>
      <div className='max-h-96 overflow-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-muted-foreground border-b text-xs'>
              <th className='px-3 py-2 text-left font-medium sm:px-5'>
                {t('Model Name')}
              </th>
              <th className='px-3 py-2 text-right font-medium sm:px-5'>
                {t('Token Used')}
              </th>
              <th className='px-3 py-2 text-right font-medium sm:px-5'>
                {t('Requests')}
              </th>
            </tr>
          </thead>
          <tbody>{tableBody}</tbody>
        </table>
      </div>
    </div>
  )
}
