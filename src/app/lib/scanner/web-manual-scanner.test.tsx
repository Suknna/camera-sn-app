import { act } from 'react'
import type * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { WebManualScanner, type ScannedBarcode } from './index'

async function render(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.append(container)
  let root: Root | undefined

  await act(async () => {
    root = createRoot(container)
    root.render(element)
  })

  return {
    container,
    cleanup: async () => {
      await act(async () => root?.unmount())
      container.remove()
    },
  }
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    setNativeValue(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element) as HTMLInputElement,
    'value'
  )
  descriptor?.set?.call(element, value)
}

describe('WebManualScanner', () => {
  it('renders an explicit web debug fallback banner', async () => {
    const view = await render(<WebManualScanner onBarcode={vi.fn()} />)

    expect(view.container.textContent).toContain('Web 调试模式：手动输入 SN')

    await view.cleanup()
  })

  it('submits raw manual input unchanged with the manual format', async () => {
    const onBarcode = vi.fn<(barcode: ScannedBarcode) => void>()
    const view = await render(<WebManualScanner onBarcode={onBarcode} />)
    const rawValueInput = view.container.querySelector<HTMLInputElement>(
      'input[name="rawValue"]'
    )
    const submitButton = Array.from(
      view.container.querySelectorAll('button')
    ).find((button) => button.textContent?.trim() === '加入待提交列表')

    if (!rawValueInput) throw new Error('raw value input not found')
    if (!submitButton) throw new Error('submit button not found')

    await changeInput(rawValueInput, '  SN-001  ')
    await act(async () => {
      submitButton.click()
    })

    expect(onBarcode).toHaveBeenCalledWith({
      format: 'manual',
      rawValue: '  SN-001  ',
    })

    await view.cleanup()
  })

  it('does not submit and disables inputs when disabled', async () => {
    const onBarcode = vi.fn<(barcode: ScannedBarcode) => void>()
    const view = await render(
      <WebManualScanner disabled onBarcode={onBarcode} />
    )
    const rawValueInput = view.container.querySelector<HTMLInputElement>(
      'input[name="rawValue"]'
    )
    const formatInput = view.container.querySelector<HTMLInputElement>(
      'input[name="format"]'
    )
    const submitButton = Array.from(
      view.container.querySelectorAll('button')
    ).find((button) => button.textContent?.trim() === '加入待提交列表')

    if (!rawValueInput) throw new Error('raw value input not found')
    if (!formatInput) throw new Error('format input not found')
    if (!submitButton) throw new Error('submit button not found')

    expect(rawValueInput.disabled).toBe(true)
    expect(formatInput.disabled).toBe(true)
    expect(submitButton.disabled).toBe(true)

    await act(async () => {
      submitButton.click()
    })

    expect(onBarcode).not.toHaveBeenCalled()

    await view.cleanup()
  })
})
