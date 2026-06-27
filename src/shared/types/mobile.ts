export type MobileBatchStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
export type MobileScanItemStatus =
  | 'pending'
  | 'accepted'
  | 'conflict'
  | 'rejected'
export type MobileConflictReason = 'SN_ALREADY_EXISTS'

export interface ContextRackDTO {
  id: string
  code: string
  name: string
}

export interface ContextRoomDTO {
  id: string
  code: string
  name: string
  racks: ContextRackDTO[]
}

export interface ContextDataCenterDTO {
  id: string
  code: string
  name: string
  rooms: ContextRoomDTO[]
}

export interface ContextMachineProfileDTO {
  id: string
  name: string
}

export interface MobileContextDTO {
  data_centers: ContextDataCenterDTO[]
  machine_profiles: ContextMachineProfileDTO[]
}

export interface MobileScanBatchDTO {
  id: string
  batch_no: string
  client_batch_id: string
  data_center_id: string
  room_id: string
  machine_profile_id: string
  status: MobileBatchStatus
  remark: string
  submitted_at: string | null
}

export interface CreateMobileScanBatchRequest {
  client_batch_id: string
  data_center_id: string
  room_id: string
  machine_profile_id: string
  remark?: string
}

export interface SubmitMobileScanItemRequest {
  client_item_id: string
  serial_number: string
  barcode_format: string
  raw_value: string
  rack_id: string
  u_position?: number | null
}

export interface SubmitMobileScanBatchRequest {
  client_batch_id: string
  items: SubmitMobileScanItemRequest[]
}

export interface SubmitMobileScanItemResult {
  client_item_id: string
  scan_item_id: string
  serial_number: string
  status: MobileScanItemStatus
  conflict_reason: MobileConflictReason | null
}

export interface SubmitMobileScanBatchResult {
  batch_id: string
  status: MobileBatchStatus
  accepted_count: number
  conflict_count: number
  items: SubmitMobileScanItemResult[]
}
