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
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')

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

const { ChannelFilterSelect } = await import('../channel-filter-select')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedSelect = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderSelect(
  props: React.ComponentProps<typeof ChannelFilterSelect>
): Promise<RenderedSelect> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ChannelFilterSelect {...props} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountSelect(rendered: RenderedSelect) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

function textOf(rendered: RenderedSelect): string {
  return (rendered.container.textContent ?? '').replaceAll(/\s+/g, ' ')
}

describe('channel filter select', () => {
  after(() => {
    domWindow.close()
  })

  test('lists All Channels plus each channel and reports the picked channel id', async () => {
    const picked: number[] = []
    const rendered = await renderSelect({
      channels: [
        { channel_id: 1, channel_name: 'OpenAI' },
        { channel_id: 2, channel_name: 'Claude' },
      ],
      value: 0,
      onValueChange: (channelId) => picked.push(channelId),
    })

    // 默认显示 All Channels
    assert.ok(textOf(rendered).includes('All Channels'))

    // 打开下拉，选项渲染在 portal 中
    const trigger = rendered.container.querySelector('button')
    assert.ok(trigger)
    await act(async () => trigger.click())
    const options = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ]
    const labels = options.map((el) => el.textContent ?? '')
    assert.ok(labels.includes('All Channels'))
    assert.ok(labels.includes('OpenAI'))
    assert.ok(labels.includes('Claude'))

    // 选中 OpenAI 回调 channel_id = 1
    const openaiOption = options.find((el) =>
      (el.textContent ?? '').includes('OpenAI')
    )
    assert.ok(openaiOption)
    await act(async () => openaiOption.click())
    assert.deepEqual(picked, [1])

    await unmountSelect(rendered)
  })

  test('selecting All Channels again reports 0', async () => {
    const picked: number[] = []
    const rendered = await renderSelect({
      channels: [{ channel_id: 1, channel_name: 'OpenAI' }],
      value: 1,
      onValueChange: (channelId) => picked.push(channelId),
    })

    const trigger = rendered.container.querySelector('button')
    assert.ok(trigger)
    await act(async () => trigger.click())
    const options = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ]
    const allChannelsOption = options.find((el) =>
      (el.textContent ?? '').includes('All Channels')
    )
    assert.ok(allChannelsOption)
    await act(async () => allChannelsOption.click())
    assert.deepEqual(picked, [0])

    await unmountSelect(rendered)
  })

  test('shows the selected channel name on the trigger', async () => {
    const rendered = await renderSelect({
      channels: [{ channel_id: 2, channel_name: 'Claude' }],
      value: 2,
      onValueChange: () => undefined,
    })

    assert.ok(textOf(rendered).includes('Claude'))

    await unmountSelect(rendered)
  })

  test('renders only All Channels when there are no channels', async () => {
    const rendered = await renderSelect({
      channels: [],
      value: 0,
      onValueChange: () => undefined,
    })

    const trigger = rendered.container.querySelector('button')
    assert.ok(trigger)
    await act(async () => trigger.click())
    const options = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ]
    assert.equal(options.length, 1)
    assert.ok((options[0].textContent ?? '').includes('All Channels'))

    await unmountSelect(rendered)
  })
})
