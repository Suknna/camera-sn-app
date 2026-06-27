import { act } from 'react'
import type * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { catalogSeed } from '@app/generated/catalog-seed'
import { createRepositoryForTests } from '@app/lib/local-db/repository'
import type {
  AddScanItemInput,
  CreateLocalBatchInput,
  LocalScanBatchDetail,
  LocalScanRepository,
} from '@app/lib/local-db/types'
import type { StartScannerOptions } from '@app/lib/scanner'
import '@app/styles.css'
import { Capacitor } from '@capacitor/core'
import { mobileContextApi } from '@shared/api/mobile/context'
import { mobileScanBatchesApi } from '@shared/api/mobile/scan-batches'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScanPage } from './scan-page'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router'
  )

  return {
    ...actual,
    Link: ({
      to,
      params,
      children,
      ...props
    }: React.PropsWithChildren<{
      to: string
      params?: Record<string, string>
      className?: string
    }>) => {
      const href = params?.batchId ? to.replace('$batchId', params.batchId) : to

      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    },
  }
})

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
  registerPlugin: vi.fn(() => ({})),
}))

vi.mock('@shared/api/mobile/context', () => ({
  mobileContextApi: {
    getContext: vi.fn(),
  },
}))

vi.mock('@shared/api/mobile/scan-batches', () => ({
  mobileScanBatchesApi: {
    cancel: vi.fn(),
    get: vi.fn(),
  },
}))

const firstDataCenter = catalogSeed.dataCenters[0]!
const firstRoom = firstDataCenter.rooms[0]!
const firstRack = firstRoom.racks[0]!
let clientBatchSequence = 0
let clientItemSequence = 0

beforeEach(() => {
  clientBatchSequence = 0
  clientItemSequence = 0
  localStorage.clear()
  vi.clearAllMocks()
  vi.stubEnv('VITE_APP_CONTROL_PLANE_MODE', 'standalone')
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('ScanPage', () => {
  it('shows a local missing-batch message without querying mobile APIs', async () => {
    const repository = await createInitializedRepository()
    const view = await render(
      <ScanPage localBatchId='batch-missing' repository={repository} />
    )

    await expectText('未找到本地批次')
    expect(linkHref('返回首页')).toBe('/')
    expect(mobileContextApi.getContext).not.toHaveBeenCalled()
    expect(mobileScanBatchesApi.get).not.toHaveBeenCalled()
    expect(mobileScanBatchesApi.cancel).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('adds a scan through the local repository with exact raw value and trimmed SN', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    const view = await render(
      <ScanPage
        localBatchId={batch.localBatchId}
        repository={repository}
        createClientItemID={() => 'item-1'}
        now={() => '2026-01-01T00:02:00.000Z'}
      />
    )

    await expectText('SN 原始值')
    await changeSelect('scan-rack', firstRack.name)
    await changeInput('input[name="rawValue"]', '  SN-001  ')
    await clickButton('加入待提交列表')

    await expectText('SN：SN-001')
    const storedBatch = await mustGetBatch(repository, batch.localBatchId)
    expect(storedBatch.items).toEqual([
      expect.objectContaining({
        clientItemId: 'item-1',
        rawValue: '  SN-001  ',
        serialNumber: 'SN-001',
        barcodeFormat: 'manual',
        rackId: firstRack.id,
        rackName: firstRack.name,
        uPosition: null,
        scannedAt: '2026-01-01T00:02:00.000Z',
      }),
    ])
    expect(document.body.textContent).toContain(`机柜：${firstRack.name}`)
    expect(mobileContextApi.getContext).not.toHaveBeenCalled()
    expect(mobileScanBatchesApi.get).not.toHaveBeenCalled()
    expect(mobileScanBatchesApi.cancel).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('blocks adding a scan item when rack is missing', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    const view = await render(
      <ScanPage localBatchId={batch.localBatchId} repository={repository} />
    )

    await expectText('SN 原始值')
    await changeInput('input[name="rawValue"]', 'SN-MISSING-RACK')
    await clickButton('加入待提交列表')

    await expectText('请选择机柜')
    const rackTrigger = document.getElementById('scan-rack')
    expect(rackTrigger?.getAttribute('aria-invalid')).toBe('true')
    expect(rackTrigger?.getAttribute('aria-describedby')).toBe(
      'scan-rack-error'
    )
    expect(document.getElementById('scan-rack-error')?.textContent).toBe(
      '请选择机柜'
    )
    await expectBatchItemsLength(repository, batch.localBatchId, 0)

    await view.cleanup()
  })

  it('shows the approved same-batch duplicate message from the repository', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    await repository.addScanItem(
      itemInput(batch, { rawValue: 'SN-DUP', clientItemId: 'item-dup-1' })
    )
    const view = await render(
      <ScanPage
        localBatchId={batch.localBatchId}
        repository={repository}
        createClientItemID={() => 'item-dup-2'}
      />
    )

    await expectText('SN：SN-DUP')
    await changeSelect('scan-rack', firstRack.name)
    await changeInput('input[name="rawValue"]', ' SN-DUP ')
    await clickButton('加入待提交列表')

    await expectText('这台设备的 SN 已在当前批次中记录，请勿重复扫描。')
    await expectBatchItemsLength(repository, batch.localBatchId, 1)
    expect(document.body.textContent).not.toContain(
      'SCAN_ITEM_DUPLICATE_IN_BATCH'
    )
    expect(document.body.textContent).not.toContain('LOCAL_DB_UNAVAILABLE')
    expect(document.body.textContent).not.toContain('本地数据库暂时不可用')

    await view.cleanup()
  })

  it('keeps a historical duplicate scan while showing a strong warning', async () => {
    const repository = await createInitializedRepository()
    const earlierBatch = await createBatch(repository, {
      clientBatchId: 'client-history-earlier',
      arrivalBatchName: '历史批次',
    })
    await repository.addScanItem(
      itemInput(earlierBatch, {
        rawValue: 'SN-HISTORY',
        clientItemId: 'item-history-1',
      })
    )
    const currentBatch = await createBatch(repository, {
      clientBatchId: 'client-history-current',
      arrivalBatchName: '当前批次',
    })
    const view = await render(
      <ScanPage
        localBatchId={currentBatch.localBatchId}
        repository={repository}
        createClientItemID={() => 'item-history-2'}
      />
    )

    await expectText('SN 原始值')
    await changeSelect('scan-rack', firstRack.name)
    await changeInput('input[name="rawValue"]', ' SN-HISTORY ')
    await clickButton('加入待提交列表')

    await expectText('历史重复提示')
    await expectText('本机历史记录中出现过这个 SN，请确认是否重复入库。')
    const storedBatch = await mustGetBatch(
      repository,
      currentBatch.localBatchId
    )
    expect(storedBatch.items).toEqual([
      expect.objectContaining({
        clientItemId: 'item-history-2',
        rawValue: ' SN-HISTORY ',
        serialNumber: 'SN-HISTORY',
      }),
    ])

    await view.cleanup()
  })

  it('locks completed batches and links them to the export view', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    await repository.addScanItem(
      itemInput(batch, { rawValue: 'SN-LOCKED', clientItemId: 'item-locked' })
    )
    const completed = await repository.completeBatch(batch.localBatchId)
    const view = await render(
      <ScanPage localBatchId={completed.localBatchId} repository={repository} />
    )

    await expectText('批次已锁定')
    await expectText('已完成')
    expect(getButton('加入待提交列表').disabled).toBe(true)
    expect(getButton('删除').disabled).toBe(true)
    expect(getLink('查看/导出批次')?.getAttribute('href')).toBe(
      `/submit/${completed.localBatchId}`
    )
    await clickButton('删除')
    await expectBatchItemsLength(repository, completed.localBatchId, 1)

    await view.cleanup()
  })

  it('uses native scanner only on native platform and stops the portal overlay', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    const stop = vi.fn(async () => undefined)
    const startScanner = vi.fn(async () => ({ stop }))
    const view = await render(
      <ScanPage
        localBatchId={batch.localBatchId}
        repository={repository}
        startScanner={startScanner}
      />
    )

    await expectText('开始扫码')
    await clickButton('开始扫码')

    await waitFor(() => {
      expect(
        document.querySelector('[data-scanner-overlay="true"]')
      ).not.toBeNull()
    })
    const rootElement = getRootElement()
    expect(rootElement.getAttribute('aria-hidden')).toBe('true')
    expect(rootElement.hasAttribute('inert')).toBe(true)
    expect(rootElement.inert).toBe(true)
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-labelledby')).toBe(
      'native-scanner-overlay-title'
    )
    expect(dialog?.getAttribute('aria-describedby')).toBe(
      'native-scanner-overlay-description'
    )
    expect(document.body.textContent).toContain('原生扫码进行中')
    const stopButton = getButton('停止扫码')
    expect(document.activeElement).toBe(stopButton)
    expect(stopButton.className).toContain('min-h-11')
    expect(stopButton.className).toContain('min-w-11')
    await clickButton('停止扫码')

    await waitFor(() => {
      expect(document.querySelector('[data-scanner-overlay="true"]')).toBeNull()
    })
    expect(rootElement.hasAttribute('aria-hidden')).toBe(false)
    expect(rootElement.hasAttribute('inert')).toBe(false)
    expect(rootElement.inert).not.toBe(true)
    expect(stop).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(getButton('开始扫码'))

    await view.cleanup()
  })

  it('shows scan success toast after native scan and auto-hides', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    let scannerOptions: StartScannerOptions | undefined
    const stop = vi.fn(async () => undefined)
    const startScanner = vi.fn(async (options: StartScannerOptions) => {
      scannerOptions = options
      return { stop }
    })
    const view = await render(
      <ScanPage
        localBatchId={batch.localBatchId}
        repository={repository}
        createClientItemID={() => 'item-toast'}
        now={() => '2026-01-01T00:02:00.000Z'}
        startScanner={startScanner}
      />
    )

    try {
      await expectText('开始扫码')
      await changeSelect('scan-rack', firstRack.name)
      await clickButton('开始扫码')
      await waitFor(() => {
        expect(scannerOptions).toBeDefined()
      })
      if (!scannerOptions) throw new Error('Scanner options were not captured')
      const capturedOptions = scannerOptions

      vi.useFakeTimers()
      await act(async () => {
        await (capturedOptions.onBarcode({
          rawValue: '  SN-TOAST-001  ',
          format: 'CODE_128',
        }) as unknown as Promise<void>)
      })

      const toast = document.querySelector('[data-testid="scan-success-toast"]')
      expect(toast?.textContent).toContain('SN-TOAST-001')

      await act(async () => {
        vi.advanceTimersByTime(1400)
      })

      expect(
        document.querySelector('[data-testid="scan-success-toast"]')
      ).toBeNull()
      await expectBatchItemsLength(repository, batch.localBatchId, 1)
    } finally {
      vi.useRealTimers()
      await view.cleanup()
    }
  })

  it('shows the approved duplicate message for rapid native same-batch scans', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    let nextItem = 0
    let scannerOptions: StartScannerOptions | undefined
    const stop = vi.fn(async () => undefined)
    const startScanner = vi.fn(async (options: StartScannerOptions) => {
      scannerOptions = options
      return { stop }
    })
    const view = await render(
      <ScanPage
        localBatchId={batch.localBatchId}
        repository={repository}
        createClientItemID={() => `item-fast-${++nextItem}`}
        startScanner={startScanner}
      />
    )

    await expectText('开始扫码')
    await changeSelect('scan-rack', firstRack.name)
    await clickButton('开始扫码')
    await waitFor(() => {
      expect(scannerOptions).toBeDefined()
    })
    if (!scannerOptions) throw new Error('Scanner options were not captured')
    const onBarcode = scannerOptions.onBarcode as unknown as (
      barcode: Parameters<StartScannerOptions['onBarcode']>[0]
    ) => Promise<void>

    await act(async () => {
      await Promise.all([
        onBarcode({ rawValue: 'SN-FAST-DUP', format: 'CODE_128' }),
        onBarcode({ rawValue: 'SN-FAST-DUP', format: 'CODE_128' }),
      ])
    })

    await expectText('这台设备的 SN 已在当前批次中记录，请勿重复扫描。')
    await expectBatchItemsLength(repository, batch.localBatchId, 1)
    expect(document.body.textContent).not.toContain('LOCAL_DB_UNAVAILABLE')
    expect(document.body.textContent).not.toContain('本地数据库暂时不可用')

    await view.cleanup()
  })

  it('keeps keyboard focus inside native scanner overlay and stops on Escape', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    const stop = vi.fn(async () => undefined)
    const startScanner = vi.fn(async () => ({ stop }))
    const view = await render(
      <ScanPage
        localBatchId={batch.localBatchId}
        repository={repository}
        startScanner={startScanner}
      />
    )

    await expectText('开始扫码')
    await clickButton('开始扫码')
    await waitFor(() => {
      expect(
        document.querySelector('[data-scanner-overlay="true"]')
      ).not.toBeNull()
    })

    const stopButton = getButton('停止扫码')
    expect(document.activeElement).toBe(stopButton)
    expect(await pressKey(stopButton, 'Tab')).toBe(false)
    expect(document.activeElement).toBe(stopButton)
    expect(await pressKey(stopButton, 'Tab', { shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(stopButton)

    expect(await pressKey(stopButton, 'Escape')).toBe(false)
    await waitFor(() => {
      expect(document.querySelector('[data-scanner-overlay="true"]')).toBeNull()
    })
    expect(stop).toHaveBeenCalledOnce()
    expect(getRootElement().hasAttribute('aria-hidden')).toBe(false)

    await view.cleanup()
  })

  it('clears native overlay and allows restart after native scanError stops the session', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    let scannerOptions: StartScannerOptions | undefined
    const stop = vi.fn(async () => undefined)
    const startScanner = vi.fn(async (options: StartScannerOptions) => {
      scannerOptions = options
      return { stop }
    })
    const view = await render(
      <ScanPage
        localBatchId={batch.localBatchId}
        repository={repository}
        startScanner={startScanner}
      />
    )

    await expectText('开始扫码')
    await clickButton('开始扫码')
    await waitFor(() => {
      expect(
        document.querySelector('[data-scanner-overlay="true"]')
      ).not.toBeNull()
    })
    const rootElement = getRootElement()
    expect(rootElement.getAttribute('aria-hidden')).toBe('true')
    expect(rootElement.hasAttribute('inert')).toBe(true)

    await act(async () => {
      scannerOptions?.onStopped?.()
      scannerOptions?.onError('camera failed')
    })

    await waitFor(() => {
      expect(document.querySelector('[data-scanner-overlay="true"]')).toBeNull()
    })
    expect(rootElement.hasAttribute('aria-hidden')).toBe(false)
    expect(rootElement.hasAttribute('inert')).toBe(false)
    expect(document.body.textContent).toContain('camera failed')
    expect(getButton('开始扫码').disabled).toBe(false)
    expect(document.activeElement).toBe(getButton('开始扫码'))

    await clickButton('开始扫码')
    expect(startScanner).toHaveBeenCalledTimes(2)

    await view.cleanup()
  })
})

async function createInitializedRepository(): Promise<LocalScanRepository> {
  const repository = createRepositoryForTests()
  await repository.initialize()
  await repository.saveOperatorName('张三')
  return repository
}

async function createBatch(
  repository: LocalScanRepository,
  overrides: Partial<CreateLocalBatchInput> = {}
): Promise<LocalScanBatchDetail> {
  clientBatchSequence += 1
  return repository.createBatch({
    clientBatchId: `client-batch-${clientBatchSequence}`,
    dataCenterId: firstDataCenter.id,
    roomId: firstRoom.id,
    arrivalBatchName: '2026-06 到货第一批',
    machineConfigSummary: 'GPU 服务器 / 2U / 双电源',
    defaultConfigNote: '默认配置备注',
    ...overrides,
  })
}

function itemInput(
  batch: LocalScanBatchDetail,
  overrides: Partial<AddScanItemInput> = {}
): AddScanItemInput {
  clientItemSequence += 1
  return {
    localBatchId: batch.localBatchId,
    clientItemId: `item-${clientItemSequence}`,
    rawValue: 'SN-001',
    barcodeFormat: 'manual',
    rackId: firstRack.id,
    rackName: firstRack.name,
    uPosition: null,
    ...overrides,
  }
}

async function render(element: React.ReactElement) {
  const container = document.createElement('div')
  container.id = 'root'
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

async function pressKey(
  target: Element,
  key: string,
  options: KeyboardEventInit = {}
) {
  let defaultNotPrevented = true
  await act(async () => {
    defaultNotPrevented = target.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key,
        ...options,
      })
    )
  })

  return defaultNotPrevented
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
  const input = document.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Input not found: ${selector}`)

  await act(async () => {
    setNativeValue(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
}

function linkHref(label: string) {
  const link = Array.from(document.querySelectorAll('a')).find(
    (element) => element.textContent === label
  )
  return link?.getAttribute('href')
}

function getLink(label: string) {
  return Array.from(document.querySelectorAll('a')).find(
    (element) => element.textContent === label
  )
}

async function expectText(text: string) {
  await waitFor(() => expect(document.body.textContent).toContain(text))
}

async function expectBatchItemsLength(
  repository: LocalScanRepository,
  localBatchId: string,
  length: number
) {
  await waitFor(async () => {
    const batch = await mustGetBatch(repository, localBatchId)
    expect(batch.items).toHaveLength(length)
  })
}

async function mustGetBatch(
  repository: LocalScanRepository,
  localBatchId: string
) {
  const batch = await repository.getBatch(localBatchId)
  if (!batch) throw new Error(`Batch not found: ${localBatchId}`)
  return batch
}

function getRootElement() {
  const root = document.getElementById('root') as InertRootElement | null
  if (!root) throw new Error('Root element not found')

  return root
}

type InertRootElement = HTMLElement & { inert?: boolean }

async function waitFor(assertion: () => void | Promise<void>) {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < 1500) {
    try {
      await assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }

  throw lastError
}
