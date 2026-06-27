export interface LocalDraftScanItem {
  clientItemId: string
  serialNumber: string
  barcodeFormat: string
  rawValue: string
  rackId: string
  uPosition: number | null
  createdAt: string
}

export interface LocalPendingCreateDraft {
  state: 'pending_create'
  clientBatchId: string
  dataCenterId: string
  roomId: string
  machineProfileId: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface LocalCreatedDraft {
  state: 'draft'
  batchId: string
  batchNo: string
  clientBatchId: string
  dataCenterId: string
  roomId: string
  machineProfileId: string
  remark: string
  items: LocalDraftScanItem[]
  createdAt: string
  updatedAt: string
}

export type LocalActiveDraft = LocalPendingCreateDraft | LocalCreatedDraft

export const ACTIVE_DRAFT_STORAGE_KEY = 'camera-sn-app-active-draft-v1'

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isValidItem(value: unknown): value is LocalDraftScanItem {
  const item = value as LocalDraftScanItem
  return (
    Boolean(item) &&
    isString(item.clientItemId) &&
    isString(item.serialNumber) &&
    isString(item.barcodeFormat) &&
    isString(item.rawValue) &&
    isString(item.rackId) &&
    (item.uPosition === null ||
      (Number.isInteger(item.uPosition) &&
        item.uPosition >= 1 &&
        item.uPosition <= 60)) &&
    isString(item.createdAt)
  )
}

function isValidDraft(value: unknown): value is LocalActiveDraft {
  const draft = value as LocalActiveDraft
  const commonFieldsValid =
    Boolean(draft) &&
    isString(draft.clientBatchId) &&
    isString(draft.dataCenterId) &&
    isString(draft.roomId) &&
    isString(draft.machineProfileId) &&
    isString(draft.remark) &&
    isString(draft.createdAt) &&
    isString(draft.updatedAt)

  if (!commonFieldsValid) return false

  if (draft.state === 'pending_create') {
    return true
  }

  return (
    draft.state === 'draft' &&
    isString(draft.batchId) &&
    isString(draft.batchNo) &&
    Array.isArray(draft.items) &&
    draft.items.every(isValidItem)
  )
}

export function isCreatedDraft(
  draft: LocalActiveDraft | null
): draft is LocalCreatedDraft {
  return draft?.state === 'draft'
}

export function createPendingDraft(
  input: Omit<LocalPendingCreateDraft, 'state' | 'createdAt' | 'updatedAt'>,
  now: () => string = () => new Date().toISOString()
): LocalPendingCreateDraft {
  const timestamp = now()
  return {
    state: 'pending_create',
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function promotePendingDraft(
  pending: LocalPendingCreateDraft,
  batch: { id: string; batch_no: string },
  now: () => string = () => new Date().toISOString()
): LocalCreatedDraft {
  return {
    state: 'draft',
    batchId: batch.id,
    batchNo: batch.batch_no,
    clientBatchId: pending.clientBatchId,
    dataCenterId: pending.dataCenterId,
    roomId: pending.roomId,
    machineProfileId: pending.machineProfileId,
    remark: pending.remark,
    items: [],
    createdAt: pending.createdAt,
    updatedAt: now(),
  }
}

export function loadActiveDraft(
  storage: Storage = localStorage
): LocalActiveDraft | null {
  const raw = storage.getItem(ACTIVE_DRAFT_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    return isValidDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveActiveDraft(
  draft: LocalActiveDraft,
  storage: Storage = localStorage
): void {
  storage.setItem(ACTIVE_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function clearActiveDraft(storage: Storage = localStorage): void {
  storage.removeItem(ACTIVE_DRAFT_STORAGE_KEY)
}

export function addDraftItem(
  draft: LocalActiveDraft,
  item: LocalDraftScanItem,
  now: () => string = () => new Date().toISOString()
): LocalActiveDraft {
  if (!isCreatedDraft(draft)) {
    throw new Error('DRAFT_NOT_CREATED')
  }

  if (
    draft.items.some((existing) => existing.serialNumber === item.serialNumber)
  ) {
    throw new Error('DUPLICATE_SERIAL_NUMBER')
  }

  return {
    ...draft,
    items: [...draft.items, item],
    updatedAt: now(),
  }
}

export function removeDraftItem(
  draft: LocalActiveDraft,
  clientItemId: string,
  now: () => string = () => new Date().toISOString()
): LocalActiveDraft {
  if (!isCreatedDraft(draft)) {
    throw new Error('DRAFT_NOT_CREATED')
  }

  return {
    ...draft,
    items: draft.items.filter((item) => item.clientItemId !== clientItemId),
    updatedAt: now(),
  }
}
