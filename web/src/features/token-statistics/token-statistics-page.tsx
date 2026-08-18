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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DatePicker } from '@/components/date-picker'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TIME_RANGE_PRESETS } from '@/features/dashboard/constants'
import { getRollingDateRange } from '@/lib/time'

import { UsageSummaryTables } from './components/usage-summary-tables'
import { UserFilterSelect } from './components/user-filter-select'

const TOP_USER_LIMIT_OPTIONS = [5, 10, 20, 50]

type TimeRange = { start_timestamp: number; end_timestamp: number }

export function TokenStatisticsPage() {
  const { t } = useTranslation()
  const [range, setRange] = useState(() => {
    const { start, end } = getRollingDateRange(7)
    return { start, end }
  })
  const [activePresetDays, setActivePresetDays] = useState<number | null>(7)
  const [topUserLimit, setTopUserLimit] = useState(10)
  const [userIds, setUserIds] = useState<number[]>([])

  const timeRange = useMemo<TimeRange>(
    () => ({
      start_timestamp: Math.floor(range.start.getTime() / 1000),
      end_timestamp: Math.floor(range.end.getTime() / 1000),
    }),
    [range.start, range.end]
  )

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
        <Tabs
          value={activePresetDays != null ? String(activePresetDays) : ''}
          onValueChange={(value) => {
            const days = Number(value)
            const { start, end } = getRollingDateRange(days)
            setRange({ start, end })
            setActivePresetDays(days)
          }}
        >
          <TabsList>
            {TIME_RANGE_PRESETS.map((preset) => (
              <TabsTrigger
                key={preset.days}
                value={String(preset.days)}
                className='px-2.5 text-xs'
              >
                {t(preset.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <span className='text-muted-foreground px-1 text-xs font-medium whitespace-nowrap'>
          {t('Start Time')}
        </span>
        <DatePicker
          selected={range.start}
          onSelect={(date) => {
            if (date) {
              setRange((r) => ({ ...r, start: date }))
              setActivePresetDays(null)
            }
          }}
          placeholder={t('Start Time')}
        />
        <span className='text-muted-foreground px-1 text-xs font-medium whitespace-nowrap'>
          {t('End Time')}
        </span>
        <DatePicker
          selected={range.end}
          onSelect={(date) => {
            if (date) {
              setRange((r) => ({ ...r, end: date }))
              setActivePresetDays(null)
            }
          }}
          placeholder={t('End Time')}
        />

        <Tabs
          value={String(topUserLimit)}
          onValueChange={(value) => setTopUserLimit(Number(value))}
        >
          <TabsList>
            <span className='text-muted-foreground px-2 text-xs font-medium whitespace-nowrap'>
              {t('Top Users')}
            </span>
            {TOP_USER_LIMIT_OPTIONS.map((limit) => (
              <TabsTrigger
                key={limit}
                value={String(limit)}
                className='px-2.5 text-xs'
              >
                {t('Top {{count}}', { count: limit })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <UserFilterSelect value={userIds} onValueChange={setUserIds} />
      </div>

      <UsageSummaryTables
        timeRange={timeRange}
        topUserLimit={topUserLimit}
        userIds={userIds}
      />
    </div>
  )
}
