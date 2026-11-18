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
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'

import { FadeIn } from '@/components/page-transition'

const LazyChannelPerformancePanel = lazy(() =>
  import('./components/channel-performance/channel-performance-panel').then(
    (m) => ({
      default: m.ChannelPerformancePanel,
    })
  )
)

const LazyTokenStatistics = lazy(() =>
  import('@/features/token-statistics/token-statistics-page').then((m) => ({
    default: m.TokenStatisticsPage,
  }))
)

const LazyModelStatistics = lazy(() =>
  import('@/features/model-statistics/model-statistics-page').then((m) => ({
    default: m.ModelStatisticsPage,
  }))
)

const forkDashboardPanels: Record<string, ComponentType> = {
  'channel-performance': LazyChannelPerformancePanel,
  'token-statistics': LazyTokenStatistics,
  'model-statistics': LazyModelStatistics,
}

export function ForkDashboardSection(props: {
  section: string
  fallback: ReactNode
}) {
  const Panel = forkDashboardPanels[props.section]
  if (!Panel) return null
  return (
    <FadeIn>
      <Suspense fallback={props.fallback}>
        <Panel />
      </Suspense>
    </FadeIn>
  )
}
