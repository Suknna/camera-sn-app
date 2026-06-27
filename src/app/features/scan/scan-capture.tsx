import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { createClientID } from '@app/lib/client-id'
import { isLocalAppError, localErrorMessage } from '@app/lib/local-errors'
import { playScanSuccessFeedback } from '@app/lib/scan-feedback'
import {
  startCapacitorBarcodeScanner,
  WebManualScanner,
  type ActiveScannerSession,
  type ScannedBarcode,
  type StartScannerOptions,
} from '@app/lib/scanner'
import { Capacitor } from '@capacitor/core'
import { Button } from '@shared/components/ui/button'
import { createPortal } from 'react-dom'
import { ScanSuccessToast } from './scan-success-toast'
import { scanItemInputSchema } from './schema'

type StartScanner = (
  options: StartScannerOptions
) => Promise<ActiveScannerSession>

export interface CapturedScanItem {
  clientItemId: string
  serialNumber: string
  barcodeFormat: string
  rawValue: string
  rackId: string
  uPosition: number | null
  createdAt: string
}

type MaybePromise<Result> = Result | Promise<Result>

interface ScanCaptureProps {
  rackId: string
  uPosition: string
  disabled?: boolean
  createClientItemID?: () => string
  now?: () => string
  startScanner?: StartScanner
  playFeedback?: () => Promise<void>
  onRackErrorChange?: (error: string | undefined) => void
  onAddItem: (item: CapturedScanItem) => MaybePromise<void>
}

export function ScanCapture({
  rackId,
  uPosition,
  disabled = false,
  createClientItemID = () => createClientID('item'),
  now = () => new Date().toISOString(),
  startScanner = startCapacitorBarcodeScanner,
  playFeedback = playScanSuccessFeedback,
  onRackErrorChange,
  onAddItem,
}: ScanCaptureProps) {
  const isNative = Capacitor.isNativePlatform()
  const [error, setError] = useState<string | null>(null)
  const [lastScannedSn, setLastScannedSn] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [scannerSession, setScannerSession] =
    useState<ActiveScannerSession | null>(null)
  const sessionRef = useRef<ActiveScannerSession | null>(null)
  const disabledRef = useRef(disabled)
  const hadScannerSessionRef = useRef(false)
  const startButtonRef = useRef<HTMLButtonElement | null>(null)
  const stopButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    return () => {
      const activeSession = sessionRef.current
      sessionRef.current = null
      void activeSession?.stop()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!scannerSession) return

    stopButtonRef.current?.focus()
  }, [scannerSession])

  useEffect(() => {
    if (scannerSession) return
    if (!hadScannerSessionRef.current) return

    hadScannerSessionRef.current = false
    startButtonRef.current?.focus()
  }, [scannerSession])

  const handleBarcode = async (barcode: ScannedBarcode) => {
    if (disabledRef.current) return

    const parsed = scanItemInputSchema.safeParse({
      rawValue: barcode.rawValue,
      barcodeFormat: barcode.format,
      rackId,
      uPosition,
    })
    if (!parsed.success) {
      const rackIssue = parsed.error.issues.find(
        (issue) => issue.path[0] === 'rackId'
      )
      onRackErrorChange?.(rackIssue?.message)
      setError(messageForIssue(parsed.error.issues[0]))
      return
    }
    onRackErrorChange?.(undefined)

    try {
      await onAddItem({
        clientItemId: createClientItemID(),
        serialNumber: parsed.data.rawValue.trim(),
        barcodeFormat: parsed.data.barcodeFormat,
        rawValue: parsed.data.rawValue,
        rackId: parsed.data.rackId,
        uPosition: parsed.data.uPosition,
        createdAt: now(),
      })
      setError(null)

      if (isNative) {
        setLastScannedSn(parsed.data.rawValue.trim())
        setToastVisible(true)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => {
          setToastVisible(false)
        }, 1400)
      }
    } catch (addError) {
      setError(messageForAddError(addError))
      return
    }

    try {
      void Promise.resolve(playFeedback()).catch(() => {})
    } catch {
      // 反馈只是增强能力，同步失败也不能影响已成功加入列表的扫码结果。
    }
  }

  const handleStartNative = async () => {
    setError(null)
    setIsStarting(true)

    try {
      const session = await startScanner({
        onBarcode: handleBarcode,
        onError: setError,
        onStopped: () => {
          sessionRef.current = null
          setScannerSession(null)
        },
      })
      sessionRef.current = session
      hadScannerSessionRef.current = true
      setScannerSession(session)
    } catch (startError) {
      setError(messageForStartError(startError))
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopNative = async () => {
    const activeSession = sessionRef.current
    sessionRef.current = null
    setScannerSession(null)
    if (activeSession) await activeSession.stop()
  }

  return (
    <section className='space-y-3' aria-labelledby='scan-capture-title'>
      <div className='max-w-[65ch] space-y-1'>
        <h2 id='scan-capture-title' className='text-base font-semibold'>
          扫描 SN
        </h2>
        <p className='text-sm leading-6 text-muted-foreground'>
          添加扫描项只会更新本地草稿，不会向后端提交扫描结果。
        </p>
      </div>

      {isNative ? (
        <Button
          type='button'
          variant='default'
          className='h-16 w-full text-lg'
          ref={startButtonRef}
          disabled={disabled || isStarting || Boolean(scannerSession)}
          onClick={() => void handleStartNative()}
        >
          {isStarting ? '正在启动扫码…' : '开始扫码'}
        </Button>
      ) : (
        <WebManualScanner disabled={disabled} onBarcode={handleBarcode} />
      )}

      {error ? (
        <p className='text-sm text-destructive' role='alert'>
          {error}
        </p>
      ) : null}

      {scannerSession
        ? createPortal(
            <NativeScannerOverlay
              stopButtonRef={stopButtonRef}
              onStop={() => void handleStopNative()}
            />,
            document.body
          )
        : null}

      <ScanSuccessToast sn={lastScannedSn ?? ''} visible={toastVisible} />
    </section>
  )
}

function NativeScannerOverlay({
  stopButtonRef,
  onStop,
}: {
  stopButtonRef: RefObject<HTMLButtonElement | null>
  onStop: () => void
}) {
  useLayoutEffect(() => {
    const root = document.getElementById('root') as InertRootElement | null
    if (!root) return

    const hadAriaHidden = root.hasAttribute('aria-hidden')
    const previousAriaHidden = root.getAttribute('aria-hidden')
    const hadInertAttribute = root.hasAttribute('inert')
    const previousInert = root.inert

    root.inert = true
    root.setAttribute('inert', '')
    root.setAttribute('aria-hidden', 'true')

    return () => {
      if (previousInert === undefined) {
        Reflect.deleteProperty(root, 'inert')
      } else {
        root.inert = previousInert
      }

      if (hadInertAttribute) {
        root.setAttribute('inert', '')
      } else {
        root.removeAttribute('inert')
      }

      if (hadAriaHidden) {
        root.setAttribute('aria-hidden', previousAriaHidden ?? '')
      } else {
        root.removeAttribute('aria-hidden')
      }
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onStop()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      stopButtonRef.current?.focus()
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 grid place-items-end bg-background/80 p-4 backdrop-blur-sm'
      data-scanner-overlay='true'
      role='dialog'
      aria-modal='true'
      aria-labelledby='native-scanner-overlay-title'
      aria-describedby='native-scanner-overlay-description'
      onKeyDown={handleKeyDown}
    >
      <div className='w-full max-w-[65ch] space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs'>
        <h3
          id='native-scanner-overlay-title'
          className='text-base font-semibold'
        >
          原生扫码进行中
        </h3>
        <p
          id='native-scanner-overlay-description'
          className='text-sm leading-6 text-muted-foreground'
        >
          相机预览由原生层显示，识别到条码会自动加入列表
        </p>
        <Button
          type='button'
          variant='secondary'
          className='min-h-11 min-w-11 md:min-h-11 md:min-w-11'
          ref={stopButtonRef}
          onClick={onStop}
        >
          停止扫码
        </Button>
      </div>
    </div>
  )
}

type InertRootElement = HTMLElement & { inert?: boolean }

function messageForIssue(
  issue: { path: PropertyKey[]; message: string } | undefined
) {
  if (!issue) return '扫描内容无效'
  if (issue.path[0] === 'uPosition') return 'U 位必须在 1 到 60 之间'

  return issue.message
}

function messageForAddError(error: unknown) {
  if (isLocalAppError(error)) return localErrorMessage(error.code)

  if (error instanceof Error && error.message === 'DUPLICATE_SERIAL_NUMBER') {
    return '该 SN 已在待提交列表中'
  }

  if (
    error instanceof Error &&
    (error.message === '请选择机柜' ||
      error.message === '批次已锁定，不能继续扫描。')
  ) {
    return error.message
  }

  return '加入待提交列表失败'
}

function messageForStartError(error: unknown) {
  if (error instanceof Error && error.message === 'CAMERA_PERMISSION_DENIED') {
    return '相机权限未开启，无法启动扫码'
  }
  if (error instanceof Error && error.message) return error.message

  return '启动扫码失败'
}
