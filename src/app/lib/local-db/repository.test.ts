import { catalogSeed } from '@app/generated/catalog-seed'
import { createLocalAppError } from '../local-errors'
import { describe, expect, it } from 'vitest'
import { createLocalScanRepository, createRepositoryForTests } from './repository'
import { LOCAL_DB_SCHEMA_SQL } from './schema'
import type { LocalDBExecutor, SQLiteRow, SQLiteValue } from './sqlite-client'
import type {
  AddScanItemInput,
  CreateLocalBatchInput,
  LocalBatchStatus,
  LocalScanBatchDetail,
  LocalScanRepository,
} from './types'

const firstDataCenter = catalogSeed.dataCenters[0]!
const firstRoom = firstDataCenter.rooms[0]!
const firstRack = firstRoom.racks[0]!

async function createInitializedRepository(): Promise<LocalScanRepository> {
  const repository = createRepositoryForTests()
  await repository.initialize()
  await repository.saveOperatorName('  张三  ')
  return repository
}

function batchInput(
  overrides: Partial<CreateLocalBatchInput> = {}
): CreateLocalBatchInput {
  return {
    clientBatchId: `batch-${Math.random()}`,
    dataCenterId: firstDataCenter.id,
    roomId: firstRoom.id,
    arrivalBatchName: '一期到货',
    machineConfigSummary: '2U 通用服务器 / 256G 内存',
    defaultConfigNote: '默认配置备注',
    attributes: [{ key: '电源', value: '双电' }],
    ...overrides,
  }
}

async function createBatch(
  repository: LocalScanRepository,
  overrides: Partial<CreateLocalBatchInput> = {}
): Promise<LocalScanBatchDetail> {
  return repository.createBatch(batchInput(overrides))
}

function itemInput(
  batch: LocalScanBatchDetail,
  overrides: Partial<AddScanItemInput> = {}
): AddScanItemInput {
  return {
    localBatchId: batch.localBatchId,
    clientItemId: `item-${Math.random()}`,
    rawValue: '  SN-001  ',
    barcodeFormat: 'CODE_128',
    rackId: firstRack.id,
    uPosition: null,
    attributes: [{ key: '备注', value: '首台' }],
    ...overrides,
  }
}

interface FakeBatchRow extends SQLiteRow {
  local_batch_id: string
  client_batch_id: string
  batch_no: string
  arrival_batch_name: string
  operator_name: string
  data_center_id: string
  data_center_name: string
  room_id: string
  room_name: string
  machine_config_summary: string
  default_config_note: string
  status: LocalBatchStatus
  created_at: string
  updated_at: string
  completed_at: string | null
  last_exported_at: string | null
}

interface FakeScanItemRow extends SQLiteRow {
  local_item_id: string
  client_item_id: string
  local_batch_id: string
  raw_value: string
  serial_number: string
  barcode_format: string
  rack_id: string
  rack_name: string
  u_position: number | null
  scanned_at: string
  config_note_override: string
  has_config_override: number
}

class FakeLocalDBExecutor implements LocalDBExecutor {
  readonly runStatements: Array<{ statement: string; values: SQLiteValue[] }> = []

  constructor(
    private readonly batch: FakeBatchRow,
    private readonly items: FakeScanItemRow[],
    private readonly scanItemInsertError?: unknown
  ) {}

  async execute(): Promise<void> {}

  async run(statement: string, values: SQLiteValue[] = []): Promise<void> {
    this.runStatements.push({ statement, values })
    if (statement.includes('INSERT INTO scan_items') && this.scanItemInsertError) {
      throw this.scanItemInsertError
    }
    if (!statement.includes("SET status = 'completed'")) return
    if (!statement.includes("status = 'draft'")) {
      throw new Error('completeBatch SQL update must be limited to draft batches')
    }

    const [completedAt, updatedAt, localBatchId] = values
    if (localBatchId !== this.batch.local_batch_id || this.batch.status !== 'draft') return
    this.batch.status = 'completed'
    this.batch.completed_at = String(completedAt)
    this.batch.updated_at = String(updatedAt)
  }

  async query<Row extends SQLiteRow>(
    statement: string,
    values: SQLiteValue[] = []
  ): Promise<Row[]> {
    if (statement.includes('FROM scan_batches b')) {
      const [localBatchId] = values
      if (localBatchId !== this.batch.local_batch_id) return []
      return [
        {
          ...this.batch,
          item_count: this.items.filter((item) => item.local_batch_id === localBatchId).length,
        } as unknown as Row,
      ]
    }
    if (statement.includes('FROM batch_attributes')) return []
    if (statement.includes('FROM scan_items')) {
      const [localBatchId] = values
      return this.items.filter((item) => item.local_batch_id === localBatchId) as unknown as Row[]
    }
    if (statement.includes('FROM scan_item_attributes')) return []
    throw new Error(`Unexpected fake SQL query: ${statement}`)
  }

  async transaction<Result>(
    operation: (executor: LocalDBExecutor) => Promise<Result>
  ): Promise<Result> {
    return operation(this)
  }

  batchStatus(): LocalBatchStatus {
    return this.batch.status
  }
}

function fakeBatchRow(status: LocalBatchStatus): FakeBatchRow {
  return {
    local_batch_id: 'batch-sql',
    client_batch_id: 'client-batch-sql',
    batch_no: 'LOCAL-20260101000000-sqltest',
    arrival_batch_name: 'SQL 到货批次',
    operator_name: 'SQL Tester',
    data_center_id: firstDataCenter.id,
    data_center_name: firstDataCenter.name,
    room_id: firstRoom.id,
    room_name: firstRoom.name,
    machine_config_summary: 'SQL smoke config',
    default_config_note: '',
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: status === 'draft' ? null : '2026-01-01T00:00:01.000Z',
    last_exported_at: status === 'exported' ? '2026-01-01T00:00:02.000Z' : null,
  }
}

function fakeScanItemRow(): FakeScanItemRow {
  return {
    local_item_id: 'item-sql',
    client_item_id: 'client-item-sql',
    local_batch_id: 'batch-sql',
    raw_value: 'SN-SQL',
    serial_number: 'SN-SQL',
    barcode_format: 'CODE_128',
    rack_id: firstRack.id,
    rack_name: firstRack.name,
    u_position: null,
    scanned_at: '2026-01-01T00:00:00.000Z',
    config_note_override: '',
    has_config_override: 0,
  }
}

describe('local db schema', () => {
  it('declares required standalone repository constraints', () => {
    expect(LOCAL_DB_SCHEMA_SQL).toContain('client_batch_id TEXT NOT NULL UNIQUE')
    expect(LOCAL_DB_SCHEMA_SQL).toContain('UNIQUE (local_batch_id, client_item_id)')
    expect(LOCAL_DB_SCHEMA_SQL).toContain('UNIQUE (local_batch_id, serial_number)')
    expect(LOCAL_DB_SCHEMA_SQL).toContain("status IN ('draft', 'completed', 'exported')")
    expect(LOCAL_DB_SCHEMA_SQL).toContain(
      'u_position INTEGER CHECK (u_position IS NULL OR (u_position BETWEEN 1 AND 60))'
    )
  })
})

describe('local scan repository', () => {
  it('initializes the catalog seed idempotently and creates batches with name snapshots', async () => {
    const repository = createRepositoryForTests()

    await repository.initialize()
    await repository.initialize()
    await repository.saveOperatorName('李四')
    const batch = await createBatch(repository)

    expect(batch.dataCenterName).toBe(firstDataCenter.name)
    expect(batch.roomName).toBe(firstRoom.name)
    expect(batch.operatorName).toBe('李四')
    expect(batch.status).toBe('draft')
    expect(batch.attributes).toEqual([
      expect.objectContaining({ key: '电源', value: '双电' }),
    ])
  })

  it('saves and loads a trimmed operator name', async () => {
    const repository = createRepositoryForTests()
    await repository.initialize()

    await expect(repository.saveOperatorName('   ')).rejects.toMatchObject({
      code: 'OPERATOR_NAME_REQUIRED',
    })
    const profile = await repository.saveOperatorName('  王五  ')

    expect(profile.operatorName).toBe('王五')
    await expect(repository.getProfile()).resolves.toMatchObject({
      operatorName: '王五',
    })
  })

  it('lists multiple batches with item counts and newest updates first', async () => {
    const repository = await createInitializedRepository()
    const olderBatch = await createBatch(repository, {
      clientBatchId: 'batch-older',
      arrivalBatchName: '第一批',
    })
    const newerBatch = await createBatch(repository, {
      clientBatchId: 'batch-newer',
      arrivalBatchName: '第二批',
    })
    await repository.addScanItem(itemInput(newerBatch, { rawValue: 'SN-002' }))

    const batches = await repository.listBatches()

    expect(batches).toHaveLength(2)
    expect(batches[0]).toMatchObject({
      localBatchId: newerBatch.localBatchId,
      arrivalBatchName: '第二批',
      itemCount: 1,
    })
    expect(batches[1]).toMatchObject({ localBatchId: olderBatch.localBatchId })
  })

  it('rejects duplicate serial numbers in the same batch', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    await repository.addScanItem(itemInput(batch, { rawValue: 'SN-DUP' }))

    await expect(
      repository.addScanItem(
        itemInput(batch, { clientItemId: 'item-dup-2', rawValue: ' SN-DUP ' })
      )
    ).rejects.toMatchObject({ code: 'SCAN_ITEM_DUPLICATE_IN_BATCH' })
  })

  it('keeps historical duplicate scans while warning the caller', async () => {
    const repository = await createInitializedRepository()
    const firstBatch = await createBatch(repository, { clientBatchId: 'batch-a' })
    const secondBatch = await createBatch(repository, { clientBatchId: 'batch-b' })
    await repository.addScanItem(itemInput(firstBatch, { rawValue: 'SN-HISTORY' }))

    const result = await repository.addScanItem(
      itemInput(secondBatch, { rawValue: ' SN-HISTORY ', clientItemId: 'item-history-2' })
    )

    expect(result.duplicateInLocalHistory).toBe(true)
    expect(result.batch.items).toHaveLength(1)
    expect(result.item.rawValue).toBe(' SN-HISTORY ')
    expect(result.item.serialNumber).toBe('SN-HISTORY')
  })

  it('completes a valid batch and refuses empty batches', async () => {
    const repository = await createInitializedRepository()
    const emptyBatch = await createBatch(repository, { clientBatchId: 'batch-empty' })
    await expect(
      repository.completeBatch(emptyBatch.localBatchId)
    ).rejects.toMatchObject({ code: 'BATCH_REQUIRED_FIELDS_MISSING' })

    const batch = await createBatch(repository, { clientBatchId: 'batch-ready' })
    await repository.addScanItem(itemInput(batch, { rawValue: 'SN-COMPLETE' }))
    const completed = await repository.completeBatch(batch.localBatchId)

    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toBeTruthy()
    expect(completed.items[0]?.rackName).toBe(firstRack.name)
  })

  it('refuses to complete locked batches without changing their status', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository, { clientBatchId: 'batch-locked-complete' })
    await repository.addScanItem(itemInput(batch, { rawValue: 'SN-LOCKED-COMPLETE' }))
    const completed = await repository.completeBatch(batch.localBatchId)

    await expect(
      repository.completeBatch(completed.localBatchId)
    ).rejects.toMatchObject({ code: 'BATCH_REQUIRED_FIELDS_MISSING' })
    await expect(repository.getBatch(completed.localBatchId)).resolves.toMatchObject({
      status: 'completed',
    })

    await repository.recordExport({
      localBatchId: completed.localBatchId,
      fileName: 'completed-export.xlsx',
      fileUri: 'file:///cache/completed-export.xlsx',
      fileSize: 2048,
      fileHash: 'sha256-completed-export',
      exportedAt: '2026-06-26T16:30:00.000Z',
      sharedAt: null,
    })

    await expect(
      repository.completeBatch(completed.localBatchId)
    ).rejects.toMatchObject({ code: 'BATCH_REQUIRED_FIELDS_MISSING' })
    await expect(repository.getBatch(completed.localBatchId)).resolves.toMatchObject({
      status: 'exported',
    })
  })

  it('refuses to mutate scan items after a batch is completed or exported', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository, { clientBatchId: 'batch-locked-items' })
    const added = await repository.addScanItem(
      itemInput(batch, { rawValue: 'SN-LOCKED-ITEMS' })
    )
    const completed = await repository.completeBatch(batch.localBatchId)
    const localItemId = completed.items[0]?.localItemId

    expect(localItemId).toBeTruthy()
    await expect(
      repository.addScanItem(
        itemInput(completed, {
          clientItemId: 'item-after-completed',
          rawValue: 'SN-AFTER-COMPLETED',
        })
      )
    ).rejects.toMatchObject({ code: 'BATCH_REQUIRED_FIELDS_MISSING' })
    await expect(
      repository.removeScanItem(completed.localBatchId, localItemId!)
    ).rejects.toMatchObject({ code: 'BATCH_REQUIRED_FIELDS_MISSING' })
    await expect(repository.getBatch(completed.localBatchId)).resolves.toMatchObject({
      status: 'completed',
      itemCount: 1,
    })

    await repository.recordExport({
      localBatchId: completed.localBatchId,
      fileName: 'locked-items-export.xlsx',
      fileUri: 'file:///cache/locked-items-export.xlsx',
      fileSize: 4096,
      fileHash: 'sha256-locked-items-export',
      exportedAt: '2026-06-26T17:30:00.000Z',
      sharedAt: null,
    })

    await expect(
      repository.addScanItem(
        itemInput(added.batch, {
          clientItemId: 'item-after-exported',
          rawValue: 'SN-AFTER-EXPORTED',
        })
      )
    ).rejects.toMatchObject({ code: 'BATCH_REQUIRED_FIELDS_MISSING' })
    await expect(
      repository.removeScanItem(completed.localBatchId, localItemId!)
    ).rejects.toMatchObject({ code: 'BATCH_REQUIRED_FIELDS_MISSING' })
    await expect(repository.getBatch(completed.localBatchId)).resolves.toMatchObject({
      status: 'exported',
      itemCount: 1,
    })
  })

  it('refuses to record exports for draft batches', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository, { clientBatchId: 'batch-draft-export' })

    await expect(
      repository.recordExport({
        localBatchId: batch.localBatchId,
        fileName: 'draft-export.xlsx',
        fileUri: 'file:///cache/draft-export.xlsx',
        fileSize: 512,
        fileHash: 'sha256-draft-export',
        exportedAt: '2026-06-26T18:30:00.000Z',
        sharedAt: null,
      })
    ).rejects.toMatchObject({ code: 'BATCH_NOT_COMPLETED' })
    await expect(repository.getBatch(batch.localBatchId)).resolves.toMatchObject({
      status: 'draft',
    })
  })

  it('records an export and promotes the batch to exported', async () => {
    const repository = await createInitializedRepository()
    const batch = await createBatch(repository)
    await repository.addScanItem(itemInput(batch, { rawValue: 'SN-EXPORT' }))
    const completed = await repository.completeBatch(batch.localBatchId)

    const record = await repository.recordExport({
      localBatchId: completed.localBatchId,
      fileName: '示例数据中心01-A机房-20260626-153000.xlsx',
      fileUri: 'file:///cache/export.xlsx',
      fileSize: 1024,
      fileHash: 'sha256-demo',
      exportedAt: '2026-06-26T15:30:00.000Z',
      sharedAt: null,
    })
    const exported = await repository.getBatch(batch.localBatchId)

    expect(record.localExportId).toMatch(/^export_/)
    expect(exported).toMatchObject({
      status: 'exported',
      lastExportedAt: '2026-06-26T15:30:00.000Z',
    })
  })
})

describe('local scan repository SQL executor smoke', () => {
  it('completes draft batches through a draft-only SQL update', async () => {
    const executor = new FakeLocalDBExecutor(fakeBatchRow('draft'), [fakeScanItemRow()])
    const repository = createLocalScanRepository(executor, {
      now: () => '2026-01-01T00:00:03.000Z',
      randomUUID: () => 'sql-smoke',
    })

    const completed = await repository.completeBatch('batch-sql')

    expect(completed.status).toBe('completed')
    expect(executor.batchStatus()).toBe('completed')
    expect(executor.runStatements[0]?.statement).toContain(
      "WHERE local_batch_id = ? AND status = 'draft'"
    )
  })

  it('refuses exported batches before running a SQL status update', async () => {
    const executor = new FakeLocalDBExecutor(fakeBatchRow('exported'), [fakeScanItemRow()])
    const repository = createLocalScanRepository(executor, {
      now: () => '2026-01-01T00:00:03.000Z',
      randomUUID: () => 'sql-smoke',
    })

    await expect(repository.completeBatch('batch-sql')).rejects.toMatchObject({
      code: 'BATCH_REQUIRED_FIELDS_MISSING',
    })

    expect(executor.batchStatus()).toBe('exported')
    expect(executor.runStatements).toEqual([])
  })

  it('maps scan item serial unique constraint failures to the same-batch duplicate error', async () => {
    const executor = new FakeLocalDBExecutor(
      fakeBatchRow('draft'),
      [],
      createLocalAppError(
        'LOCAL_DB_UNAVAILABLE',
        new Error(
          'UNIQUE constraint failed: scan_items.local_batch_id, scan_items.serial_number'
        )
      )
    )
    const repository = createLocalScanRepository(executor, {
      now: () => '2026-01-01T00:00:03.000Z',
      randomUUID: () => 'sql-smoke',
    })

    await expect(
      repository.addScanItem({
        localBatchId: 'batch-sql',
        clientItemId: 'client-item-duplicate',
        rawValue: ' SN-SQL-DUP ',
        barcodeFormat: 'CODE_128',
        rackId: firstRack.id,
        rackName: firstRack.name,
        uPosition: null,
      })
    ).rejects.toMatchObject({ code: 'SCAN_ITEM_DUPLICATE_IN_BATCH' })
  })
})
