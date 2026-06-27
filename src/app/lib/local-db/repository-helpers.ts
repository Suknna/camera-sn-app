import { catalogSeed } from '@app/generated/catalog-seed'
import { createLocalAppError } from '../local-errors'
import type {
  AddScanItemInput,
  LocalBatchAttribute,
  LocalScanBatchDetail,
  LocalScanBatchSummary,
} from './types'

export type Clock = () => string
export type IDGenerator = () => string
export type Row = Record<string, unknown>

export interface CatalogNames {
  seedVersion: string
  dataCenterName: string
  roomName: string
}

export interface RackSnapshot {
  rackId: string
  rackName: string
}

export const PROFILE_ID = 1

export function normalizeAttributes(
  attributes: Array<Pick<LocalBatchAttribute, 'key' | 'value'>>
): Array<Pick<LocalBatchAttribute, 'key' | 'value'>> {
  return attributes
    .map((attribute) => ({
      key: attribute.key.trim(),
      value: attribute.value,
    }))
    .filter((attribute) => attribute.key.length > 0)
}

export function isBatchCompleteReady(batch: LocalScanBatchDetail): boolean {
  return (
    batch.items.length > 0 &&
    hasText(batch.operatorName) &&
    hasText(batch.arrivalBatchName) &&
    hasText(batch.machineConfigSummary) &&
    batch.items.every(
      (item) =>
        hasText(item.rackId) &&
        hasText(item.rackName) &&
        hasText(item.serialNumber) &&
        hasText(item.rawValue) &&
        hasText(item.barcodeFormat)
    )
  )
}

export function resolveSeedCatalog(
  dataCenterId: string,
  roomId: string
): CatalogNames {
  const dataCenter = catalogSeed.dataCenters.find(
    (candidate) => candidate.id === dataCenterId
  )
  const room = dataCenter?.rooms.find((candidate) => candidate.id === roomId)
  if (!dataCenter || !room) throw createLocalAppError('CATALOG_SEED_INVALID')

  return {
    seedVersion: catalogSeed.version,
    dataCenterName: dataCenter.name,
    roomName: room.name,
  }
}

export function resolveMemoryRack(
  batch: LocalScanBatchDetail,
  input: AddScanItemInput
): RackSnapshot {
  const rackId = input.rackId.trim()
  if (!rackId) throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
  if (input.rackName?.trim()) return { rackId, rackName: input.rackName.trim() }

  const dataCenter = catalogSeed.dataCenters.find(
    (candidate) => candidate.id === batch.dataCenterId
  )
  const room = dataCenter?.rooms.find((candidate) => candidate.id === batch.roomId)
  const rack = room?.racks.find((candidate) => candidate.id === rackId)
  if (!rack) throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')

  return { rackId, rackName: rack.name }
}

export function cloneBatch(batch: LocalScanBatchDetail): LocalScanBatchDetail {
  return {
    ...batch,
    attributes: batch.attributes.map((attribute) => ({ ...attribute })),
    items: batch.items.map((item) => ({
      ...item,
      attributes: item.attributes.map((attribute) => ({ ...attribute })),
    })),
  }
}

export function toSummary(batch: LocalScanBatchDetail): LocalScanBatchSummary {
  return {
    localBatchId: batch.localBatchId,
    clientBatchId: batch.clientBatchId,
    batchNo: batch.batchNo,
    arrivalBatchName: batch.arrivalBatchName,
    operatorName: batch.operatorName,
    dataCenterId: batch.dataCenterId,
    dataCenterName: batch.dataCenterName,
    roomId: batch.roomId,
    roomName: batch.roomName,
    machineConfigSummary: batch.machineConfigSummary,
    defaultConfigNote: batch.defaultConfigNote,
    status: batch.status,
    itemCount: batch.itemCount,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    completedAt: batch.completedAt,
    lastExportedAt: batch.lastExportedAt,
  }
}

export function hasText(value: string): boolean {
  return value.trim().length > 0
}

export function isValidUPosition(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 60)
}

export function localID(prefix: string, randomUUID: IDGenerator): string {
  return `${prefix}_${randomUUID()}`
}

export function createLocalBatchNo(
  timestamp: string,
  randomUUID: IDGenerator
): string {
  const compactTime = timestamp.replace(/[-:.TZ]/g, '').slice(0, 14)
  return `LOCAL-${compactTime}-${randomUUID().slice(0, 8)}`
}

export function currentISOTime(): string {
  return new Date().toISOString()
}

export function createUUID(): string {
  return crypto.randomUUID()
}

export function createIncrementingTestClock(): Clock {
  let tick = 0
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString()
}
