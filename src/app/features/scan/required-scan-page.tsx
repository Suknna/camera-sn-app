import { useId, useState, type ComponentProps } from 'react'
import { Link } from '@tanstack/react-router'
import { AppError } from '@app/components/app-error'
import { AppScreen } from '@app/components/app-screen'
import {
  addDraftItem,
  clearActiveDraft,
  isCreatedDraft,
  loadActiveDraft,
  removeDraftItem,
  saveActiveDraft,
  type LocalActiveDraft,
  type LocalCreatedDraft,
  type LocalDraftScanItem,
} from '@app/lib/local-draft-store'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { SelectField } from '@shared/components/ui/select-field'
import { Skeleton } from '@shared/components/ui/skeleton'
import type {
  ContextRackDTO,
  MobileContextDTO,
} from '@shared/types/mobile'
import { useMobileContextQuery } from '../batch-create/queries'
import { RackUnavailableAlert } from './rack-picker'
import { useCancelMobileBatchMutation, useMobileBatchQuery } from './queries'
import { ScanCapture } from './scan-capture'
import { ScanContextBar } from './scan-context-bar'
import { ScanItemList } from './scan-item-list'
import { UPositionField, validateUPositionInput } from './u-position-field'

interface RequiredScanPageProps {
  batchId: string
  createClientItemID?: ComponentProps<typeof ScanCapture>['createClientItemID']
  now?: ComponentProps<typeof ScanCapture>['now']
  startScanner?: ComponentProps<typeof ScanCapture>['startScanner']
}

export function RequiredScanPage({
  batchId,
  createClientItemID,
  now,
  startScanner,
}: RequiredScanPageProps) {
  const [activeDraft, setActiveDraft] = useState<LocalActiveDraft | null>(() =>
    loadActiveDraft()
  )

  if (!activeDraft) {
    return <BlockedDraftPage message='未找到可继续扫描的本地草稿' />
  }

  if (activeDraft.state === 'pending_create') {
    return <BlockedDraftPage message='本地草稿尚未完成后端创建' />
  }

  if (activeDraft.batchId !== batchId) {
    return <BlockedDraftPage message='本地草稿与当前批次不一致' />
  }

  return (
    <CreatedDraftScanPage
      batchId={batchId}
      draft={activeDraft}
      createClientItemID={createClientItemID}
      now={now}
      startScanner={startScanner}
      onDraftChange={setActiveDraft}
    />
  )
}

function CreatedDraftScanPage({
  batchId,
  draft,
  createClientItemID,
  now,
  startScanner,
  onDraftChange,
}: {
  batchId: string
  draft: LocalCreatedDraft
  createClientItemID?: ComponentProps<typeof ScanCapture>['createClientItemID']
  now?: ComponentProps<typeof ScanCapture>['now']
  startScanner?: ComponentProps<typeof ScanCapture>['startScanner']
  onDraftChange: (draft: LocalActiveDraft | null) => void
}) {
  const batchQuery = useMobileBatchQuery(batchId)
  const contextQuery = useMobileContextQuery()
  const cancelMutation = useCancelMobileBatchMutation()
  const [rackId, setRackId] = useState('')
  const [rackError, setRackError] = useState<string | undefined>()
  const [uPosition, setUPosition] = useState('')
  const [cancelError, setCancelError] = useState<unknown>(null)
  const [editingContext, setEditingContext] = useState(true)
  const contextEditorId = useId()
  const uPositionError = validateUPositionInput(uPosition)

  const handleAddItem = (item: LocalDraftScanItem) => {
    const latestDraft = loadActiveDraft()
    if (!isCreatedDraft(latestDraft) || latestDraft.batchId !== draft.batchId) {
      throw new Error('本地草稿不可继续扫描')
    }

    const updatedDraft = addDraftItem(latestDraft, item)
    saveActiveDraft(updatedDraft)
    onDraftChange(updatedDraft)
    setRackError(undefined)
  }

  const handleRemoveItem = (clientItemId: string) => {
    const latestDraft = loadActiveDraft()
    if (!isCreatedDraft(latestDraft) || latestDraft.batchId !== draft.batchId) {
      return
    }

    const updatedDraft = removeDraftItem(latestDraft, clientItemId)
    saveActiveDraft(updatedDraft)
    onDraftChange(updatedDraft)
  }

  const handleCancel = async () => {
    setCancelError(null)
    try {
      await cancelMutation.mutateAsync(batchId)
      clearActiveDraft()
      onDraftChange(null)
    } catch (error) {
      setCancelError(error)
    }
  }

  if (batchQuery.isLoading || contextQuery.isLoading) {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <ScanLoading />
      </AppScreen>
    )
  }

  if (batchQuery.error) {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <AppError title='批次加载失败' message={errorMessage(batchQuery.error)} />
      </AppScreen>
    )
  }

  if (contextQuery.error) {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <AppError
          title='目录加载失败'
          message={errorMessage(contextQuery.error)}
        />
      </AppScreen>
    )
  }

  if (batchQuery.data?.status !== 'draft') {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <Alert variant='destructive'>
          <AlertTitle>批次已不可继续扫描</AlertTitle>
          <AlertDescription>
            后端批次状态已不是 draft，请返回首页查看当前本地草稿。
          </AlertDescription>
        </Alert>
      </AppScreen>
    )
  }

  const context = contextQuery.data
  if (!context) {
    return (
      <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
        <AppError title='目录加载失败' message='请稍后重试。' />
      </AppScreen>
    )
  }

  const editingDisabled = cancelMutation.isPending
  const captureDisabled = editingDisabled || Boolean(uPositionError)
  const rackLabel = rackLabelFor(context, draft.roomId, rackId)
  const showContextEditor = editingContext || !rackId || Boolean(uPositionError)

  return (
    <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
      <div className='space-y-5'>
        <section className='space-y-3' aria-label='扫描上下文'>
          <p className='text-sm text-muted-foreground'>
            批次号：{draft.batchNo}
          </p>
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
              <RequiredRackPicker
                context={context}
                roomId={draft.roomId}
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
          onAddItem={(item) => {
            if (!rackId) setRackError('请选择机柜')
            handleAddItem(item)
          }}
        />

        <section className='space-y-4' aria-label='已扫列表与提交'>
          <ScanItemList
            items={draft.items}
            disabled={editingDisabled}
            emptyTitle='待提交列表为空'
            emptyDescription='选择机柜后连续扫码，识别结果会先保存在本地草稿中。'
            subtitle='待提交列表'
            onRemove={handleRemoveItem}
          />

          {cancelError ? <CancelErrorAlert error={cancelError} /> : null}

          <div className='grid gap-3 sm:grid-cols-2'>
            {draft.items.length > 0 ? (
              <Button
                asChild
                variant='secondary'
                className='min-h-11 w-full md:min-h-11'
              >
                <Link to='/submit/$batchId' params={{ batchId }}>
                  提交批次
                </Link>
              </Button>
            ) : (
              <Button
                type='button'
                variant='secondary'
                className='min-h-11 w-full md:min-h-11'
                disabled
              >
                提交批次
              </Button>
            )}
            <Button
              type='button'
              variant='outline'
              className='min-h-11 w-full md:min-h-11'
              disabled={editingDisabled}
              onClick={() => void handleCancel()}
            >
              {editingDisabled ? '正在取消…' : '取消批次'}
            </Button>
          </div>
        </section>
      </div>
    </AppScreen>
  )
}

function RequiredRackPicker({
  context,
  roomId,
  value,
  error,
  disabled = false,
  onChange,
}: {
  context: MobileContextDTO
  roomId: string
  value: string
  error?: string
  disabled?: boolean
  onChange: (rackId: string) => void
}) {
  const racks = racksForRoom(context, roomId)

  if (racks.length === 0) {
    return <RackUnavailableAlert />
  }

  return (
    <SelectField
      id='scan-rack'
      label='机柜'
      placeholder='请选择机柜'
      value={value}
      options={racks.map((rack) => ({
        value: rack.id,
        label: `${rack.name}（${rack.code}）`,
      }))}
      error={error}
      disabled={disabled}
      onValueChange={onChange}
    />
  )
}

function BlockedDraftPage({ message }: { message: string }) {
  return (
    <AppScreen title='扫描 SN' onBack={() => window.history.back()}>
      <section className='space-y-4 rounded-lg border border-dashed p-6 text-center'>
        <div className='space-y-2'>
          <h2 className='text-base font-semibold'>{message}</h2>
          <p className='mx-auto max-w-[65ch] text-sm leading-6 text-muted-foreground'>
            请返回首页继续当前草稿，或重新创建扫描批次。
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

function CancelErrorAlert({ error }: { error: unknown }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>取消失败</AlertTitle>
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  )
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '请稍后重试。'
}

function rackLabelFor(
  context: MobileContextDTO,
  roomId: string,
  rackId: string
): string {
  const rack = findRack(context, roomId, rackId)
  return rack ? `${rack.name}（${rack.code}）` : ''
}

function racksForRoom(context: MobileContextDTO, roomId: string) {
  for (const dataCenter of context.data_centers) {
    const room = dataCenter.rooms.find((candidate) => candidate.id === roomId)
    if (room) return room.racks
  }

  return []
}

function findRack(
  context: MobileContextDTO,
  roomId: string,
  rackId: string
): ContextRackDTO | undefined {
  if (!rackId) return undefined

  return racksForRoom(context, roomId).find((rack) => rack.id === rackId)
}
