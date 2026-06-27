import type {
  Barcode,
  BarcodesScannedEvent,
  ScanErrorEvent,
} from '@capacitor-mlkit/barcode-scanning'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCapacitorBarcodeScanner,
  ScannerPermissionError,
  type ScannedBarcode,
} from './index'

type PermissionState = 'granted' | 'denied'
type BarcodeScannerModule = typeof import('@capacitor-mlkit/barcode-scanning')
type BarcodeScannerEventName = 'barcodesScanned' | 'scanError'
type BarcodeScannerListener = (
  event: BarcodesScannedEvent | ScanErrorEvent
) => void

function createBarcodeScannerModule(
  permissions: { checked?: PermissionState; requested?: PermissionState } = {}
) {
  const listeners = new Map<BarcodeScannerEventName, BarcodeScannerListener>()
  const scanner = {
    addListener: vi.fn(
      async (
        eventName: BarcodeScannerEventName,
        listener: BarcodeScannerListener
      ) => {
        listeners.set(eventName, listener)
        return { remove: vi.fn(async () => undefined) }
      }
    ),
    checkPermissions: vi.fn(async () => ({
      camera: permissions.checked ?? 'granted',
    })),
    openSettings: vi.fn(async () => undefined),
    removeAllListeners: vi.fn(async () => {
      listeners.clear()
    }),
    requestPermissions: vi.fn(async () => ({
      camera: permissions.requested ?? 'granted',
    })),
    startScan: vi.fn(async () => undefined),
    stopScan: vi.fn(async () => undefined),
  }

  return {
    emitBarcodes(barcodes: Barcode[]) {
      listeners.get('barcodesScanned')?.({ barcodes })
    },
    emitScanError(message: string) {
      listeners.get('scanError')?.({ message })
    },
    module: { BarcodeScanner: scanner } as unknown as BarcodeScannerModule,
    scanner,
  }
}

describe('createCapacitorBarcodeScanner', () => {
  afterEach(() => {
    document.body.classList.remove('barcode-scanner-active')
  })

  it('removes scanner body class when camera permission is denied', async () => {
    const mock = createBarcodeScannerModule({
      checked: 'denied',
      requested: 'denied',
    })
    const start = createCapacitorBarcodeScanner(async () => mock.module)
    document.body.classList.add('barcode-scanner-active')

    await expect(
      start({ onBarcode: vi.fn(), onError: vi.fn() })
    ).rejects.toBeInstanceOf(ScannerPermissionError)

    expect(document.body.classList.contains('barcode-scanner-active')).toBe(
      false
    )
    expect(mock.scanner.openSettings).toHaveBeenCalledOnce()
    expect(mock.scanner.startScan).not.toHaveBeenCalled()
  })

  it('stops scanning and clears listeners when a session stops', async () => {
    const mock = createBarcodeScannerModule()
    const start = createCapacitorBarcodeScanner(async () => mock.module)

    const session = await start({ onBarcode: vi.fn(), onError: vi.fn() })

    expect(document.body.classList.contains('barcode-scanner-active')).toBe(
      true
    )

    await session.stop()

    expect(mock.scanner.removeAllListeners).toHaveBeenCalledOnce()
    expect(mock.scanner.stopScan).toHaveBeenCalledOnce()
    expect(document.body.classList.contains('barcode-scanner-active')).toBe(
      false
    )
  })

  it('emits the native raw barcode value unchanged', async () => {
    const mock = createBarcodeScannerModule()
    const start = createCapacitorBarcodeScanner(async () => mock.module)
    const onBarcode = vi.fn<(barcode: ScannedBarcode) => void>()

    const session = await start({ onBarcode, onError: vi.fn() })

    mock.emitBarcodes([
      {
        displayValue: 'SN-001',
        format: 'CODE_128',
        rawValue: '  SN-001  ',
        valueType: 'TEXT',
      } as Barcode,
    ])

    expect(onBarcode).toHaveBeenCalledWith({
      format: 'CODE_128',
      rawValue: '  SN-001  ',
    })

    await session.stop()
  })

  it('cleans up scanner state before reporting native scan errors', async () => {
    const mock = createBarcodeScannerModule()
    const start = createCapacitorBarcodeScanner(async () => mock.module)
    const onError = vi.fn<(message: string) => void>()
    const onStopped = vi.fn<() => void>()

    await start({ onBarcode: vi.fn(), onError, onStopped })
    mock.emitScanError('camera failed')

    await vi.waitFor(() => {
      expect(onStopped).toHaveBeenCalledOnce()
      expect(onError).toHaveBeenCalledWith('camera failed')
    })

    expect(mock.scanner.removeAllListeners).toHaveBeenCalledOnce()
    expect(mock.scanner.stopScan).toHaveBeenCalledOnce()
    expect(document.body.classList.contains('barcode-scanner-active')).toBe(
      false
    )
  })
})
