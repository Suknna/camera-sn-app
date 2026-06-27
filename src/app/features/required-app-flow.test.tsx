import { act } from 'react'
import type * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BatchCreatePage } from '@app/features/batch-create/batch-create-page'
import { ScanPage } from '@app/features/scan/scan-page'
import { SubmitPage } from '@app/features/submit/submit-page'
import { loadActiveDraft } from '@app/lib/local-draft-store'
import type { AppRuntimeConfigResult } from '@app/lib/runtime-config'
import '@app/styles.css'
import { Capacitor } from '@capacitor/core'
import { mobileContextApi } from '@shared/api/mobile/context'
import { mobileScanBatchesApi } from '@shared/api/mobile/scan-batches'
import type {
  MobileContextDTO,
  MobileScanBatchDTO,
  SubmitMobileScanBatchResult,
} from '@shared/types/mobile'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    create: vi.fn(),
    get: vi.fn(),
    submit: vi.fn(),
    cancel: vi.fn(),
  },
}))

const requiredRuntimeConfig: AppRuntimeConfigResult = {
  ok: true,
  config: {
    controlPlaneMode: 'required',
    apiBaseURL: 'https://api.example.com',
  },
}

const context: MobileContextDTO = {
  data_centers: [
    {
      id: 'dc-1',
      code: 'SHA',
      name: '上海数据中心',
      rooms: [
        {
          id: 'room-1',
          code: 'R1',
          name: '一号机房',
          racks: [{ id: 'rack-1', code: 'A01', name: 'A01 机柜' }],
        },
      ],
    },
  ],
  machine_profiles: [{ id: 'profile-1', name: 'GPU 服务器' }],
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
  vi.mocked(mobileContextApi.getContext).mockResolvedValue(context)
  vi.mocked(mobileScanBatchesApi.create).mockResolvedValue(makeBatch())
  vi.mocked(mobileScanBatchesApi.get).mockResolvedValue(makeBatch())
  vi.mocked(mobileScanBatchesApi.submit).mockResolvedValue(makeSubmitResult())
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('required App create-scan-submit flow', () => {
  it('creates a server draft, records scans in active draft, then submits through mobile API', async () => {
    const navigateToScan = vi.fn()
    const createView = await render(
      <BatchCreatePage
        createClientBatchID={() => 'batch_generated'}
        navigateToScan={navigateToScan}
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await fillRequiredCreateForm()
    await clickButton('创建扫描批次')

    await waitFor(() => {
      expect(mobileScanBatchesApi.create).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(mobileScanBatchesApi.create).mock.calls[0]?.[0]).toEqual({
      client_batch_id: 'batch_generated',
      data_center_id: 'dc-1',
      room_id: 'room-1',
      machine_profile_id: 'profile-1',
      remark: '到货扫描',
    })
    expect(navigateToScan).toHaveBeenCalledWith('batch-1')
    expect(loadActiveDraft()).toMatchObject({
      state: 'draft',
      batchId: 'batch-1',
      clientBatchId: 'batch_generated',
      items: [],
    })
    await createView.cleanup()

    const scanView = await render(
      <ScanPage
        batchId='batch-1'
        createClientItemID={() => 'item-1'}
        now={() => '2026-01-01T00:02:00.000Z'}
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await waitForText('SN 原始值')
    await changeSelect('scan-rack', 'A01 机柜（A01）')
    await changeInput('input[name="rawValue"]', ' SN-FLOW ')
    await clickButton('加入待提交列表')

    await waitForText('SN：SN-FLOW')
    const scannedDraft = loadActiveDraft()
    if (scannedDraft?.state !== 'draft') throw new Error('expected created draft')
    expect(scannedDraft.items).toEqual([
      {
        clientItemId: 'item-1',
        serialNumber: 'SN-FLOW',
        barcodeFormat: 'manual',
        rawValue: ' SN-FLOW ',
        rackId: 'rack-1',
        uPosition: null,
        createdAt: '2026-01-01T00:02:00.000Z',
      },
    ])
    await scanView.cleanup()

    const submitView = await render(
      <SubmitPage
        batchId='batch-1'
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await waitForText('提交摘要')
    await clickButton('提交批次')

    await waitFor(() => {
      expect(mobileScanBatchesApi.submit).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(mobileScanBatchesApi.submit).mock.calls[0]).toEqual([
      'batch-1',
      {
        client_batch_id: 'batch_generated',
        items: [
          {
            client_item_id: 'item-1',
            serial_number: 'SN-FLOW',
            barcode_format: 'manual',
            raw_value: ' SN-FLOW ',
            rack_id: 'rack-1',
            u_position: null,
          },
        ],
      },
    ])
    await waitForText('批次提交完成')
    expect(loadActiveDraft()).toBeNull()

    await submitView.cleanup()
  })
})

function makeBatch(overrides: Partial<MobileScanBatchDTO> = {}): MobileScanBatchDTO {
  return {
    id: 'batch-1',
    batch_no: 'BATCH-001',
    client_batch_id: 'batch_generated',
    data_center_id: 'dc-1',
    room_id: 'room-1',
    machine_profile_id: 'profile-1',
    status: 'draft',
    remark: '到货扫描',
    submitted_at: null,
    ...overrides,
  }
}

function makeSubmitResult(): SubmitMobileScanBatchResult {
  return {
    batch_id: 'batch-1',
    status: 'accepted',
    accepted_count: 1,
    conflict_count: 0,
    items: [
      {
        client_item_id: 'item-1',
        scan_item_id: 'scan-1',
        serial_number: 'SN-FLOW',
        status: 'accepted',
        conflict_reason: null,
      },
    ],
  }
}

async function render(element: React.ReactElement) {
  const container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  let root: Root | undefined

  await act(async () => {
    root = createRoot(container)
    root.render(
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    )
  })

  return {
    cleanup: async () => {
      await act(async () => root?.unmount())
      queryClient.clear()
      container.remove()
      document.body.replaceChildren()
    },
  }
}

async function fillRequiredCreateForm() {
  await waitForText('批次信息')
  await changeSelect('batch-data-center', '上海数据中心（SHA）')
  await changeSelect('batch-room', '一号机房（R1）')
  await changeSelect('batch-machine-profile', 'GPU 服务器')
  await changeTextArea('#batch-remark', '到货扫描')
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
  const input = document.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Input not found: ${selector}`)

  await act(async () => {
    setNativeInputValue(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function changeTextArea(selector: string, value: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(selector)
  if (!textarea) throw new Error(`Textarea not found: ${selector}`)

  await act(async () => {
    setNativeInputValue(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const prototype = Object.getPrototypeOf(element) as
    | HTMLInputElement
    | HTMLTextAreaElement
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
}

async function waitForText(text: string) {
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
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 20))
      })
    }
  }

  throw lastError
}
