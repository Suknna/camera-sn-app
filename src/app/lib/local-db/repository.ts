import { catalogSeed } from '@app/generated/catalog-seed'
import { createLocalAppError, isLocalAppError } from '../local-errors'
import {
  mapBatchAttributeRow,
  mapBatchSummaryRow,
  mapItemAttributeRow,
  mapProfileRow,
  mapScanItemRow,
  requiredString,
  summarySQL,
} from './repository-mappers'
import {
  createLocalBatchNo,
  createUUID,
  currentISOTime,
  isBatchCompleteReady,
  isValidUPosition,
  localID,
  normalizeAttributes,
  PROFILE_ID,
  type Clock,
  type IDGenerator,
  type Row,
} from './repository-helpers'
import { LOCAL_DB_SCHEMA_SQL } from './schema'
import type { LocalDBExecutor } from './sqlite-client'
import type {
  AddScanItemInput,
  AddScanItemResult,
  CreateLocalBatchInput,
  LocalExportRecord,
  LocalScanBatchDetail,
  LocalScanRepository,
} from './types'

export { createRepositoryForTests } from './memory-repository'

export interface LocalScanRepositoryOptions {
  now?: () => string
  randomUUID?: () => string
}

export function createLocalScanRepository(
  executor: LocalDBExecutor,
  options: LocalScanRepositoryOptions = {}
): LocalScanRepository {
  return new SQLiteLocalScanRepository(
    executor,
    options.now ?? currentISOTime,
    options.randomUUID ?? createUUID
  )
}

class SQLiteLocalScanRepository implements LocalScanRepository {
  constructor(
    private readonly executor: LocalDBExecutor,
    private readonly now: Clock,
    private readonly randomUUID: IDGenerator
  ) {}

  async initialize(): Promise<void> {
    await this.withLocalDBErrors(async () => {
      await this.executor.execute(LOCAL_DB_SCHEMA_SQL)
      await this.executor.transaction(async (tx) => {
        const existing = await tx.query<Row>(
          'SELECT version FROM catalog_seed WHERE version = ? LIMIT 1',
          [catalogSeed.version]
        )
        if (existing.length > 0) return

        await tx.run(
          'INSERT INTO catalog_seed (version, imported_at, source_hash) VALUES (?, ?, ?)',
          [catalogSeed.version, this.now(), catalogSeed.sourceHash]
        )
        for (const dataCenter of catalogSeed.dataCenters) {
          await tx.run(
            'INSERT INTO data_centers (id, name, seed_version) VALUES (?, ?, ?)',
            [dataCenter.id, dataCenter.name, catalogSeed.version]
          )
          for (const room of dataCenter.rooms) {
            await tx.run(
              'INSERT INTO rooms (id, data_center_id, name, seed_version) VALUES (?, ?, ?, ?)',
              [room.id, dataCenter.id, room.name, catalogSeed.version]
            )
            for (const rack of room.racks) {
              await tx.run(
                'INSERT INTO racks (id, room_id, name, seed_version) VALUES (?, ?, ?, ?)',
                [rack.id, room.id, rack.name, catalogSeed.version]
              )
            }
          }
        }
      })
    })
  }

  async getProfile() {
    return this.withLocalDBErrors(async () => {
      const rows = await this.executor.query<Row>(
        'SELECT operator_name, created_at, updated_at FROM app_profile WHERE id = ? LIMIT 1',
        [PROFILE_ID]
      )
      return rows[0] ? mapProfileRow(rows[0]) : null
    })
  }

  async saveOperatorName(operatorName: string) {
    const trimmedName = operatorName.trim()
    if (!trimmedName) throw createLocalAppError('OPERATOR_NAME_REQUIRED')

    return this.withLocalDBErrors(async () => {
      const timestamp = this.now()
      const existing = await this.getProfile()
      await this.executor.run(
        `INSERT INTO app_profile (id, operator_name, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           operator_name = excluded.operator_name,
           updated_at = excluded.updated_at`,
        [PROFILE_ID, trimmedName, existing?.createdAt ?? timestamp, timestamp]
      )
      return {
        operatorName: trimmedName,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }
    })
  }

  async listBatches() {
    return this.withLocalDBErrors(async () => {
      const rows = await this.executor.query<Row>(summarySQL())
      return rows.map(mapBatchSummaryRow)
    })
  }

  async createBatch(input: CreateLocalBatchInput): Promise<LocalScanBatchDetail> {
    const normalized = await this.normalizeCreateBatchInput(input)

    return this.withLocalDBErrors(async () => {
      const timestamp = this.now()
      const localBatchId = localID('batch', this.randomUUID)
      const batchNo = createLocalBatchNo(timestamp, this.randomUUID)

      await this.executor.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO scan_batches (
             local_batch_id, client_batch_id, batch_no, arrival_batch_name,
             operator_name, data_center_id, data_center_name, room_id,
             room_name, catalog_seed_version, machine_config_summary,
             default_config_note, status, created_at, updated_at,
             completed_at, last_exported_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL, NULL)`,
          [
            localBatchId,
            normalized.clientBatchId,
            batchNo,
            normalized.arrivalBatchName,
            normalized.operatorName,
            normalized.dataCenterId,
            normalized.catalog.dataCenterName,
            normalized.roomId,
            normalized.catalog.roomName,
            normalized.catalog.seedVersion,
            normalized.machineConfigSummary,
            normalized.defaultConfigNote,
            timestamp,
            timestamp,
          ]
        )
        for (const attribute of normalized.attributes) {
          await tx.run(
            `INSERT INTO batch_attributes
             (local_attribute_id, local_batch_id, key, value) VALUES (?, ?, ?, ?)`,
            [localID('batch_attr', this.randomUUID), localBatchId, attribute.key, attribute.value]
          )
        }
      })

      const batch = await this.getBatch(localBatchId)
      if (!batch) throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
      return batch
    })
  }

  async getBatch(localBatchId: string): Promise<LocalScanBatchDetail | null> {
    return this.withLocalDBErrors(async () => this.getBatchWithExecutor(this.executor, localBatchId))
  }

  async addScanItem(input: AddScanItemInput): Promise<AddScanItemResult> {
    const prepared = this.prepareScanItem(input)

    return this.withLocalDBErrors(async () => {
      const existingBatch = await this.getBatch(input.localBatchId)
      if (!existingBatch || existingBatch.status !== 'draft') {
        throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
      }
      await this.ensureNoBatchDuplicate(input.localBatchId, prepared.serialNumber)
      const duplicateInLocalHistory = await this.hasHistoricalDuplicate(
        input.localBatchId,
        prepared.serialNumber
      )
      const rack = await this.resolveRack(existingBatch.localBatchId, input.rackId, input.rackName)
      const timestamp = input.scannedAt ?? this.now()
      const localItemId = localID('item', this.randomUUID)
      const attributes = normalizeAttributes(input.attributes ?? [])

      try {
        await this.executor.transaction(async (tx) => {
          await tx.run(
            `INSERT INTO scan_items (
               local_item_id, client_item_id, local_batch_id, raw_value,
               serial_number, barcode_format, rack_id, rack_name, u_position,
               scanned_at, config_note_override, has_config_override
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              localItemId,
              input.clientItemId.trim(),
              input.localBatchId,
              input.rawValue,
              prepared.serialNumber,
              prepared.barcodeFormat,
              rack.rackId,
              rack.rackName,
              prepared.uPosition,
              timestamp,
              input.configNoteOverride?.trim() ?? '',
              input.hasConfigOverride ? 1 : 0,
            ]
          )
          for (const attribute of attributes) {
            await tx.run(
              `INSERT INTO scan_item_attributes
               (local_attribute_id, local_item_id, key, value) VALUES (?, ?, ?, ?)`,
              [localID('item_attr', this.randomUUID), localItemId, attribute.key, attribute.value]
            )
          }
          await tx.run('UPDATE scan_batches SET updated_at = ? WHERE local_batch_id = ?', [
            timestamp,
            input.localBatchId,
          ])
        })
      } catch (error) {
        if (isScanItemSerialUniqueConstraintError(error)) {
          throw createLocalAppError('SCAN_ITEM_DUPLICATE_IN_BATCH')
        }
        throw error
      }

      const batch = await this.getBatch(input.localBatchId)
      const item = batch?.items.find((candidate) => candidate.localItemId === localItemId)
      if (!batch || !item) throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
      return { item, batch, duplicateInLocalHistory }
    })
  }

  async removeScanItem(localBatchId: string, localItemId: string): Promise<void> {
    return this.withLocalDBErrors(async () => {
      const batch = await this.getBatch(localBatchId)
      if (!batch || batch.status !== 'draft') {
        throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
      }
      await this.executor.transaction(async (tx) => {
        await tx.run('DELETE FROM scan_items WHERE local_batch_id = ? AND local_item_id = ?', [
          localBatchId,
          localItemId,
        ])
        await tx.run('UPDATE scan_batches SET updated_at = ? WHERE local_batch_id = ?', [
          this.now(),
          localBatchId,
        ])
      })
    })
  }

  async completeBatch(localBatchId: string): Promise<LocalScanBatchDetail> {
    return this.withLocalDBErrors(async () => {
      const batch = await this.getBatch(localBatchId)
      if (!batch || batch.status !== 'draft' || !isBatchCompleteReady(batch)) {
        throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
      }
      const timestamp = this.now()
      await this.executor.run(
        `UPDATE scan_batches
         SET status = 'completed', completed_at = ?, updated_at = ?
         WHERE local_batch_id = ? AND status = 'draft'`,
        [timestamp, timestamp, localBatchId]
      )
      const completed = await this.getBatch(localBatchId)
      if (!completed) throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
      return completed
    })
  }

  async recordExport(input: Omit<LocalExportRecord, 'localExportId'>) {
    return this.withLocalDBErrors(async () => {
      const batch = await this.getBatch(input.localBatchId)
      if (!batch || batch.status === 'draft') throw createLocalAppError('BATCH_NOT_COMPLETED')

      const record: LocalExportRecord = {
        ...input,
        localExportId: localID('export', this.randomUUID),
      }
      await this.executor.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO batch_export_records
           (local_export_id, local_batch_id, file_name, file_uri, file_size,
            file_hash, exported_at, shared_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.localExportId,
            record.localBatchId,
            record.fileName,
            record.fileUri,
            record.fileSize,
            record.fileHash,
            record.exportedAt,
            record.sharedAt,
          ]
        )
        await tx.run(
          `UPDATE scan_batches
           SET status = 'exported', last_exported_at = ?, updated_at = ?
           WHERE local_batch_id = ?`,
          [record.exportedAt, record.exportedAt, record.localBatchId]
        )
      })
      return record
    })
  }

  private async normalizeCreateBatchInput(input: CreateLocalBatchInput) {
    const operatorName = (input.operatorName ?? (await this.getProfile())?.operatorName ?? '').trim()
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
      catalog: await this.resolveCatalogNames(dataCenterId, roomId),
    }
  }

  private prepareScanItem(input: AddScanItemInput) {
    const serialNumber = (input.serialNumber ?? input.rawValue).trim()
    const barcodeFormat = input.barcodeFormat.trim()
    const uPosition = input.uPosition ?? null
    if (!input.rawValue || !serialNumber || !barcodeFormat || !isValidUPosition(uPosition)) {
      throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    }
    return { serialNumber, barcodeFormat, uPosition }
  }

  private async resolveCatalogNames(dataCenterId: string, roomId: string) {
    const rows = await this.executor.query<Row>(
      `SELECT c.version AS seed_version, dc.name AS data_center_name, r.name AS room_name
       FROM catalog_seed c
       JOIN data_centers dc ON dc.seed_version = c.version
       JOIN rooms r ON r.seed_version = c.version AND r.data_center_id = dc.id
       WHERE dc.id = ? AND r.id = ?
       ORDER BY c.imported_at DESC
       LIMIT 1`,
      [dataCenterId, roomId]
    )
    if (!rows[0]) throw createLocalAppError('CATALOG_SEED_INVALID')
    return {
      seedVersion: requiredString(rows[0], 'seed_version'),
      dataCenterName: requiredString(rows[0], 'data_center_name'),
      roomName: requiredString(rows[0], 'room_name'),
    }
  }

  private async resolveRack(localBatchId: string, rackIdInput: string, rackNameInput?: string) {
    const rackId = rackIdInput.trim()
    if (!rackId) throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    if (rackNameInput?.trim()) return { rackId, rackName: rackNameInput.trim() }

    const rows = await this.executor.query<Row>(
      `SELECT rk.name AS rack_name
       FROM scan_batches b
       JOIN racks rk ON rk.seed_version = b.catalog_seed_version AND rk.room_id = b.room_id
       WHERE b.local_batch_id = ? AND rk.id = ?
       LIMIT 1`,
      [localBatchId, rackId]
    )
    if (!rows[0]) throw createLocalAppError('BATCH_REQUIRED_FIELDS_MISSING')
    return { rackId, rackName: requiredString(rows[0], 'rack_name') }
  }

  private async ensureNoBatchDuplicate(localBatchId: string, serialNumber: string) {
    const rows = await this.executor.query<Row>(
      `SELECT local_item_id FROM scan_items
       WHERE local_batch_id = ? AND serial_number = ? LIMIT 1`,
      [localBatchId, serialNumber]
    )
    if (rows.length > 0) throw createLocalAppError('SCAN_ITEM_DUPLICATE_IN_BATCH')
  }

  private async hasHistoricalDuplicate(localBatchId: string, serialNumber: string) {
    const rows = await this.executor.query<Row>(
      `SELECT local_item_id FROM scan_items
       WHERE local_batch_id <> ? AND serial_number = ? LIMIT 1`,
      [localBatchId, serialNumber]
    )
    return rows.length > 0
  }

  private async getBatchWithExecutor(executor: LocalDBExecutor, localBatchId: string) {
    const batchRows = await executor.query<Row>(summarySQL('WHERE b.local_batch_id = ?'), [
      localBatchId,
    ])
    if (!batchRows[0]) return null

    const [attributeRows, itemRows] = await Promise.all([
      executor.query<Row>(
        `SELECT local_attribute_id, key, value
         FROM batch_attributes
         WHERE local_batch_id = ?
         ORDER BY key ASC, local_attribute_id ASC`,
        [localBatchId]
      ),
      executor.query<Row>(
        `SELECT local_item_id, client_item_id, raw_value, serial_number,
                barcode_format, rack_id, rack_name, u_position, scanned_at,
                config_note_override, has_config_override
         FROM scan_items
         WHERE local_batch_id = ?
         ORDER BY scanned_at ASC, local_item_id ASC`,
        [localBatchId]
      ),
    ])
    const items = await Promise.all(
      itemRows.map(async (row) => {
        const localItemId = requiredString(row, 'local_item_id')
        const itemAttributes = await executor.query<Row>(
          `SELECT local_attribute_id, key, value
           FROM scan_item_attributes
           WHERE local_item_id = ?
           ORDER BY key ASC, local_attribute_id ASC`,
          [localItemId]
        )
        return mapScanItemRow(row, itemAttributes.map(mapItemAttributeRow))
      })
    )

    return {
      ...mapBatchSummaryRow(batchRows[0]),
      attributes: attributeRows.map(mapBatchAttributeRow),
      items,
    }
  }

  private async withLocalDBErrors<Result>(operation: () => Promise<Result>): Promise<Result> {
    try {
      return await operation()
    } catch (error) {
      if (isLocalAppError(error)) throw error
      throw createLocalAppError('LOCAL_DB_UNAVAILABLE', error)
    }
  }
}

function isScanItemSerialUniqueConstraintError(error: unknown): boolean {
  return errorMessages(error).some(
    (message) =>
      /unique constraint failed/i.test(message) &&
      message.includes('scan_items.local_batch_id') &&
      message.includes('scan_items.serial_number')
  )
}

function errorMessages(error: unknown): string[] {
  const messages: string[] = []
  if (error instanceof Error && error.message) messages.push(error.message)
  if (isLocalAppError(error)) messages.push(...errorMessages(error.cause))
  return messages
}
