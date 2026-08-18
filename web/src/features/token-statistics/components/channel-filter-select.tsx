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
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ChannelUsageSummary } from '../types'

export interface ChannelFilterSelectProps {
  channels: ChannelUsageSummary[]
  value: number
  onValueChange: (channelId: number) => void
}

// 渠道筛选下拉框：value 为 0 表示全部渠道，其余为具体的 channel_id。
// 选项来自时间范围内有用量的渠道（后端已回退填充 channel_name）。
export function ChannelFilterSelect(props: ChannelFilterSelectProps) {
  const { t } = useTranslation()
  const options = props.channels
    .filter((channel) => channel.channel_id != null)
    .map((channel) => ({
      id: channel.channel_id as number,
      label: channel.channel_name ?? String(channel.channel_id),
    }))
  return (
    <Select
      items={[
        { value: '0', label: t('All Channels') },
        ...options.map((option) => ({
          value: String(option.id),
          label: option.label,
        })),
      ]}
      value={String(props.value)}
      onValueChange={(next) => props.onValueChange(Number(next))}
    >
      <SelectTrigger size='sm'>
        <SelectValue placeholder={t('All Channels')} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectItem value='0'>{t('All Channels')}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
