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
import { describe, expect, test } from 'vitest'

import { CHANNEL_FORM_DEFAULT_VALUES, channelFormSchema } from '../channel-form'

function thresholdForm(threshold?: number) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Balance alert channel',
    key: 'test-key',
    models: 'gpt-5',
    balance_alert_threshold: threshold,
  }
}

describe('channel form balance alert threshold', () => {
  test('accepts a positive threshold', () => {
    expect(channelFormSchema.safeParse(thresholdForm(5)).success).toBe(true)
  })

  test('accepts zero (alert disabled)', () => {
    expect(channelFormSchema.safeParse(thresholdForm(0)).success).toBe(true)
  })

  test('rejects negative thresholds', () => {
    expect(channelFormSchema.safeParse(thresholdForm(-1)).success).toBe(false)
    expect(channelFormSchema.safeParse(thresholdForm(-0.5)).success).toBe(false)
  })

  test('accepts an unset threshold (use global default)', () => {
    expect(channelFormSchema.safeParse(thresholdForm(undefined)).success).toBe(
      true
    )
  })
})
