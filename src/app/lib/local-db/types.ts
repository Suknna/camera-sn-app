export type LocalBatchStatus = 'draft' | 'completed' | 'exported'

export interface AppProfile {
  operatorName: string
  createdAt: string
  updatedAt: string
}

export interface LocalBatchAttribute {
  localAttributeId: string
  key: string
  value: string
}

export interface LocalScanItemAttribute {
  localAttributeId: string
  key: string
  value: string
}

export interface LocalScanItem {
  localItemId: string
  clientItemId: string
  rawValue: string
  serialNumber: string
  barcodeFormat: string
  rackId: string
  rackName: string
  uPosition: number | null
  scannedAt: string
  configNoteOverride: string
  hasConfigOverride: boolean
  attributes: LocalScanItemAttribute[]
}

export interface LocalScanBatchSummary {
  localBatchId: string
  clientBatchId: string
  batchNo: string
  arrivalBatchName: string
  operatorName: string
  dataCenterId: string
  dataCenterName: string
  roomId: string
  roomName: string
  machineConfigSummary: string
  defaultConfigNote: string
  status: LocalBatchStatus
  itemCount: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  lastExportedAt: string | null
}

export interface LocalScanBatchDetail extends LocalScanBatchSummary {
  attributes: LocalBatchAttribute[]
  items: LocalScanItem[]
}

export interface CreateLocalBatchInput {
  clientBatchId: string
  operatorName?: string
  dataCenterId: string
  roomId: string
  arrivalBatchName: string
  machineConfigSummary: string
  defaultConfigNote?: string
  attributes?: Array<Pick<LocalBatchAttribute, 'key' | 'value'>>
}

export interface AddScanItemInput {
  localBatchId: string
  clientItemId: string
  rawValue: string
  serialNumber?: string
  barcodeFormat: string
  rackId: string
  rackName?: string
  uPosition?: number | null
  scannedAt?: string
  configNoteOverride?: string
  hasConfigOverride?: boolean
  attributes?: Array<Pick<LocalScanItemAttribute, 'key' | 'value'>>
}

export interface AddScanItemResult {
  item: LocalScanItem
  batch: LocalScanBatchDetail
  duplicateInLocalHistory: boolean
}

export interface LocalExportRecord {
  localExportId: string
  localBatchId: string
  fileName: string
  fileUri: string
  fileSize: number
  fileHash: string
  exportedAt: string
  sharedAt: string | null
}

export interface LocalScanRepository {
  initialize(): Promise<void>
  getProfile(): Promise<AppProfile | null>
  saveOperatorName(operatorName: string): Promise<AppProfile>
  listBatches(): Promise<LocalScanBatchSummary[]>
  createBatch(input: CreateLocalBatchInput): Promise<LocalScanBatchDetail>
  getBatch(localBatchId: string): Promise<LocalScanBatchDetail | null>
  addScanItem(input: AddScanItemInput): Promise<AddScanItemResult>
  removeScanItem(localBatchId: string, localItemId: string): Promise<void>
  completeBatch(localBatchId: string): Promise<LocalScanBatchDetail>
  recordExport(
    input: Omit<LocalExportRecord, 'localExportId'>
  ): Promise<LocalExportRecord>
}
