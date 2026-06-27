import { describe, expect, it } from 'vitest'
import {
  ACTIVE_DRAFT_STORAGE_KEY,
  addDraftItem,
  createPendingDraft,
  isCreatedDraft,
  loadActiveDraft,
  promotePendingDraft,
  removeDraftItem,
  saveActiveDraft,
  type LocalActiveDraft,
  type LocalCreatedDraft,
  type LocalDraftScanItem,
  type LocalPendingCreateDraft,
} from './local-draft-store'

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>()

  get length(): number {
    return this.items.size
  }

  clear(): void {
    this.items.clear()
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}

function fixedNow(timestamp: string): () => string {
  return () => timestamp
}

function makePendingDraft(): LocalPendingCreateDraft {
  return createPendingDraft(
    {
      clientBatchId: 'batch_uuid',
      dataCenterId: 'dc-1',
      roomId: 'room-1',
      machineProfileId: 'profile-1',
      remark: 'arrival scan',
    },
    fixedNow('2026-01-01T00:00:00.000Z')
  )
}

function makeItem(
  overrides: Partial<LocalDraftScanItem> = {}
): LocalDraftScanItem {
  return {
    clientItemId: 'item-1',
    serialNumber: 'SN-001',
    barcodeFormat: 'CODE_128',
    rawValue: '  SN-001  ',
    rackId: 'rack-1',
    uPosition: null,
    createdAt: '2026-01-01T00:01:00.000Z',
    ...overrides,
  }
}

function makeCreatedDraft(
  overrides: Partial<LocalCreatedDraft> = {}
): LocalCreatedDraft {
  return {
    state: 'draft',
    batchId: 'batch-1',
    batchNo: 'BATCH-001',
    clientBatchId: 'batch_uuid',
    dataCenterId: 'dc-1',
    roomId: 'room-1',
    machineProfileId: 'profile-1',
    remark: 'arrival scan',
    items: [makeItem()],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function expectCreatedDraft(
  draft: LocalActiveDraft | null
): asserts draft is LocalCreatedDraft {
  if (!isCreatedDraft(draft)) {
    throw new Error('expected created draft')
  }
}

describe('local draft store', () => {
  it('returns null for malformed storage content', () => {
    const storage = new MemoryStorage()
    storage.setItem(ACTIVE_DRAFT_STORAGE_KEY, '{not-json')

    expect(loadActiveDraft(storage)).toBeNull()
  })

  it('saves and loads a pending create draft with the same client batch and selected IDs', () => {
    const storage = new MemoryStorage()
    const draft = makePendingDraft()

    saveActiveDraft(draft, storage)

    expect(loadActiveDraft(storage)).toEqual({
      state: 'pending_create',
      clientBatchId: 'batch_uuid',
      dataCenterId: 'dc-1',
      roomId: 'room-1',
      machineProfileId: 'profile-1',
      remark: 'arrival scan',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('preserves raw values and item payload fields across save and load', () => {
    const storage = new MemoryStorage()
    const pending = makePendingDraft()
    const created = promotePendingDraft(
      pending,
      { id: 'batch-1', batch_no: 'BATCH-001' },
      fixedNow('2026-01-01T00:02:00.000Z')
    )
    const item = makeItem({
      clientItemId: 'item_uuid',
      rawValue: '  SN-001  ',
      serialNumber: 'SN-001',
      uPosition: null,
    })
    const draft = addDraftItem(
      created,
      item,
      fixedNow('2026-01-01T00:03:00.000Z')
    )

    saveActiveDraft(draft, storage)
    const loaded = loadActiveDraft(storage)

    expectCreatedDraft(loaded)
    expect(loaded.items).toEqual([
      {
        clientItemId: 'item_uuid',
        serialNumber: 'SN-001',
        barcodeFormat: 'CODE_128',
        rawValue: '  SN-001  ',
        rackId: 'rack-1',
        uPosition: null,
        createdAt: '2026-01-01T00:01:00.000Z',
      },
    ])
  })

  it('returns null for stored items with out-of-range uPosition values', () => {
    const invalidLowStorage = new MemoryStorage()
    invalidLowStorage.setItem(
      ACTIVE_DRAFT_STORAGE_KEY,
      JSON.stringify(makeCreatedDraft({ items: [makeItem({ uPosition: 0 })] }))
    )
    const invalidHighStorage = new MemoryStorage()
    invalidHighStorage.setItem(
      ACTIVE_DRAFT_STORAGE_KEY,
      JSON.stringify(makeCreatedDraft({ items: [makeItem({ uPosition: 61 })] }))
    )

    expect(loadActiveDraft(invalidLowStorage)).toBeNull()
    expect(loadActiveDraft(invalidHighStorage)).toBeNull()
  })

  it('throws DRAFT_NOT_CREATED when adding an item before create succeeds', () => {
    expect(() => addDraftItem(makePendingDraft(), makeItem())).toThrow(
      'DRAFT_NOT_CREATED'
    )
  })

  it('throws for duplicate serial numbers without mutating the draft', () => {
    const existingItem = makeItem({ clientItemId: 'item-1' })
    const draft = makeCreatedDraft({ items: [existingItem] })

    expect(() =>
      addDraftItem(
        draft,
        makeItem({ clientItemId: 'item-2', serialNumber: 'SN-001' })
      )
    ).toThrow('DUPLICATE_SERIAL_NUMBER')
    expect(draft.items).toEqual([existingItem])
  })

  it('removes an item while preserving remaining item order', () => {
    const firstItem = makeItem({
      clientItemId: 'item-1',
      serialNumber: 'SN-001',
    })
    const secondItem = makeItem({
      clientItemId: 'item-2',
      serialNumber: 'SN-002',
    })
    const thirdItem = makeItem({
      clientItemId: 'item-3',
      serialNumber: 'SN-003',
    })
    const draft = makeCreatedDraft({
      items: [firstItem, secondItem, thirdItem],
    })

    const updatedDraft = removeDraftItem(
      draft,
      'item-2',
      fixedNow('2026-01-01T00:04:00.000Z')
    )

    expectCreatedDraft(updatedDraft)
    expect(updatedDraft.items).toEqual([firstItem, thirdItem])
  })
})
