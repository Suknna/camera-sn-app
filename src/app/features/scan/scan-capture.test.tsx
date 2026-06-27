import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScanCapture } from './scan-capture'

const failingFeedbackCases: Array<[string, () => Promise<void>]> = [
  [
    'sync throw',
    () => {
      throw new Error('feedback failed')
    },
  ],
  ['rejected promise', () => Promise.reject(new Error('feedback failed'))],
]

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
  registerPlugin: vi.fn(() => ({})),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('ScanCapture feedback', () => {
  it('plays scan feedback after a successful scan', async () => {
    const playFeedback = vi.fn(async () => {})
    const onAddItem = vi.fn()

    act(() =>
      root.render(
        <ScanCapture
          rackId='rack-1'
          uPosition='12'
          onAddItem={onAddItem}
          playFeedback={playFeedback}
        />
      )
    )

    await changeInput('input[name="rawValue"]', 'SN-001')
    await clickButton('加入待提交列表')

    expect(onAddItem).toHaveBeenCalledTimes(1)
    expect(playFeedback).toHaveBeenCalledTimes(1)
    expect(playFeedback).toHaveBeenCalledWith()
  })

  it.each(failingFeedbackCases)(
    'swallows %s feedback failure after adding the scan',
    async (_, fail) => {
      const playFeedback = vi.fn(fail)
      const onAddItem = vi.fn()

      act(() =>
        root.render(
          <ScanCapture
            rackId='rack-1'
            uPosition='12'
            onAddItem={onAddItem}
            playFeedback={playFeedback}
          />
        )
      )

      await changeInput('input[name="rawValue"]', 'SN-002')
      await clickButton('加入待提交列表')

      expect(onAddItem).toHaveBeenCalledTimes(1)
      expect(playFeedback).toHaveBeenCalledTimes(1)
      expect(container.querySelector('[role="alert"]')).toBeNull()
    }
  )
})

async function changeInput(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Input not found: ${selector}`)

  await act(async () => {
    setNativeValue(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (element) => element.textContent === label
  )
  if (!button) throw new Error(`Button not found: ${label}`)

  await act(async () => {
    button.click()
  })
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
}
