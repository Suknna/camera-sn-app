import { catalogSeed } from '@app/generated/catalog-seed'
import { createLocalAppError } from '../local-errors'
import {
  cloneBatch,
  createLocalBatchNo,
  createUUID,
  isBatchCompleteReady,
  isValidUPosition,
  localID,
  normalizeAttributes,
  resolveMemoryRack,
  resolveSeedCatalog,
  toSummary,
  type Clock,
  type IDGenerator,
} from './repository-helpers'
import type {
  AddScanItemInput,
  AddScanItemResult,
  AppProfile,
  CreateLocalBatchInput,
  LocalExportRecord,
  LocalScanBatchDetail,
  LocalScanRepository,
} from './types'

export function createRepositoryForTests(
  now: Clock = createIncrementingTestClock()
): LocalScanRepository {
  return new MemoryLocalScanRepository(now, createUUID)
}

class MemoryLocalScanRepository implements LocalScanRepository {
  private profile: AppProfile | null = null
  private readonly batches = new Map<string, LocalScanBatchDetail>()
  private readonly exportRecords: LocalExportRecord[] = []
  private initializedSeedVersion: string | null = null

  constructor(
    private readonly now: Clock,
    private readonly randomUUID: IDGenerator
  ) {}

  async initialize(): Promise<void> {
    this.initializedSeedVersion = catalogSeed.version
  }

  async getProfile(): Promise<AppProfile | null> {
    return this.profile ? { ...this.profile } : null
  }

  async saveOperatorName(operatorName: string): Promise<AppProfile> {
    const trimmedName = operatorName.trim()
    if (!trimmedName) throw createLocalAppError('OPERATOR_NAME_REQUIRED')
    const timestamp = this.now()
    this.profile = {
      operatorName: trimmedName,
      createdAt: this.profile?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    return { ...this.profile }
  }

  async listBatches() {
    return Array.from(this.batches.values())
      .map(toSummary)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async createBatch(input: CreateLocalBatchInput): Promise<LocalScanBatchDetail> {
    const normalized = this.normalizeCreateBatchInput(input)
    if (
      Array.from(this.batches.values()).some(
        (batch) => batch.clientBatchId === normalized.clientBatchId
      )
    ) {
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
    }

    const timestamp = this.now()
    const batch: LocalScanBatchDetail = {
      localBatchId: localID('batch', this.randomUUID),
      clientBatchId: normalized.clientBatchId,
      batchNo: createLocalBatchNo(timestamp, this.randomUUID),
      arrivalBatchName: normalized.arrivalBatchName,
      operatorName: normalized.operatorName,
      dataCenterId: normalized.dataCenterId,
      dataCenterName: normalized.catalog.dataCenterName,
      roomId: normalized.roomId,
      roomName: normalized.catalog.roomName,
      machineConfigSummary: normalized.machineConfigSummary,
      defaultConfigNote: normalized.defaultConfigNote,
      status: 'draft',
      itemCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      lastExportedAt: null,
      attributes: normalized.attributes.map((attribute) => ({
        localAttributeId: localID('batch_attr', this.randomUUID),
        ...attribute,
      })),
      items: [],
    }
    this.batches.set(batch.localBatchId, batch)
    return cloneBatch(batch)
  }

  async getBatch(localBatchId: string): Promise<LocalScanBatchDetail | null> {
    const batch = this.batches.get(localBatchId)
    return batch ? cloneBatch(batch) : null
  }

  async addScanItem(input: AddScanItemInput): Promise<AddScanItemResult> {
    const batch = this.batches.get(input.localBatchId)
    if (!batch || batch.status !== 'draft') {
      throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    }

    const serialNumber = (input.serialNumber ?? input.rawValue).trim()
    const barcodeFormat = input.barcodeFormat.trim()
    const uPosition = input.uPosition ?? null
    if (!input.rawValue || !serialNumber || !barcodeFormat || !isValidUPosition(uPosition)) {
      throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    }
    if (batch.items.some((item) => item.serialNumber === serialNumber)) {
      throw createLocalAppError('SCAN_ITEM_DUPLICATE_IN_BATCH')
    }

    const duplicateInLocalHistory = Array.from(this.batches.values()).some(
      (candidate) =>
        candidate.localBatchId !== batch.localBatchId &&
        candidate.items.some((item) => item.serialNumber === serialNumber)
    )
    const rack = resolveMemoryRack(batch, input)
    const timestamp = input.scannedAt ?? this.now()
    const item = {
      localItemId: localID('item', this.randomUUID),
      clientItemId: input.clientItemId.trim(),
      rawValue: input.rawValue,
      serialNumber,
      barcodeFormat,
      rackId: rack.rackId,
      rackName: rack.rackName,
      uPosition,
      scannedAt: timestamp,
      configNoteOverride: input.configNoteOverride?.trim() ?? '',
      hasConfigOverride: input.hasConfigOverride ?? false,
      attributes: normalizeAttributes(input.attributes ?? []).map((attribute) => ({
        localAttributeId: localID('item_attr', this.randomUUID),
        ...attribute,
      })),
    }
    batch.items.push(item)
    batch.itemCount = batch.items.length
    batch.updatedAt = timestamp
    return {
      item: { ...item, attributes: item.attributes.map((attribute) => ({ ...attribute })) },
      batch: cloneBatch(batch),
      duplicateInLocalHistory,
    }
  }

  async removeScanItem(localBatchId: string, localItemId: string): Promise<void> {
    const batch = this.batches.get(localBatchId)
    if (!batch || batch.status !== 'draft') {
      throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    }
    batch.items = batch.items.filter((item) => item.localItemId !== localItemId)
    batch.itemCount = batch.items.length
    batch.updatedAt = this.now()
  }

  async completeBatch(localBatchId: string): Promise<LocalScanBatchDetail> {
    const batch = this.batches.get(localBatchId)
    if (!batch || batch.status !== 'draft' || !isBatchCompleteReady(batch)) {
      throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    }
    const timestamp = this.now()
    batch.status = 'completed'
    batch.completedAt = timestamp
    batch.updatedAt = timestamp
    return cloneBatch(batch)
  }

  async recordExport(
    input: Omit<LocalExportRecord, 'localExportId'>
  ): Promise<LocalExportRecord> {
    const batch = this.batches.get(input.localBatchId)
    if (!batch || batch.status === 'draft') throw createLocalAppError('BATCH_NOT_COMPLETED')

    const record: LocalExportRecord = {
      ...input,
      localExportId: localID('export', this.randomUUID),
    }
    this.exportRecords.push(record)
    batch.status = 'exported'
    batch.lastExportedAt = record.exportedAt
    batch.updatedAt = record.exportedAt
    return { ...record }
  }

  private normalizeCreateBatchInput(input: CreateLocalBatchInput) {
    if (!this.initializedSeedVersion) throw createLocalAppError('CATALOG_SEED_INVALID')
    const operatorName = (input.operatorName ?? this.profile?.operatorName ?? '').trim()
    const clientBatchId = input.clientBatchId.trim()
    const arrivalBatchName = input.arrivalBatchName.trim()
    const dataCenterId = input.dataCenterId.trim()
    const roomId = input.roomId.trim()
    const machineConfigSummary = input.machineConfigSummary.trim()
    if (!operatorName || !clientBatchId || !arrivalBatchName || !dataCenterId || !roomId || !machineConfigSummary) {
      throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    }

    return {
      clientBatchId,
      operatorName,
      arrivalBatchName,
      dataCenterId,
      roomId,
      machineConfigSummary,
      defaultConfigNote: input.defaultConfigNote?.trim() ?? '',
      attributes: normalizeAttributes(input.attributes ?? []),
      catalog: resolveSeedCatalog(dataCenterId, roomId),
    }
  }
}

function createIncrementingTestClock(): Clock {
  let tick = 0
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString()
}
