export interface ScannedBarcode {
  rawValue: string
  format: string
}

export interface ActiveScannerSession {
  stop(): Promise<void>
}

export interface StartScannerOptions {
  onBarcode(barcode: ScannedBarcode): void
  onError(message: string): void
  onStopped?(): void
}

export class ScannerPermissionError extends Error {
  constructor() {
    super('CAMERA_PERMISSION_DENIED')
  }
}
