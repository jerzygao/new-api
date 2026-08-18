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
import { act, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')

const { ChannelFilterSelect } = await import('../channel-filter-select')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'All Channels': 'All Channels',
      },
    },
  },
})

type RenderedSelect = ReturnType<typeof render>

function renderSelect(
  props: ComponentProps<typeof ChannelFilterSelect>
): RenderedSelect {
  return render(
    <I18nextProvider i18n={i18n}>
      <ChannelFilterSelect {...props} />
    </I18nextProvider>
  )
}

function textOf(rendered: RenderedSelect): string {
  return (rendered.container.textContent ?? '').replaceAll(/\s+/g, ' ')
}

// Base UI Select only commits a selection when the click carries a real
// pointer signal. fireEvent.click is a virtual click (no pointerType),
// which Base UI treats as highlight-only and drops. A native HTMLElement
// click in async act is treated as a real activation and selects the item.
async function clickTrigger(rendered: RenderedSelect): Promise<void> {
  const trigger = rendered.container.querySelector<HTMLButtonElement>('button')
  if (!trigger) {
    throw new Error('select trigger not found')
  }
  await act(async () => trigger.click())
}

async function clickOption(label: string): Promise<void> {
  const options = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ]
  const option = options.find((el) => (el.textContent ?? '').includes(label))
  if (!option) {
    throw new Error(`option "${label}" not found`)
  }
  await act(async () => option.click())
}

describe('channel filter select', () => {
  test('lists All Channels plus each channel and reports the picked channel id', async () => {
    const picked: number[] = []
    const rendered = renderSelect({
      channels: [
        { channel_id: 1, channel_name: 'OpenAI' },
        { channel_id: 2, channel_name: 'Claude' },
      ],
      value: 0,
      onValueChange: (channelId) => picked.push(channelId),
    })

    // 默认显示 All Channels
    expect(textOf(rendered)).toContain('All Channels')

    // 打开下拉，选项渲染在 portal 中
    await clickTrigger(rendered)
    const options = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ]
    const labels = options.map((el) => el.textContent ?? '')
    expect(labels).toContain('All Channels')
    expect(labels).toContain('OpenAI')
    expect(labels).toContain('Claude')

    // 选中 OpenAI 回调 channel_id = 1
    await clickOption('OpenAI')
    expect(picked).toEqual([1])
  })

  test('selecting All Channels again reports 0', async () => {
    const picked: number[] = []
    const rendered = renderSelect({
      channels: [{ channel_id: 1, channel_name: 'OpenAI' }],
      value: 1,
      onValueChange: (channelId) => picked.push(channelId),
    })

    await clickTrigger(rendered)
    await clickOption('All Channels')
    expect(picked).toEqual([0])
  })

  test('shows the selected channel name on the trigger', () => {
    const rendered = renderSelect({
      channels: [{ channel_id: 2, channel_name: 'Claude' }],
      value: 2,
      onValueChange: () => undefined,
    })

    expect(textOf(rendered)).toContain('Claude')
  })

  test('renders only All Channels when there are no channels', async () => {
    const rendered = renderSelect({
      channels: [],
      value: 0,
      onValueChange: () => undefined,
    })

    await clickTrigger(rendered)
    const options = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ]
    expect(options).toHaveLength(1)
    expect(options[0]?.textContent ?? '').toContain('All Channels')
  })
})
