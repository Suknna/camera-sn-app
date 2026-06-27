import { act } from 'react'
import type * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRepositoryForTests } from '@app/lib/local-db/repository'
import type { LocalScanRepository } from '@app/lib/local-db/types'
import { createLocalAppError } from '@app/lib/local-errors'
import '@app/styles.css'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './home-page'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router'
  )

  return {
    ...actual,
    Link: ({
      to,
      children,
      ...props
    }: React.PropsWithChildren<{ to: string; className?: string }>) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

vi.mock('@app/lib/local-db/sqlite-client', async () => {
  const actual = await vi.importActual<
    typeof import('@app/lib/local-db/repository')
  >('@app/lib/local-db/repository')

  return {
    createSQLiteScanRepository: () => actual.createRepositoryForTests(),
  }
})

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it('shows operator name setup when local profile is missing', async () => {
    const repository = createRepositoryForTests()
    const view = await render(<HomePage repository={repository} />)

    await waitForText('设置操作人姓名')

    expect(document.body.textContent).toContain('操作人姓名')
    expect(document.body.textContent).not.toContain('本地扫描批次')

    await view.cleanup()
  })

  it('saves first-run operator name and returns to local home', async () => {
    const repository = createRepositoryForTests()
    const view = await render(<HomePage repository={repository} />)
    await waitForText('设置操作人姓名')

    await typeOperatorName('  王工  ')
    await clickButton('保存并进入首页')
    await waitForText('暂无本地批次')

    expect(await repository.getProfile()).toMatchObject({
      operatorName: '王工',
    })
    expect(getLink('开始扫描').getAttribute('href')).toBe('/batches/new')
    expect(document.body.textContent).toContain('当前操作人：王工')

    await view.cleanup()
  })

  it('renders local batch summaries from LocalScanRepository', async () => {
    const repository = createRepositoryForTests(createFixedStepClock())
    await repository.initialize()
    await repository.saveOperatorName('王工')
    const { draft, completed, exported } = await seedBatches(repository)
    const view = await render(<HomePage repository={repository} />)

    await waitForText(draft.batchNo)

    expect(document.body.textContent).toContain('本地批次列表')
    expect(document.body.textContent).toContain(draft.batchNo)
    expect(document.body.textContent).toContain(completed.batchNo)
    expect(document.body.textContent).toContain(exported.batchNo)
    expect(document.body.textContent).toContain('示例数据中心01')
    expect(document.body.textContent).toContain('A机房')
    expect(document.body.textContent).toContain('1 条')
    expect(document.body.textContent).toContain('进行中')
    expect(document.body.textContent).toContain('已完成')
    expect(document.body.textContent).toContain('已导出')
    expect(document.body.textContent).toContain('更新时间')
    expect(getLink('继续扫描').getAttribute('href')).toBe(
      `/scan/${draft.localBatchId}`
    )
    expect(
      getLinks('查看/导出').map((link) => link.getAttribute('href'))
    ).toEqual(
      expect.arrayContaining([
        `/submit/${completed.localBatchId}`,
        `/submit/${exported.localBatchId}`,
      ])
    )

    await view.cleanup()
  })

  it('renders local repository errors without internal error codes', async () => {
    const repository = createFailingRepository()
    const view = await render(<HomePage repository={repository} />)

    await waitForText('本地数据库不可用')

    expect(document.body.textContent).toContain('本地数据库暂时不可用')
    expect(document.body.textContent).not.toContain('LOCAL_DB_UNAVAILABLE')
    expect(document.body.textContent).not.toContain('错误代码')

    await view.cleanup()
  })
})

async function seedBatches(repository: LocalScanRepository) {
  const draft = await repository.createBatch({
    clientBatchId: 'client-draft',
    dataCenterId: 'dc-demo-01',
    roomId: 'room-demo-a',
    arrivalBatchName: '到货批次一',
    machineConfigSummary: '2U 通用服务器',
  })
  await repository.addScanItem({
    localBatchId: draft.localBatchId,
    clientItemId: 'item-draft-1',
    rawValue: 'SN-DRAFT-001',
    serialNumber: 'SN-DRAFT-001',
    barcodeFormat: 'CODE_128',
    rackId: 'rack-a01',
  })

  const completed = await repository.createBatch({
    clientBatchId: 'client-completed',
    dataCenterId: 'dc-demo-01',
    roomId: 'room-demo-a',
    arrivalBatchName: '到货批次二',
    machineConfigSummary: '1U 存储节点',
  })
  await repository.addScanItem({
    localBatchId: completed.localBatchId,
    clientItemId: 'item-completed-1',
    rawValue: 'SN-COMPLETED-001',
    serialNumber: 'SN-COMPLETED-001',
    barcodeFormat: 'CODE_128',
    rackId: 'rack-a01',
  })
  await repository.completeBatch(completed.localBatchId)

  const exported = await repository.createBatch({
    clientBatchId: 'client-exported',
    dataCenterId: 'dc-demo-01',
    roomId: 'room-demo-a',
    arrivalBatchName: '到货批次三',
    machineConfigSummary: 'GPU 训练节点',
  })
  await repository.addScanItem({
    localBatchId: exported.localBatchId,
    clientItemId: 'item-exported-1',
    rawValue: 'SN-EXPORTED-001',
    serialNumber: 'SN-EXPORTED-001',
    barcodeFormat: 'CODE_128',
    rackId: 'rack-a02',
  })
  await repository.completeBatch(exported.localBatchId)
  await repository.recordExport({
    localBatchId: exported.localBatchId,
    fileName: 'camera-sn-export.xlsx',
    fileUri: 'file:///camera-sn-export.xlsx',
    fileSize: 1024,
    fileHash: 'hash-exported',
    exportedAt: '2026-01-01T00:20:00.000',
    sharedAt: null,
  })

  return { draft, completed, exported }
}

function createFixedStepClock() {
  let tick = 0
  return () => {
    const second = `${tick++}`.padStart(2, '0')
    return `2026-01-01T00:00:${second}.000`
  }
}

function createFailingRepository(): LocalScanRepository {
  return {
    async initialize() {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
    },
    async getProfile() {
      return null
    },
    async saveOperatorName() {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
    },
    async listBatches() {
      return []
    },
    async createBatch() {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
    },
    async getBatch() {
      return null
    },
    async addScanItem() {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
    },
    async removeScanItem() {},
    async completeBatch() {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
    },
    async recordExport() {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
    },
  }
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

async function waitForText(text: string) {
  await waitFor(() => document.body.textContent?.includes(text) === true)
}

async function waitFor(assertion: () => boolean) {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (assertion()) return
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
  }

  throw new Error('Timed out waiting for expected UI state')
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

function getLink(label: string) {
  const link = getLinks(label)[0]
  if (!link) throw new Error(`Link not found: ${label}`)

  return link
}

function getLinks(label: string) {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).filter(
    (element) => element.textContent === label
  )
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
