import { act } from 'react'
import type * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRepositoryForTests } from '@app/lib/local-db/repository'
import '@app/styles.css'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OperatorNamePage } from './operator-name-page'

afterEach(() => {
  document.body.replaceChildren()
})

describe('OperatorNamePage', () => {
  it('shows inline validation when operator name is empty', async () => {
    const repository = createRepositoryForTests()
    const onSaved = vi.fn()
    const view = await render(
      <OperatorNamePage repository={repository} onSaved={onSaved} />
    )

    await clickButton('保存并进入首页')

    expect(document.body.textContent).toContain('请填写操作人姓名。')
    expect(await repository.getProfile()).toBeNull()
    expect(onSaved).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('trims and saves operator name through LocalScanRepository', async () => {
    const repository = createRepositoryForTests()
    const onSaved = vi.fn()
    const view = await render(
      <OperatorNamePage repository={repository} onSaved={onSaved} />
    )

    await typeOperatorName('  王工  ')
    await clickButton('保存并进入首页')
    await flushAsyncWork()

    expect(await repository.getProfile()).toMatchObject({
      operatorName: '王工',
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ operatorName: '王工' })

    await view.cleanup()
  })
})

async function render(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.append(container)
  let root: Root | undefined

  await act(async () => {
    root = createRoot(container)
    root.render(element)
  })

  return {
    cleanup: async () => {
      await act(async () => root?.unmount())
      container.remove()
      document.body.replaceChildren()
    },
  }
}

async function typeOperatorName(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    'input[name="operatorName"]'
  )
  if (!input) throw new Error('Operator name input not found')

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

function getButton(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    (element) => element.textContent === label
  )
  if (!button) throw new Error(`Button not found: ${label}`)

  return button
}

async function clickButton(label: string) {
  await act(async () => {
    getButton(label).click()
  })
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}
