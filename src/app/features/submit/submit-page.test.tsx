import { act } from 'react'
import type * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ACTIVE_DRAFT_STORAGE_KEY,
  createPendingDraft,
  loadActiveDraft,
  saveActiveDraft,
  type LocalCreatedDraft,
} from '@app/lib/local-draft-store'
import { createRepositoryForTests } from '@app/lib/local-db/repository'
import type {
  LocalScanBatchDetail,
  LocalScanRepository,
} from '@app/lib/local-db/types'
import { createLocalAppError } from '@app/lib/local-errors'
import type { AppRuntimeConfigResult } from '@app/lib/runtime-config'
import '@app/styles.css'
import { APIError } from '@shared/api/errors'
import { mobileScanBatchesApi } from '@shared/api/mobile/scan-batches'
import type { SubmitMobileScanBatchResult } from '@shared/types/mobile'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmitPage } from './submit-page'

const fixedExportDate = new Date(2026, 0, 2, 3, 4, 5)
const standaloneRuntimeConfig: AppRuntimeConfigResult = {
  ok: true,
  config: { controlPlaneMode: 'standalone' },
}
const requiredRuntimeConfig: AppRuntimeConfigResult = {
  ok: true,
  config: {
    controlPlaneMode: 'required',
    apiBaseURL: 'https://api.example.com',
  },
}
const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@app/lib/local-db/sqlite-client', async () => {
  const actual = await vi.importActual<
    typeof import('@app/lib/local-db/repository')
  >('@app/lib/local-db/repository')

  return {
    createSQLiteScanRepository: () => actual.createRepositoryForTests(),
  }
})

vi.mock('@shared/api/mobile/scan-batches', () => ({
  mobileScanBatchesApi: {
    submit: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(mobileScanBatchesApi.submit).mockResolvedValue(makeSubmitResult())
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('SubmitPage standalone mode', () => {
  it('shows a local missing-batch message without server submit APIs', async () => {
    const repository = await createInitializedRepository()
    const view = await render(
      <SubmitPage
        batchId='missing-batch'
        repository={repository}
        resolveRuntimeConfig={() => standaloneRuntimeConfig}
      />
    )

    await waitForText('未找到本地批次')
    expect(document.body.textContent).toContain('请返回首页选择本机已有批次')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('completes a draft local batch before export', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    await addItem(repository, batch)
    const view = await render(
      <SubmitPage
        batchId={batch.localBatchId}
        repository={repository}
        resolveRuntimeConfig={() => standaloneRuntimeConfig}
      />
    )

    await waitForText('批次摘要')
    expect(document.body.textContent).toContain('进行中')
    await clickButton('完成批次')

    await waitForText('导出 Excel 并分享')
    const completedBatch = await mustGetBatch(repository, batch.localBatchId)
    expect(completedBatch.status).toBe('completed')
    expect(document.body.textContent).toContain('已完成')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('exports, shares and records a completed local batch', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    await addItem(repository, batch, { rawValue: '0012345678', uPosition: 7 })
    const completed = await repository.completeBatch(batch.localBatchId)
    const xlsxBlob = new Blob(['xlsx'])
    const exportBatch = vi.fn<(batch: LocalScanBatchDetail) => Promise<Blob>>()
    const shareBlob = vi.fn<
      (input: { blob: Blob; fileName: string }) => Promise<{
        fileUri: string
        fileSize: number
        fileHash: string
      }>
    >()
    exportBatch.mockResolvedValue(xlsxBlob)
    shareBlob.mockResolvedValue({
      fileUri: 'file:///cache/示例数据中心01-A机房-20260102-030405.xlsx',
      fileSize: 4,
      fileHash: 'a'.repeat(64),
    })
    const view = await render(
      <SubmitPage
        batchId={completed.localBatchId}
        repository={repository}
        now={() => fixedExportDate}
        exportBatch={exportBatch}
        shareBlob={shareBlob}
        resolveRuntimeConfig={() => standaloneRuntimeConfig}
      />
    )

    await waitForText('导出 Excel 并分享')
    await clickButton('导出 Excel 并分享')

    await waitForText('Excel 已导出并唤起系统分享')
    const expectedFileName = '示例数据中心01-A机房-20260102-030405.xlsx'
    expect(exportBatch).toHaveBeenCalledWith(
      expect.objectContaining({ localBatchId: completed.localBatchId })
    )
    expect(shareBlob).toHaveBeenCalledWith({
      blob: xlsxBlob,
      fileName: expectedFileName,
    })
    const exportedBatch = await mustGetBatch(repository, completed.localBatchId)
    expect(exportedBatch.status).toBe('exported')
    expect(exportedBatch.lastExportedAt).toBe(fixedExportDate.toISOString())
    expect(document.body.textContent).toContain(expectedFileName)
    expect(document.body.textContent).toContain('文件大小：4 字节')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('shows local export errors without internal codes', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    await addItem(repository, batch)
    const completed = await repository.completeBatch(batch.localBatchId)
    const exportBatch = vi.fn<(batch: LocalScanBatchDetail) => Promise<Blob>>()
    exportBatch.mockRejectedValue(createLocalAppError('EXPORT_EXCEL_FAILED'))
    const view = await render(
      <SubmitPage
        batchId={completed.localBatchId}
        repository={repository}
        exportBatch={exportBatch}
        resolveRuntimeConfig={() => standaloneRuntimeConfig}
      />
    )

    await waitForText('导出 Excel 并分享')
    await clickButton('导出 Excel 并分享')

    await waitForText('Excel 生成失败')
    expect(document.body.textContent).toContain(
      'Excel 文件生成失败，请稍后重试。'
    )
    expect(document.body.textContent).not.toContain('EXPORT_EXCEL_FAILED')
    expect(document.body.textContent).not.toContain('错误码')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()

    await view.cleanup()
  })
})

describe('SubmitPage required control-plane mode', () => {
  it('blocks submit when the local draft is missing without local export', async () => {
    const exportBatch = vi.fn<(batch: LocalScanBatchDetail) => Promise<Blob>>()
    const shareBlob = vi.fn<
      (input: { blob: Blob; fileName: string }) => Promise<{
        fileUri: string
        fileSize: number
        fileHash: string
      }>
    >()
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        exportBatch={exportBatch}
        shareBlob={shareBlob}
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    expect(document.body.textContent).toContain('未找到可提交的本地草稿')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()
    expect(exportBatch).not.toHaveBeenCalled()
    expect(shareBlob).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('submits through the mobile submit mutation and never exports locally', async () => {
    saveActiveDraft(
      makeDraft({
        items: [
          makeDraftItem({
            clientItemId: 'item-1',
            serialNumber: 'RAW-001',
            barcodeFormat: 'manual',
            rawValue: '  RAW-001  ',
            rackId: 'rack-1',
            uPosition: null,
          }),
        ],
      })
    )
    const exportBatch = vi.fn<(batch: LocalScanBatchDetail) => Promise<Blob>>()
    const shareBlob = vi.fn<
      (input: { blob: Blob; fileName: string }) => Promise<{
        fileUri: string
        fileSize: number
        fileHash: string
      }>
    >()
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        exportBatch={exportBatch}
        shareBlob={shareBlob}
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await waitForText('提交摘要')
    expect(document.body.textContent).not.toContain('导出 Excel 并分享')
    await clickButton('提交批次')

    await waitFor(() =>
      expect(mobileScanBatchesApi.submit).toHaveBeenCalledTimes(1)
    )
    expect(vi.mocked(mobileScanBatchesApi.submit).mock.calls[0]).toEqual([
      'batch-1',
      {
        client_batch_id: 'batch_created',
        items: [
          {
            client_item_id: 'item-1',
            serial_number: 'RAW-001',
            barcode_format: 'manual',
            raw_value: '  RAW-001  ',
            rack_id: 'rack-1',
            u_position: null,
          },
        ],
      },
    ])
    await waitForText('批次提交完成')
    expect(loadActiveDraft()).toBeNull()
    expect(exportBatch).not.toHaveBeenCalled()
    expect(shareBlob).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('keeps the same mobile submit payload when retrying after failure', async () => {
    saveActiveDraft(
      makeDraft({
        items: [
          makeDraftItem({ clientItemId: 'item-1', serialNumber: 'SN-001' }),
          makeDraftItem({
            clientItemId: 'item-2',
            serialNumber: 'SN-002',
            rawValue: 'SN-002',
            rackId: 'rack-2',
            uPosition: 12,
          }),
        ],
      })
    )
    vi.mocked(mobileScanBatchesApi.submit)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(makeSubmitResult())
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await clickButton('提交批次')
    await waitForText('network down')
    saveActiveDraft(
      makeDraft({
        items: [
          makeDraftItem({
            clientItemId: 'item-new',
            serialNumber: 'SN-NEW',
            rawValue: 'SN-NEW',
          }),
        ],
      })
    )
    await clickButton('重试提交同一批次')

    await waitFor(() =>
      expect(mobileScanBatchesApi.submit).toHaveBeenCalledTimes(2)
    )
    const firstRequest = vi.mocked(mobileScanBatchesApi.submit).mock
      .calls[0]?.[1]
    const retryRequest = vi.mocked(mobileScanBatchesApi.submit).mock
      .calls[1]?.[1]
    expect(retryRequest).toEqual(firstRequest)

    await view.cleanup()
  })

  it('does not display internal API error codes', async () => {
    const draft = makeDraft({ items: [makeDraftItem()] })
    saveActiveDraft(draft)
    vi.mocked(mobileScanBatchesApi.submit).mockRejectedValueOnce(
      new APIError(
        { code: 'CONFLICT', message: '批次冲突', request_id: 'req-1' },
        409
      )
    )
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await clickButton('提交批次')

    await waitForText('批次冲突')
    expect(document.body.textContent).toContain('重试提交同一批次')
    expect(document.body.textContent).not.toContain('错误码')
    expect(document.body.textContent).not.toContain('CONFLICT')
    expect(loadActiveDraft()).toEqual(draft)

    await view.cleanup()
  })

  it('uses user-facing conflict messages in submit results', async () => {
    saveActiveDraft(makeDraft({ items: [makeDraftItem()] }))
    vi.mocked(mobileScanBatchesApi.submit).mockResolvedValueOnce(
      makeSubmitResult({
        status: 'submitted',
        accepted_count: 1,
        conflict_count: 1,
        items: [
          {
            client_item_id: 'item-1',
            scan_item_id: 'scan-1',
            serial_number: 'SN-001',
            status: 'accepted',
            conflict_reason: null,
          },
          {
            client_item_id: 'item-2',
            scan_item_id: 'scan-2',
            serial_number: 'SN-002',
            status: 'conflict',
            conflict_reason: 'SN_ALREADY_EXISTS',
          },
        ],
      })
    )
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await clickButton('提交批次')

    await waitForText('已接收条目')
    expect(document.body.textContent).toContain('冲突条目')
    expect(document.body.textContent).toContain('SN 已存在')
    expect(document.body.textContent).not.toContain('SN_ALREADY_EXISTS')
    expect(document.body.textContent).toContain('等待管理员审核')

    await view.cleanup()
  })

  it('does not send submit request when stored draft has no items', async () => {
    saveActiveDraft(makeDraft({ items: [] }))
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    await waitForText('提交摘要')
    await clickButton('提交批次')

    expect(document.body.textContent).toContain('扫描条目不能为空')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('blocks malformed stored drafts before mobile submit', async () => {
    localStorage.setItem(
      ACTIVE_DRAFT_STORAGE_KEY,
      JSON.stringify(
        makeDraft({
          items: [makeDraftItem({ uPosition: 61 })],
        })
      )
    )
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    expect(document.body.textContent).toContain('未找到可提交的本地草稿')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()

    await view.cleanup()
  })

  it('blocks pending-create draft before mobile submit', async () => {
    saveActiveDraft(
      createPendingDraft({
        clientBatchId: 'batch_pending',
        dataCenterId: 'dc-1',
        roomId: 'room-1',
        machineProfileId: 'profile-1',
        remark: '弱网重试',
      })
    )
    const view = await render(
      <SubmitPage
        batchId='batch-1'
        resolveRuntimeConfig={() => requiredRuntimeConfig}
      />
    )

    expect(document.body.textContent).toContain('本地草稿尚未完成后端创建')
    expect(mobileScanBatchesApi.submit).not.toHaveBeenCalled()

    await view.cleanup()
  })
})

async function createInitializedRepository(): Promise<LocalScanRepository> {
  const repository = createRepositoryForTests(createFixedStepClock())
  await repository.initialize()
  await repository.saveOperatorName('王工')
  return repository
}

async function createBatch(
  repository: LocalScanRepository
): Promise<LocalScanBatchDetail> {
  return repository.createBatch({
    clientBatchId: `client-batch-${Math.random()}`,
    dataCenterId: 'dc-demo-01',
    roomId: 'room-demo-a',
    arrivalBatchName: '到货批次一',
    machineConfigSummary: '2U 通用服务器 / 256G 内存',
    defaultConfigNote: '默认配置备注',
  })
}

async function addItem(
  repository: LocalScanRepository,
  batch: LocalScanBatchDetail,
  overrides: { rawValue?: string; uPosition?: number | null } = {}
) {
  return repository.addScanItem({
    localBatchId: batch.localBatchId,
    clientItemId: `item-${Math.random()}`,
    rawValue: overrides.rawValue ?? 'SN-001',
    serialNumber: overrides.rawValue ?? 'SN-001',
    barcodeFormat: 'CODE_128',
    rackId: 'rack-a01',
    uPosition: overrides.uPosition ?? null,
  })
}

async function mustGetBatch(
  repository: LocalScanRepository,
  localBatchId: string
): Promise<LocalScanBatchDetail> {
  const batch = await repository.getBatch(localBatchId)
  if (!batch) throw new Error(`missing local batch: ${localBatchId}`)
  return batch
}

function createFixedStepClock() {
  let tick = 0
  return () => {
    const second = `${tick++}`.padStart(2, '0')
    return `2026-01-02T03:04:${second}.000Z`
  }
}

function makeDraft(
  overrides: Partial<LocalCreatedDraft> = {}
): LocalCreatedDraft {
  return {
    state: 'draft',
    batchId: 'batch-1',
    batchNo: 'BATCH-001',
    clientBatchId: 'batch_created',
    dataCenterId: 'dc-1',
    roomId: 'room-1',
    machineProfileId: 'profile-1',
    remark: '到货扫描',
    items: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeDraftItem(
  overrides: Partial<LocalCreatedDraft['items'][number]> = {}
): LocalCreatedDraft['items'][number] {
  return {
    clientItemId: 'item-1',
    serialNumber: 'SN-001',
    barcodeFormat: 'CODE_128',
    rawValue: 'SN-001',
    rackId: 'rack-1',
    uPosition: null,
    createdAt: '2026-01-01T00:01:00.000Z',
    ...overrides,
  }
}

function makeSubmitResult(
  overrides: Partial<SubmitMobileScanBatchResult> = {}
): SubmitMobileScanBatchResult {
  return {
    batch_id: 'batch-1',
    status: 'accepted',
    accepted_count: 1,
    conflict_count: 0,
    items: [
      {
        client_item_id: 'item-1',
        scan_item_id: 'scan-1',
        serial_number: 'SN-001',
        status: 'accepted',
        conflict_reason: null,
      },
    ],
    ...overrides,
  }
}

async function render(element: React.ReactElement) {
  const container = document.createElement('div')
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
