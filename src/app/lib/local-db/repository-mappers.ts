import { createLocalAppError } from '../local-errors'
import type { Row } from './repository-helpers'
import type {
  AppProfile,
  LocalBatchAttribute,
  LocalBatchStatus,
  LocalScanBatchSummary,
  LocalScanItem,
  LocalScanItemAttribute,
} from './types'

export function summarySQL(whereClause = ''): string {
  return `SELECT b.local_batch_id, b.client_batch_id, b.batch_no,
                 b.arrival_batch_name, b.operator_name, b.data_center_id,
                 b.data_center_name, b.room_id, b.room_name,
                 b.machine_config_summary, b.default_config_note, b.status,
                 b.created_at, b.updated_at, b.completed_at, b.last_exported_at,
                 COUNT(si.local_item_id) AS item_count
          FROM scan_batches b
          LEFT JOIN scan_items si ON si.local_batch_id = b.local_batch_id
          ${whereClause}
          GROUP BY b.local_batch_id
          ORDER BY b.updated_at DESC`
}

export function mapProfileRow(row: Row): AppProfile {
  return {
    operatorName: requiredString(row, 'operator_name'),
    createdAt: requiredString(row, 'created_at'),
    updatedAt: requiredString(row, 'updated_at'),
  }
}

export function mapBatchSummaryRow(row: Row): LocalScanBatchSummary {
  return {
    localBatchId: requiredString(row, 'local_batch_id'),
    clientBatchId: requiredString(row, 'client_batch_id'),
    batchNo: requiredString(row, 'batch_no'),
    arrivalBatchName: requiredString(row, 'arrival_batch_name'),
    operatorName: requiredString(row, 'operator_name'),
    dataCenterId: requiredString(row, 'data_center_id'),
    dataCenterName: requiredString(row, 'data_center_name'),
    roomId: requiredString(row, 'room_id'),
    roomName: requiredString(row, 'room_name'),
    machineConfigSummary: requiredString(row, 'machine_config_summary'),
    defaultConfigNote: stringOrEmpty(row, 'default_config_note'),
    status: requiredStatus(row, 'status'),
    itemCount: Number(row.item_count ?? 0),
    createdAt: requiredString(row, 'created_at'),
    updatedAt: requiredString(row, 'updated_at'),
    completedAt: nullableString(row, 'completed_at'),
    lastExportedAt: nullableString(row, 'last_exported_at'),
  }
}

export function mapBatchAttributeRow(row: Row): LocalBatchAttribute {
  return {
    localAttributeId: requiredString(row, 'local_attribute_id'),
    key: requiredString(row, 'key'),
    value: stringOrEmpty(row, 'value'),
  }
}

export function mapScanItemRow(
  row: Row,
  attributes: LocalScanItemAttribute[]
): LocalScanItem {
  return {
    localItemId: requiredString(row, 'local_item_id'),
    clientItemId: requiredString(row, 'client_item_id'),
    rawValue: requiredString(row, 'raw_value'),
    serialNumber: requiredString(row, 'serial_number'),
    barcodeFormat: requiredString(row, 'barcode_format'),
    rackId: requiredString(row, 'rack_id'),
    rackName: requiredString(row, 'rack_name'),
    uPosition: nullableNumber(row, 'u_position'),
    scannedAt: requiredString(row, 'scanned_at'),
    configNoteOverride: stringOrEmpty(row, 'config_note_override'),
    hasConfigOverride: Number(row.has_config_override ?? 0) === 1,
    attributes,
  }
}

export function mapItemAttributeRow(row: Row): LocalScanItemAttribute {
  return {
    localAttributeId: requiredString(row, 'local_attribute_id'),
    key: requiredString(row, 'key'),
    value: stringOrEmpty(row, 'value'),
  }
}

export function requiredString(row: Row, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
  return value
}

function stringOrEmpty(row: Row, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function nullableString(row: Row, key: string): string | null {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

function nullableNumber(row: Row, key: string): number | null {
  const value = row[key]
  return typeof value === 'number' ? value : null
}

function requiredStatus(row: Row, key: string): LocalBatchStatus {
  const value = row[key]
  if (value === 'draft' || value === 'completed' || value === 'exported') return value
  throw createLocalAppError('LOCAL_DB_UNAVAILABLE')
}
