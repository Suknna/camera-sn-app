import { useEffect, useId, useState, type ComponentProps } from 'react'
import { Link } from '@tanstack/react-router'
import { AppError } from '@app/components/app-error'
import { AppScreen } from '@app/components/app-screen'
import { getStandaloneCatalog } from '@app/lib/catalog/catalog-provider'
import type { AppCatalogContext, AppCatalogRack } from '@app/lib/catalog/types'
import { createClientID } from '@app/lib/client-id'
import { createSQLiteScanRepository } from '@app/lib/local-db/sqlite-client'
import type {
  LocalBatchStatus,
  LocalScanBatchDetail,
  LocalScanRepository,
} from '@app/lib/local-db/types'
import {
  isLocalAppError,
  localErrorMessage,
  localErrorTitle,
} from '@app/lib/local-errors'
import {
  resolveAppRuntimeConfig,
  type AppRuntimeConfigResult,
} from '@app/lib/runtime-config'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Skeleton } from '@shared/components/ui/skeleton'
import { RackPicker } from './rack-picker'
import { RequiredScanPage } from './required-scan-page'
import { ScanCapture, type CapturedScanItem } from './scan-capture'
import { ScanContextBar } from './scan-context-bar'
import { ScanItemList } from './scan-item-list'
import { UPositionField, validateUPositionInput } from './u-position-field'

interface ScanPageProps {
  localBatchId?: string
  batchId?: string
  repository?: LocalScanRepository
  createClientItemID?: () => string
  now?: () => string
  startScanner?: ComponentProps<typeof ScanCapture>['startScanner']
  resolveRuntimeConfig?: () => AppRuntimeConfigResult
}

interface LocalRepositoryError {
  title: string
  message: string
}

type ScanPageState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: LocalRepositoryError }
  | { status: 'ready'; batch: LocalScanBatchDetail }

export function ScanPage({
  resolveRuntimeConfig = resolveAppRuntimeConfig,
  localBatchId,
  batchId,
  ...pageProps
}: ScanPageProps) {
  const runtimeConfig = resolveRuntimeConfig()
  const routeBatchId = batchId ?? localBatchId

  if (!runtimeConfig.ok) {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <AppError title='App 配置错误' message={runtimeConfig.message} />
      </AppScreen>
    )
  }

  if (!routeBatchId) {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <AppError title='无法加载批次' message='缺少批次路由参数。' />
      </AppScreen>
    )
  }

  if (runtimeConfig.config.controlPlaneMode === 'required') {
    return <RequiredScanPage batchId={routeBatchId} {...pageProps} />
  }

  return <StandaloneScanPage localBatchId={routeBatchId} {...pageProps} />
}

function StandaloneScanPage({
  localBatchId,
  repository: repositoryProp,
  createClientItemID = () => createClientID('item'),
  now,
  startScanner,
}: Omit<ScanPageProps, 'batchId' | 'resolveRuntimeConfig'> & {
  localBatchId: string
}) {
  const [repository] = useState<LocalScanRepository>(
    () => repositoryProp ?? createSQLiteScanRepository()
  )
  const [catalog] = useState(getStandaloneCatalog)
  const [state, setState] = useState<ScanPageState>({ status: 'loading' })
  const [rackId, setRackId] = useState('')
  const [rackError, setRackError] = useState<string | undefined>()
  const [uPosition, setUPosition] = useState('')
  const [editingContext, setEditingContext] = useState(true)
  const [historyWarning, setHistoryWarning] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<LocalRepositoryError | null>(
    null
  )
  const contextEditorId = useId()
  const uPositionError = validateUPositionInput(uPosition)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    setRackId('')
    setRackError(undefined)
    setUPosition('')
    setEditingContext(true)
    setHistoryWarning(null)
    setRemoveError(null)

    async function loadLocalBatch() {
      try {
        await repository.initialize()
        const batch = await repository.getBatch(localBatchId)
        if (!active) return

        setState(batch ? { status: 'ready', batch } : { status: 'missing' })
      } catch (error) {
        if (active)
          setState({ status: 'error', error: toLocalRepositoryError(error) })
      }
    }

    void loadLocalBatch()

    return () => {
      active = false
    }
  }, [repository, localBatchId])

  if (state.status === 'loading') {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <ScanLoading />
      </AppScreen>
    )
  }

  if (state.status === 'missing') {
    return <BlockedLocalBatchPage title='未找到本地批次' />
  }

  if (state.status === 'error') {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <AppError title={state.error.title} message={state.error.message} />
      </AppScreen>
    )
  }

  const batch = state.batch
  const locked = batch.status !== 'draft'
  const rackLabel = rackLabelFor(catalog, batch.roomId, rackId)
  const showContextEditor =
    editingContext || !rackId || Boolean(uPositionError) || locked
  const editingDisabled = locked
  const captureDisabled = locked || Boolean(uPositionError)

  const refreshBatch = async () => {
    const updatedBatch = await repository.getBatch(localBatchId)
    if (!updatedBatch) {
      setState({ status: 'missing' })
      return null
    }

    setState({ status: 'ready', batch: updatedBatch })
    return updatedBatch
  }

  const handleAddItem = async (item: CapturedScanItem) => {
    if (batch.status !== 'draft') throw new Error('批次已锁定，不能继续扫描。')

    const rack = findRack(catalog, batch.roomId, item.rackId)
    if (!rack) {
      setRackError('请选择机柜')
      throw new Error('请选择机柜')
    }

    const result = await repository.addScanItem({
      localBatchId: batch.localBatchId,
      clientItemId: item.clientItemId,
      rawValue: item.rawValue,
      serialNumber: item.rawValue.trim(),
      barcodeFormat: item.barcodeFormat,
      rackId: rack.id,
      rackName: rack.name,
      uPosition: item.uPosition,
      scannedAt: item.createdAt,
    })

    setState({ status: 'ready', batch: result.batch })
    setRackError(undefined)
    setRemoveError(null)
    setHistoryWarning(
      result.duplicateInLocalHistory
        ? localErrorMessage('SCAN_ITEM_DUPLICATE_LOCAL_HISTORY')
        : null
    )
  }

  const handleRemoveItem = async (localItemId: string) => {
    if (batch.status !== 'draft') return

    setRemoveError(null)
    try {
      await repository.removeScanItem(batch.localBatchId, localItemId)
      await refreshBatch()
    } catch (error) {
      setRemoveError(toLocalRepositoryError(error))
    }
  }

  return (
    <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
      <div className='space-y-5'>
        <section className='space-y-3' aria-label='扫描上下文'>
          <div className='max-w-[65ch] space-y-1'>
            <p className='text-sm text-muted-foreground'>
              本地批次号：{batch.batchNo}
            </p>
            <p className='text-sm text-muted-foreground'>
              到货批次：{batch.arrivalBatchName}
            </p>
          </div>
          {locked ? <LockedBatchAlert status={batch.status} /> : null}
          <ScanContextBar
            rackLabel={rackLabel}
            uPosition={uPosition}
            expanded={showContextEditor}
            controlsId={contextEditorId}
            onEdit={() => setEditingContext((current) => !current)}
          />
          {showContextEditor ? (
            <div
              id={contextEditorId}
              className='grid gap-4 rounded-lg border border-dashed p-3 sm:grid-cols-2'
            >
              <RackPicker
                catalog={catalog}
                roomId={batch.roomId}
                value={rackId}
                error={rackError}
                disabled={editingDisabled}
                onChange={(nextRackId) => {
                  setRackId(nextRackId)
                  setRackError(undefined)
                  setEditingContext(nextRackId === '')
                }}
              />
              <UPositionField
                value={uPosition}
                error={uPositionError}
                disabled={editingDisabled}
                onChange={setUPosition}
              />
            </div>
          ) : null}
        </section>

        <ScanCapture
          rackId={rackId}
          uPosition={uPosition}
          disabled={captureDisabled}
          createClientItemID={createClientItemID}
          now={now}
          startScanner={startScanner}
          onRackErrorChange={setRackError}
          onAddItem={handleAddItem}
        />

        <section className='space-y-4' aria-label='已扫列表与完成入口'>
          {historyWarning ? (
            <HistoricalDuplicateWarning message={historyWarning} />
          ) : null}
          {removeError ? <RemoveErrorAlert error={removeError} /> : null}
          <ScanItemList
            items={batch.items}
            disabled={locked}
            onRemove={(localItemId) => void handleRemoveItem(localItemId)}
          />

          <div className='grid gap-3 sm:grid-cols-2'>
            {batch.items.length > 0 || locked ? (
              <Button
                asChild
                variant='secondary'
                className='min-h-11 w-full md:min-h-11'
              >
                <Link to='/submit/$batchId' params={{ batchId: localBatchId }}>
                  {locked ? '查看/导出批次' : '完成/导出批次'}
                </Link>
              </Button>
            ) : (
              <Button
                type='button'
                variant='secondary'
                className='min-h-11 w-full md:min-h-11'
                disabled
              >
                完成/导出批次
              </Button>
            )}
            <Button
              asChild
              variant='outline'
              className='min-h-11 w-full md:min-h-11'
            >
              <a href='/'>返回首页</a>
            </Button>
          </div>
        </section>
      </div>
    </AppScreen>
  )
}

function BlockedLocalBatchPage({ title }: { title: string }) {
  return (
    <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
      <section className='space-y-4 rounded-lg border border-dashed p-6 text-center'>
        <div className='space-y-2'>
          <h2 className='text-base font-semibold'>{title}</h2>
          <p className='mx-auto max-w-[65ch] text-sm leading-6 text-muted-foreground'>
            请返回首页选择本机已有批次，或重新创建本地扫描批次。
          </p>
        </div>
        <Button asChild variant='secondary' className='min-h-11 md:min-h-11'>
          <a href='/'>返回首页</a>
        </Button>
      </section>
    </AppScreen>
  )
}

function ScanLoading() {
  return (
    <div className='space-y-3' aria-label='正在加载扫描页'>
      <Skeleton className='h-11 w-full' />
      <Skeleton className='h-11 w-full' />
      <Skeleton className='h-32 w-full' />
    </div>
  )
}

function LockedBatchAlert({ status }: { status: LocalBatchStatus }) {
  return (
    <Alert>
      <AlertTitle>批次已锁定</AlertTitle>
      <AlertDescription>
        当前本地批次状态为{localStatusLabel(status)}，不能继续扫描或删除
        SN，可前往导出页查看。
      </AlertDescription>
    </Alert>
  )
}

function HistoricalDuplicateWarning({ message }: { message: string }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>历史重复提示</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function RemoveErrorAlert({ error }: { error: LocalRepositoryError }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

function toLocalRepositoryError(error: unknown): LocalRepositoryError {
  if (isLocalAppError(error)) {
    return {
      title: localErrorTitle(error.code),
      message: localErrorMessage(error.code),
    }
  }

  if (error instanceof Error && error.message) {
    return { title: '操作失败', message: error.message }
  }

  return {
    title: localErrorTitle('LOCAL_DB_UNAVAILABLE'),
    message: localErrorMessage('LOCAL_DB_UNAVAILABLE'),
  }
}

function localStatusLabel(status: LocalBatchStatus): string {
  if (status === 'completed') return '已完成'
  if (status === 'exported') return '已导出'
  return '进行中'
}

function rackLabelFor(
  catalog: AppCatalogContext,
  roomId: string,
  rackId: string
): string {
  return findRack(catalog, roomId, rackId)?.name ?? ''
}

function findRack(
  catalog: AppCatalogContext,
  roomId: string,
  rackId: string
): AppCatalogRack | undefined {
  if (!rackId) return undefined

  for (const dataCenter of catalog.dataCenters) {
    const room = dataCenter.rooms.find((candidate) => candidate.id === roomId)
    const rack = room?.racks.find((candidate) => candidate.id === rackId)
    if (rack) return rack
  }

  return undefined
}
