import {
  ScannerPermissionError,
  type ActiveScannerSession,
  type StartScannerOptions,
} from './types'

type BarcodeScannerModule = typeof import('@capacitor-mlkit/barcode-scanning')

export function createCapacitorBarcodeScanner(
  loader: () => Promise<BarcodeScannerModule>
) {
  return async function start(
    options: StartScannerOptions
  ): Promise<ActiveScannerSession> {
    const { BarcodeScanner } = await loader()
    let started = false
    let cleanupPromise: Promise<void> | undefined

    function cleanup({
      notifyStopped = false,
    }: { notifyStopped?: boolean } = {}) {
      cleanupPromise ??= (async () => {
        try {
          await BarcodeScanner.removeAllListeners()
          if (started) {
            await BarcodeScanner.stopScan()
          }
        } finally {
          document.body.classList.remove('barcode-scanner-active')
        }
      })()

      if (notifyStopped) {
        void cleanupPromise
          .catch(() => undefined)
          .then(() => options.onStopped?.())
      }

      return cleanupPromise
    }

    try {
      const checked = await BarcodeScanner.checkPermissions()
      if (checked.camera !== 'granted') {
        const requested = await BarcodeScanner.requestPermissions()
        if (requested.camera !== 'granted') {
          await BarcodeScanner.openSettings()
          throw new ScannerPermissionError()
        }
      }

      document.body.classList.add('barcode-scanner-active')

      await BarcodeScanner.addListener('barcodesScanned', ({ barcodes }) => {
        barcodes.forEach((barcode) => {
          const rawValue = barcode.rawValue ?? ''
          if (rawValue) {
            options.onBarcode({ rawValue, format: String(barcode.format) })
          }
        })
      })

      await BarcodeScanner.addListener('scanError', ({ message }) => {
        void cleanup({ notifyStopped: true })
          .catch(() => undefined)
          .then(() => options.onError(message))
      })

      await BarcodeScanner.startScan()
      started = true

      return { stop: cleanup }
    } catch (error) {
      await cleanup()
      throw error
    }
  }
}

export const startCapacitorBarcodeScanner = createCapacitorBarcodeScanner(
  () => import('@capacitor-mlkit/barcode-scanning')
)
