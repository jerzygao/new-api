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
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChannelHeatmapMatrix } from '@/features/dashboard/lib'
import { formatTokens } from '@/lib/format'

export interface ChannelUsageHeatmapProps {
  titleKey: string
  icon: ReactNode
  rowHeaderKey: string
  matrix: ChannelHeatmapMatrix
  isLoading?: boolean
  emptyText: string
}

const CELL_COLOR_BASE = '59, 130, 246'

// 热力图单元格：数值格式化显示 + 背景色按 maxValue 归一化
// （0 值不着色；alpha 封顶 0.85，避免深蓝底 + 浅色文字在暗色模式下对比度不足）
// oxlint-disable-next-line react/only-export-components -- 辅助函数需直接导出以便单元测试
export function heatmapCellStyle(
  value: number,
  maxValue: number
): CSSProperties {
  if (value <= 0 || maxValue <= 0) {
    return {}
  }
  const ratio = Math.min(0.85, Math.max(0.08, value / maxValue))
  return {
    backgroundColor: `rgba(${CELL_COLOR_BASE}, ${ratio})`,
  }
}

// 纯 CSS 网格热力图：行=用户/分组，列=渠道，颜色深浅表示 token 用量
export function ChannelUsageHeatmap(props: ChannelUsageHeatmapProps) {
  const { t } = useTranslation()

  let body: ReactNode
  if (props.isLoading) {
    body = Array.from({ length: 5 }, (_, index) => (
      <tr key={index}>
        {Array.from(
          { length: (props.matrix.columnLabels.length || 3) + 1 },
          (_, col) => (
            <td key={col} className='px-3 py-2 sm:px-5'>
              <Skeleton className='h-4 w-full' />
            </td>
          )
        )}
      </tr>
    ))
  } else if (props.matrix.rowLabels.length === 0) {
    body = (
      <tr>
        <td
          colSpan={props.matrix.columnLabels.length + 1}
          className='text-muted-foreground px-3 py-8 text-center sm:px-5'
        >
          {props.emptyText}
        </td>
      </tr>
    )
  } else {
    body = props.matrix.rowLabels.map((rowLabel, rowIndex) => (
      <tr key={rowLabel} className='border-b last:border-b-0'>
        <th scope='row' className='px-3 py-2 text-left font-medium sm:px-5'>
          {rowLabel}
        </th>
        {props.matrix.columnLabels.map((_, colIndex) => {
          const value = props.matrix.cells[rowIndex]?.[colIndex] ?? 0
          return (
            <td
              // oxlint-disable-next-line react/no-array-index-key -- 渠道名可重复，label 作 key 会冲突
              key={colIndex}
              className='px-3 py-2 text-center tabular-nums sm:px-5'
              style={heatmapCellStyle(value, props.matrix.maxValue)}
            >
              {formatTokens(value)}
            </td>
          )
        })}
      </tr>
    ))
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <IconBadge tone='info' size='sm'>
          {props.icon}
        </IconBadge>
        <div className='text-sm font-semibold'>{t(props.titleKey)}</div>
      </div>
      <div className='max-h-96 overflow-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-muted-foreground border-b text-xs'>
              <th className='px-3 py-2 text-left font-medium sm:px-5'>
                {t(props.rowHeaderKey)}
              </th>
              {props.matrix.columnLabels.map((label, colIndex) => (
                <th
                  // oxlint-disable-next-line react/no-array-index-key -- 渠道名可重复，label 作 key 会冲突
                  key={colIndex}
                  scope='col'
                  className='px-3 py-2 text-center font-medium sm:px-5'
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
    </div>
  )
}
