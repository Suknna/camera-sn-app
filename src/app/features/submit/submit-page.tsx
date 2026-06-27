import { useEffect, useState } from 'react'
import { AppError } from '@app/components/app-error'
import { AppScreen } from '@app/components/app-screen'
import { exportBatchToExcel } from '@app/lib/export/excel-exporter'
import { buildExportFileName } from '@app/lib/export/export-filename'
import {
  shareExcelBlob,
  type ShareExcelBlobResult,
} from '@app/lib/export/file-share'
import {
  clearActiveDraft,
  isCreatedDraft,
  loadActiveDraft,
  type LocalActiveDraft,
  type LocalCreatedDraft,
} from '@app/lib/local-draft-store'
import { createSQLiteScanRepository } from '@app/lib/local-db/sqlite-client'
import type {
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
import { isAPIError } from '@shared/api/errors'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Skeleton } from '@shared/components/ui/skeleton'
import type {
  SubmitMobileScanBatchRequest,
  SubmitMobileScanBatchResult,
} from '@shared/types/mobile'
import { CheckCircle2Icon } from 'lucide-react'
import { LocalSubmitSummary } from './local-submit-summary'
import { useSubmitMobileBatchMutation } from './queries'
import { SubmitResult } from './submit-result'
import { SubmitSummary } from './submit-summary'

export interface SubmitPageProps {
  batchId: string
  resolveRuntimeConfig?: () => AppRuntimeConfigResult
  repository?: LocalScanRepository
  now?: () => Date
  exportBatch?: (batch: LocalScanBatchDetail) => Promise<Blob>
  shareBlob?: (input: {
    blob: Blob
    fileName: string
  }) => Promise<ShareExcelBlobResult>
}

interface LocalRepositoryError {
  title: string
  message: string
}

type SubmitPageState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: LocalRepositoryError }
  | { status: 'ready'; batch: LocalScanBatchDetail }

type ActiveAction = 'idle' | 'completing' | 'exporting'

interface ExportSuccessState extends ShareExcelBlobResult {
  fileName: string
}

export function SubmitPage({
  batchId,
  resolveRuntimeConfig = resolveAppRuntimeConfig,
  repository,
  now,
  exportBatch,
  shareBlob,
}: SubmitPageProps) {
  const runtimeConfig = resolveRuntimeConfig()
  if (!runtimeConfig.ok) {
    return (
      <AppScreen title='提交批次' onBack={() => window.history.back()}>
        <AppError title='App 配置错误' message={runtimeConfig.message} />
      </AppScreen>
    )
  }

  if (runtimeConfig.config.controlPlaneMode === 'required') {
    return <RequiredSubmitPage batchId={batchId} />
  }

  return (
    <StandaloneSubmitPage
      batchId={batchId}
      repository={repository}
      now={now}
      exportBatch={exportBatch}
      shareBlob={shareBlob}
    />
  )
}

function StandaloneSubmitPage({
  batchId,
  repository: repositoryProp,
  now = () => new Date(),
  exportBatch = exportBatchToExcel,
  shareBlob = shareExcelBlob,
}: Omit<SubmitPageProps, 'resolveRuntimeConfig'>) {
  const [repository] = useState<LocalScanRepository>(
    () => repositoryProp ?? createSQLiteScanRepository()
  )
  const [state, setState] = useState<SubmitPageState>({ status: 'loading' })
  const [activeAction, setActiveAction] = useState<ActiveAction>('idle')
  const [actionError, setActionError] = useState<LocalRepositoryError | null>(
    null
  )
  const [exportSuccess, setExportSuccess] = useState<ExportSuccessState | null>(
    null
  )

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    setActionError(null)
    setExportSuccess(null)

    async function loadLocalBatch() {
      try {
        await repository.initialize()
        const batch = await repository.getBatch(batchId)
        if (!active) return

        setState(batch ? { status: 'ready', batch } : { status: 'missing' })
      } catch (error) {
        if (active) {
          setState({ status: 'error', error: toLocalRepositoryError(error) })
        }
      }
    }

    void loadLocalBatch()

    return () => {
      active = false
    }
  }, [repository, batchId])

  const handleComplete = async () => {
    if (state.status !== 'ready') return

    setActiveAction('completing')
    setActionError(null)
    setExportSuccess(null)
    try {
      const completedBatch = await repository.completeBatch(
        state.batch.localBatchId
      )
      setState({ status: 'ready', batch: completedBatch })
    } catch (error) {
      setActionError(toLocalRepositoryError(error))
    } finally {
      setActiveAction('idle')
    }
  }

  const handleExportAndShare = async () => {
    if (state.status !== 'ready') return
    if (state.batch.status === 'draft') {
      setActionError({
        title: localErrorTitle('BATCH_NOT_COMPLETED'),
        message: localErrorMessage('BATCH_NOT_COMPLETED'),
      })
      return
    }

    const exportedAtDate = now()

    setActiveAction('exporting')
    setActionError(null)
    setExportSuccess(null)
    try {
      const exportedAt = exportedAtDate.toISOString()
      const fileName = buildExportFileName({
        dataCenterName: state.batch.dataCenterName,
        roomName: state.batch.roomName,
        exportedAt: exportedAtDate,
      })
      const blob = await exportBatch(state.batch)
      const sharedFile = await shareBlob({ blob, fileName })
      await repository.recordExport({
        localBatchId: state.batch.localBatchId,
        fileName,
        fileUri: sharedFile.fileUri,
        fileSize: sharedFile.fileSize,
        fileHash: sharedFile.fileHash,
        exportedAt,
        sharedAt: exportedAt,
      })
      const exportedBatch = await repository.getBatch(state.batch.localBatchId)
      setState(
        exportedBatch
          ? { status: 'ready', batch: exportedBatch }
          : { status: 'missing' }
      )
      setExportSuccess({ fileName, ...sharedFile })
    } catch (error) {
      setActionError(toLocalRepositoryError(error))
    } finally {
      setActiveAction('idle')
    }
  }

  if (state.status === 'loading') {
    return (
      <AppScreen title='完成/导出批次' onBack={() => window.history.back()}>
        <SubmitLoading />
      </AppScreen>
    )
  }

  if (state.status === 'missing') {
    return (
      <AppScreen title='完成/导出批次' onBack={() => window.history.back()}>
        <AppError
          title='未找到本地批次'
          message='请返回首页选择本机已有批次，或重新创建本地扫描批次。'
        />
      </AppScreen>
    )
  }

  if (state.status === 'error') {
    return (
      <AppScreen title='完成/导出批次' onBack={() => window.history.back()}>
        <AppError title={state.error.title} message={state.error.message} />
      </AppScreen>
    )
  }

  const batch = state.batch
  const actionDisabled = activeAction !== 'idle'
  const canComplete = batch.status === 'draft' && batch.items.length > 0

  return (
    <AppScreen title='完成/导出批次' onBack={() => window.history.back()}>
      <div className='space-y-5'>
        <LocalSubmitSummary batch={batch} />
        <LocalValidationAlert />
        {actionError ? <ActionErrorAlert error={actionError} /> : null}
        {exportSuccess ? <ExportSuccessAlert result={exportSuccess} /> : null}

        {batch.status === 'draft' ? (
          <div className='grid gap-3 sm:grid-cols-2'>
            <Button
              type='button'
              className='min-h-11 w-full md:min-h-11'
              disabled={!canComplete || actionDisabled}
              onClick={() => void handleComplete()}
            >
              {activeAction === 'completing' ? '正在完成…' : '完成批次'}
            </Button>
            <Button
              asChild
              variant='outline'
              className='min-h-11 w-full md:min-h-11'
            >
              <a href={`/scan/${batch.localBatchId}`}>返回扫描继续修改</a>
            </Button>
          </div>
        ) : (
          <div className='grid gap-3 sm:grid-cols-2'>
            <Button
              type='button'
              className='min-h-11 w-full md:min-h-11'
              disabled={actionDisabled}
              onClick={() => void handleExportAndShare()}
            >
              {activeAction === 'exporting' ? '正在导出…' : '导出 Excel 并分享'}
            </Button>
            <Button
              asChild
              variant='outline'
              className='min-h-11 w-full md:min-h-11'
            >
              <a href='/'>返回首页</a>
            </Button>
          </div>
        )}
      </div>
    </AppScreen>
  )
}

function RequiredSubmitPage({ batchId }: { batchId: string }) {
  const submitMutation = useSubmitMobileBatchMutation(batchId)
  const [activeDraft, setActiveDraft] = useState<LocalActiveDraft | null>(() =>
    loadActiveDraft()
  )
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [requestSnapshot, setRequestSnapshot] =
    useState<SubmitMobileScanBatchRequest | null>(null)
  const [submitResult, setSubmitResult] =
    useState<SubmitMobileScanBatchResult | null>(null)

  const submitRequest = async (request: SubmitMobileScanBatchRequest) => {
    setSubmitError(null)
    setValidationError(null)
    submitMutation.reset()

    try {
      const result = await submitMutation.mutateAsync(request)
      clearActiveDraft()
      setActiveDraft(null)
      setSubmitResult(result)
    } catch (error) {
      setSubmitError(error)
    }
  }

  const handleSubmit = () => {
    if (requestSnapshot) {
      void submitRequest(requestSnapshot)
      return
    }

    const draft = activeDraft
    if (isCreatedDraft(draft) !== true) {
      setValidationError('本地草稿尚未完成后端创建')
      return
    }

    if (draft.batchId !== batchId) {
      setValidationError('本地草稿与当前批次不一致')
      return
    }

    const itemError = validateDraftItems(draft)
    if (itemError) {
      setValidationError(itemError)
      return
    }

    const request: SubmitMobileScanBatchRequest = {
      client_batch_id: draft.clientBatchId,
      items: draft.items.map((item) => ({
        client_item_id: item.clientItemId,
        serial_number: item.serialNumber,
        barcode_format: item.barcodeFormat,
        raw_value: item.rawValue,
        rack_id: item.rackId,
        u_position: item.uPosition,
      })),
    }

    setValidationError(null)
    setRequestSnapshot(request)
    void submitRequest(request)
  }

  if (submitResult) {
    return (
      <AppScreen title='提交结果' onBack={() => window.history.back()}>
        <div className='space-y-5'>
          <section className='rounded-lg border bg-card p-5 text-card-foreground shadow-sm'>
            <div className='flex items-start gap-3'>
              <div
                className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'
                aria-hidden='true'
              >
                <CheckCircle2Icon className='size-6' />
              </div>
              <div className='min-w-0 space-y-2'>
                <h2 className='text-base font-semibold'>批次提交完成</h2>
                <p className='max-w-[65ch] text-sm leading-6 text-muted-foreground'>
                  后端已完成本次批次提交处理，可返回首页继续现场作业。
                </p>
                <p className='text-xs leading-5 text-muted-foreground'>
                  批次 ID：
                  <span className='font-mono break-all text-foreground'>
                    {submitResult.batch_id}
                  </span>
                </p>
              </div>
            </div>
          </section>
          <SubmitResult result={submitResult} />
          <Button asChild className='h-12 w-full text-base'>
            <a href='/'>返回首页</a>
          </Button>
        </div>
      </AppScreen>
    )
  }

  const blockMessage = getDraftBlockMessage(activeDraft, batchId)
  if (blockMessage || !isCreatedDraft(activeDraft)) {
    return (
      <AppScreen title='提交批次' onBack={() => window.history.back()}>
        <AppError
          title='无法提交批次'
          message={blockMessage ?? '本地草稿尚未完成后端创建'}
        />
      </AppScreen>
    )
  }

  return (
    <AppScreen title='提交批次' onBack={() => window.history.back()}>
      <div className='space-y-5'>
        <SubmitSummary draft={activeDraft} />
        {validationError ? (
          <ValidationErrorAlert message={validationError} />
        ) : null}
        {submitError ? <SubmitErrorAlert error={submitError} /> : null}
        <Button
          type='button'
          className='h-12 w-full text-base'
          disabled={submitMutation.isPending}
          onClick={handleSubmit}
        >
          {submitMutation.isPending
            ? '正在提交…'
            : submitError
              ? '重试提交同一批次'
              : '提交批次'}
        </Button>
      </div>
    </AppScreen>
  )
}

function SubmitLoading() {
  return (
    <div className='space-y-3' aria-label='正在加载批次导出页'>
      <Skeleton className='h-28 w-full' />
      <Skeleton className='h-11 w-full' />
      <Skeleton className='h-11 w-full' />
    </div>
  )
}

function LocalValidationAlert() {
  return (
    <Alert>
      <AlertTitle>离线导出说明</AlertTitle>
      <AlertDescription>
        Excel
        明细会标记“仅本地校验，未中心校验”。请通过系统分享发送文件，不会连接微信或
        QQ 专用 SDK。
      </AlertDescription>
    </Alert>
  )
}

function ActionErrorAlert({ error }: { error: LocalRepositoryError }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

function ExportSuccessAlert({ result }: { result: ExportSuccessState }) {
  return (
    <Alert>
      <AlertTitle>Excel 已导出并唤起系统分享</AlertTitle>
      <AlertDescription>
        <p>{result.fileName}</p>
        <p>文件大小：{result.fileSize} 字节</p>
        <p>文件指纹：{result.fileHash}</p>
      </AlertDescription>
    </Alert>
  )
}

function getDraftBlockMessage(
  draft: LocalActiveDraft | null,
  batchId: string
): string | null {
  if (!draft) return '未找到可提交的本地草稿'

  if (isCreatedDraft(draft) !== true) return '本地草稿尚未完成后端创建'

  if (draft.batchId !== batchId) return '本地草稿与当前批次不一致'

  return null
}

function validateDraftItems(draft: LocalCreatedDraft): string | null {
  if (draft.items.length === 0) return '扫描条目不能为空'

  for (const item of draft.items) {
    if (item.rackId.length === 0) return '扫描条目缺少机柜'
    if (item.serialNumber.length === 0) return '扫描条目缺少 SN'
    if (item.barcodeFormat.length === 0) return '扫描条目缺少条码格式'
    const trimmedRawValue = item.rawValue.trim()
    if (trimmedRawValue.length === 0) return '扫描条目缺少原始值'
    if (item.serialNumber !== trimmedRawValue)
      return '扫描条目 SN 与原始值不一致'
    if (
      item.uPosition !== null &&
      (!Number.isInteger(item.uPosition) ||
        item.uPosition < 1 ||
        item.uPosition > 60)
    ) {
      return '扫描条目 U 位必须在 1 到 60 之间'
    }
  }

  return null
}

function ValidationErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>提交前校验失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function SubmitErrorAlert({ error }: { error: unknown }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>提交失败</AlertTitle>
      <AlertDescription>{submitErrorMessage(error)}</AlertDescription>
    </Alert>
  )
}

function submitErrorMessage(error: unknown) {
  if (isAPIError(error) && error.message) return error.message
  if (error instanceof Error && error.message) return error.message
  return '请稍后重试。'
}

function toLocalRepositoryError(error: unknown): LocalRepositoryError {
  if (isLocalAppError(error)) {
    return {
      title: localErrorTitle(error.code),
      message: localErrorMessage(error.code),
    }
  }

  return {
    title: '操作失败',
    message: '请稍后重试。',
  }
}
