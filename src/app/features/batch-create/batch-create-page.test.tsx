import { act } from 'react'
import type * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRepositoryForTests } from '@app/lib/local-db/repository'
import type { LocalScanRepository } from '@app/lib/local-db/types'
import { createLocalAppError } from '@app/lib/local-errors'
import '@app/styles.css'
import { mobileContextApi } from '@shared/api/mobile/context'
import { mobileScanBatchesApi } from '@shared/api/mobile/scan-batches'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchCreatePage } from './batch-create-page'

vi.mock('@shared/api/mobile/context', () => ({
  mobileContextApi: {
    getContext: vi.fn(),
  },
}))

vi.mock('@shared/api/mobile/scan-batches', () => ({
  mobileScanBatchesApi: {
    create: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.stubEnv('VITE_APP_CONTROL_PLANE_MODE', 'standalone')
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('BatchCreatePage', () => {
  it('renders standalone local form without loading mobile context', async () => {
    const repository = await createInitializedRepository('张三')
    const view = await render(<BatchCreatePage repository={repository} />)

    await expectText('本地批次信息')
    expect(document.body.textContent).toContain('保存在这台设备上')
    expect(document.body.textContent).toContain('尚未经过中心校验')
    expect(inputValue('#batch-operator-name')).toBe('张三')
    expect(mobileContextApi.getContext).not.toHaveBeenCalled()
    expect(mobileScanBatchesApi.create).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('shows required validation for standalone batch fields', async () => {
    const repository = createRepositoryForTests()
    const view = await render(<BatchCreatePage repository={repository} />)

    await expectText('本地批次信息')
    await clickButton('创建本地批次')

    await expectText('请填写操作人姓名')
    expect(document.body.textContent).toContain('请选择数据中心')
    expect(document.body.textContent).toContain('请选择机房')
    expect(document.body.textContent).toContain('请填写到货批次')
    expect(document.body.textContent).toContain('请填写机器配置')
    expect(mobileScanBatchesApi.create).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('keeps data center to room cascading from standalone catalog', async () => {
    const repository = await createInitializedRepository('张三')
    const view = await render(<BatchCreatePage repository={repository} />)

    await expectText('本地批次信息')
    expect(
      (document.getElementById('batch-room') as HTMLButtonElement | null)
        ?.disabled
    ).toBe(true)

    await changeSelect('batch-data-center', '示例数据中心01')

    expect(
      (document.getElementById('batch-room') as HTMLButtonElement | null)
        ?.disabled
    ).toBe(false)
    await changeSelect('batch-room', 'A机房')
    expect(document.getElementById('batch-room')?.textContent).toContain(
      'A机房'
    )

    await view.cleanup()
  })

  it('creates local batch through repository and navigates to scan route', async () => {
    const repository = await createInitializedRepository('张三')
    const createBatchSpy = vi.spyOn(repository, 'createBatch')
    const navigateToScan = vi.fn()
    const view = await render(
      <BatchCreatePage
        repository={repository}
        createClientBatchID={() => 'batch_generated'}
        navigateToScan={navigateToScan}
      />
    )

    await fillValidLocalForm()
    await clickButton('创建本地批次')

    await waitFor(() => expect(createBatchSpy).toHaveBeenCalledTimes(1))
    expect(createBatchSpy.mock.calls[0]?.[0]).toEqual({
      clientBatchId: 'batch_generated',
      operatorName: '张三',
      dataCenterId: 'dc-demo-01',
      roomId: 'room-demo-a',
      arrivalBatchName: '2026-06 到货第一批',
      machineConfigSummary: 'GPU 服务器 / 2U / 双电源',
      defaultConfigNote: '默认配置备注',
    })
    await waitFor(() => expect(navigateToScan).toHaveBeenCalledTimes(1))
    expect(navigateToScan.mock.calls[0]?.[0]).toMatch(/^batch_/)
    expect(mobileContextApi.getContext).not.toHaveBeenCalled()
    expect(mobileScanBatchesApi.create).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('maps local repository errors to Chinese copy without internal codes', async () => {
    const repository = await createInitializedRepository('张三')
    vi.spyOn(repository, 'createBatch').mockRejectedValueOnce(
      createLocalAppError('LOCAL_DB_UNAVAILABLE')
    )
    const view = await render(
      <BatchCreatePage
        repository={repository}
        createClientBatchID={() => 'batch_generated'}
      />
    )

    await fillValidLocalForm()
    await clickButton('创建本地批次')

    await expectText('本地数据库不可用')
    expect(document.body.textContent).not.toContain('LOCAL_DB_UNAVAILABLE')
    expect(document.body.textContent).not.toContain('错误码')
    expect(mobileScanBatchesApi.create).not.toHaveBeenCalled()

    await view.cleanup()
  })
})

async function createInitializedRepository(
  operatorName: string
): Promise<LocalScanRepository> {
  const repository = createRepositoryForTests()
  await repository.initialize()
  await repository.saveOperatorName(operatorName)
  return repository
}

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

async function fillValidLocalForm() {
  await expectText('本地批次信息')
  await changeInput('#batch-operator-name', ' 张三 ')
  await changeInput('#batch-arrival-name', ' 2026-06 到货第一批 ')
  await changeSelect('batch-data-center', '示例数据中心01')
  await changeSelect('batch-room', 'A机房')
  await changeInput(
    '#batch-machine-config-summary',
    ' GPU 服务器 / 2U / 双电源 '
  )
  await changeInput('#batch-default-config-note', ' 默认配置备注 ')
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

async function changeSelect(triggerId: string, optionText: string) {
  await act(async () => {
    const trigger = document.getElementById(triggerId)
    if (!trigger) throw new Error(`Select trigger not found: ${triggerId}`)
    trigger.click()
  })
  await act(async () => {
    const item = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent === optionText
    ) as HTMLElement | undefined
    if (!item) throw new Error(`Option not found: ${optionText}`)
    item.click()
  })
}

async function changeInput(selector: string, value: string) {
  const control = document.querySelector<
    HTMLInputElement | HTMLTextAreaElement
  >(selector)
  if (!control) throw new Error(`Control not found: ${selector}`)

  await act(async () => {
    setNativeValue(control, value)
    control.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function inputValue(selector: string) {
  const input = document.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Input not found: ${selector}`)

  return input.value
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const prototype = Object.getPrototypeOf(element) as
    | HTMLInputElement
    | HTMLTextAreaElement
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
}

async function expectText(text: string) {
  await waitFor(() => expect(document.body.textContent).toContain(text))
}

async function waitFor(assertion: () => void) {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < 1500) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }

  throw lastError
}
