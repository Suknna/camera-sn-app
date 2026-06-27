import { useState, type FormEvent } from 'react'
import { AppError } from '@app/components/app-error'
import { AppScreen } from '@app/components/app-screen'
import { createClientID } from '@app/lib/client-id'
import {
  clearActiveDraft,
  createPendingDraft,
  isCreatedDraft,
  loadActiveDraft,
  promotePendingDraft,
  saveActiveDraft,
  type LocalActiveDraft,
  type LocalCreatedDraft,
  type LocalPendingCreateDraft,
} from '@app/lib/local-draft-store'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/components/ui/card'
import { Label } from '@shared/components/ui/label'
import { SelectField } from '@shared/components/ui/select-field'
import { Skeleton } from '@shared/components/ui/skeleton'
import { Textarea } from '@shared/components/ui/textarea'
import type { MobileContextDTO } from '@shared/types/mobile'
import { z } from 'zod'
import { useCreateMobileBatchMutation, useMobileContextQuery } from './queries'

interface RequiredBatchCreatePageProps {
  createClientBatchID?: () => string
  navigateToScan?: (batchId: string) => void
}

interface RequiredCreateBatchFormValues {
  dataCenterId: string
  roomId: string
  machineProfileId: string
  remark: string
}

type RequiredValidationErrors = Partial<RequiredCreateBatchFormValues>

const requiredCreateBatchSchema = z.object({
  dataCenterId: z.string().min(1, '请选择数据中心'),
  roomId: z.string().min(1, '请选择机房'),
  machineProfileId: z.string().min(1, '请选择机器配置'),
  remark: z.string().trim().max(500, '备注最多 500 字').optional(),
})

const initialRequiredFormValues: RequiredCreateBatchFormValues = {
  dataCenterId: '',
  roomId: '',
  machineProfileId: '',
  remark: '',
}

export function RequiredBatchCreatePage({
  createClientBatchID = () => createClientID('batch'),
  navigateToScan = defaultNavigateToScan,
}: RequiredBatchCreatePageProps) {
  const contextQuery = useMobileContextQuery()
  const createMutation = useCreateMobileBatchMutation()
  const [activeDraft, setActiveDraft] = useState<LocalActiveDraft | null>(() =>
    loadActiveDraft()
  )
  const [formValues, setFormValues] = useState<RequiredCreateBatchFormValues>(
    initialRequiredFormValues
  )
  const [validationErrors, setValidationErrors] =
    useState<RequiredValidationErrors>({})
  const [createError, setCreateError] = useState<unknown>(null)

  const handleClearDraft = () => {
    if (!window.confirm('确认清除本地草稿？')) return

    clearActiveDraft()
    setActiveDraft(null)
    setCreateError(null)
    createMutation.reset()
  }

  const submitPendingDraft = async (pendingDraft: LocalPendingCreateDraft) => {
    setCreateError(null)
    createMutation.reset()
    saveActiveDraft(pendingDraft)
    setActiveDraft(pendingDraft)

    try {
      const response = await createMutation.mutateAsync({
        client_batch_id: pendingDraft.clientBatchId,
        data_center_id: pendingDraft.dataCenterId,
        room_id: pendingDraft.roomId,
        machine_profile_id: pendingDraft.machineProfileId,
        remark: pendingDraft.remark,
      })
      const createdDraft = promotePendingDraft(pendingDraft, response)
      saveActiveDraft(createdDraft)
      setActiveDraft(createdDraft)
      navigateToScan(createdDraft.batchId)
    } catch (error) {
      setCreateError(error)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationErrors({})

    const latestDraft = loadActiveDraft()
    if (isCreatedDraft(latestDraft)) {
      setActiveDraft(latestDraft)
      return
    }
    if (latestDraft?.state === 'pending_create') {
      void submitPendingDraft(latestDraft)
      return
    }

    const parsed = requiredCreateBatchSchema.safeParse(formValues)
    if (!parsed.success) {
      setValidationErrors(toValidationErrors(parsed.error.issues))
      return
    }

    const pendingDraft = createPendingDraft({
      clientBatchId: createClientBatchID(),
      dataCenterId: parsed.data.dataCenterId,
      roomId: parsed.data.roomId,
      machineProfileId: parsed.data.machineProfileId,
      remark: parsed.data.remark ?? '',
    })

    void submitPendingDraft(pendingDraft)
  }

  if (isCreatedDraft(activeDraft)) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <CreatedDraftBlock draft={activeDraft} onClear={handleClearDraft} />
      </AppScreen>
    )
  }

  if (activeDraft?.state === 'pending_create') {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <PendingDraftBlock
          draft={activeDraft}
          error={createError}
          isSubmitting={createMutation.isPending}
          onRetry={() => void submitPendingDraft(activeDraft)}
          onClear={handleClearDraft}
        />
      </AppScreen>
    )
  }

  if (contextQuery.isLoading) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <Card>
          <CardHeader className='space-y-2'>
            <h2 className='text-base leading-none font-semibold'>加载目录</h2>
            <CardDescription className='leading-6'>
              正在加载移动端可用目录。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContextLoading />
          </CardContent>
        </Card>
      </AppScreen>
    )
  }

  if (contextQuery.error) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <AppError
          title='目录加载失败'
          message={errorMessage(contextQuery.error)}
        />
      </AppScreen>
    )
  }

  const context = contextQuery.data
  if (!context || isContextEmpty(context)) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <section className='rounded-lg border border-dashed p-6 text-center'>
          <h2 className='text-base font-semibold'>暂无可用目录</h2>
          <p className='mx-auto mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground'>
            请联系管理员启用数据中心、机房和机器配置后再创建扫描批次。
          </p>
        </section>
      </AppScreen>
    )
  }

  return (
    <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader className='space-y-2'>
            <h2 className='text-base leading-none font-semibold'>批次信息</h2>
            <CardDescription className='leading-6'>
              选择数据中心、机房和机器配置后，后端会先创建 draft 批次。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <RequiredContextSelectors
              context={context}
              value={formValues}
              errors={validationErrors}
              disabled={createMutation.isPending}
              onDataCenterChange={(dataCenterId) => {
                setFormValues({ ...formValues, dataCenterId, roomId: '' })
                setValidationErrors({})
              }}
              onRoomChange={(roomId) => {
                setFormValues({ ...formValues, roomId })
                setValidationErrors({})
              }}
              onMachineProfileChange={(machineProfileId) => {
                setFormValues({ ...formValues, machineProfileId })
                setValidationErrors({})
              }}
            />

            <div className='grid gap-2'>
              <Label htmlFor='batch-remark'>备注</Label>
              <Textarea
                id='batch-remark'
                value={formValues.remark ?? ''}
                maxLength={500}
                placeholder='可填写到货批次、上架说明等信息'
                disabled={createMutation.isPending}
                aria-invalid={Boolean(validationErrors.remark)}
                aria-describedby={
                  validationErrors.remark ? 'batch-remark-error' : undefined
                }
                onChange={(event) => {
                  setFormValues({ ...formValues, remark: event.target.value })
                  setValidationErrors({})
                }}
              />
              {validationErrors.remark ? (
                <p id='batch-remark-error' className='text-sm text-destructive'>
                  {validationErrors.remark}
                </p>
              ) : null}
            </div>

            {createError ? <CreateErrorAlert error={createError} /> : null}

            <Button
              type='submit'
              className='h-12 w-full text-base'
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? '正在创建…' : '创建扫描批次'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppScreen>
  )
}

function RequiredContextSelectors({
  context,
  value,
  errors,
  disabled,
  onDataCenterChange,
  onRoomChange,
  onMachineProfileChange,
}: {
  context: MobileContextDTO
  value: RequiredCreateBatchFormValues
  errors: RequiredValidationErrors
  disabled: boolean
  onDataCenterChange: (dataCenterId: string) => void
  onRoomChange: (roomId: string) => void
  onMachineProfileChange: (machineProfileId: string) => void
}) {
  const selectedDataCenter = context.data_centers.find(
    (dataCenter) => dataCenter.id === value.dataCenterId
  )
  const rooms = selectedDataCenter?.rooms ?? []

  return (
    <div className='grid gap-4'>
      <SelectField
        id='batch-data-center'
        label='数据中心'
        placeholder='请选择数据中心'
        value={value.dataCenterId}
        options={context.data_centers.map((dataCenter) => ({
          value: dataCenter.id,
          label: `${dataCenter.name}（${dataCenter.code}）`,
        }))}
        error={errors.dataCenterId}
        disabled={disabled}
        onValueChange={onDataCenterChange}
      />
      <SelectField
        id='batch-room'
        label='机房'
        placeholder='请选择机房'
        value={value.roomId}
        options={rooms.map((room) => ({
          value: room.id,
          label: `${room.name}（${room.code}）`,
        }))}
        error={errors.roomId}
        disabled={disabled || !value.dataCenterId}
        onValueChange={onRoomChange}
      />
      <SelectField
        id='batch-machine-profile'
        label='机器配置'
        placeholder='请选择机器配置'
        value={value.machineProfileId}
        options={context.machine_profiles.map((profile) => ({
          value: profile.id,
          label: profile.name,
        }))}
        error={errors.machineProfileId}
        disabled={disabled}
        onValueChange={onMachineProfileChange}
      />
    </div>
  )
}

function ContextLoading() {
  return (
    <div className='space-y-3' aria-label='正在加载移动端目录'>
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-24 w-full' />
    </div>
  )
}

function PendingDraftBlock({
  draft,
  error,
  isSubmitting,
  onRetry,
  onClear,
}: {
  draft: LocalPendingCreateDraft
  error: unknown
  isSubmitting: boolean
  onRetry: () => void
  onClear: () => void
}) {
  return (
    <Card className='border-primary/50 bg-primary/5'>
      <CardHeader className='space-y-2'>
        <h2 className='text-base leading-none font-semibold'>本地待创建草稿</h2>
        <CardDescription className='leading-6'>
          上次创建可能已到达后端。请继续创建同一批次，避免弱网重试生成新的 batch
          id。
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <DraftFields draft={draft} />
        {error ? <CreateErrorAlert error={error} /> : null}
        <div className='flex flex-col gap-3 sm:flex-row'>
          <Button
            type='button'
            className='h-12 w-full text-base sm:w-auto'
            onClick={onRetry}
            disabled={isSubmitting}
          >
            {isSubmitting ? '正在重试…' : '重试创建同一批次'}
          </Button>
          <Button
            type='button'
            variant='outline'
            className='h-12 w-full text-base sm:w-auto'
            onClick={onClear}
            disabled={isSubmitting}
          >
            清除本地草稿
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CreatedDraftBlock({
  draft,
  onClear,
}: {
  draft: LocalCreatedDraft
  onClear: () => void
}) {
  return (
    <Card className='border-primary/50 bg-primary/5'>
      <CardHeader className='space-y-2'>
        <h2 className='text-base leading-none font-semibold'>
          已有本地扫描草稿
        </h2>
        <CardDescription className='leading-6'>
          请继续扫描当前批次，或确认清除本地草稿后再创建新批次。
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-1'>
          <p className='text-sm font-medium'>批次号：{draft.batchNo}</p>
          <p className='text-sm text-muted-foreground'>
            已扫描 {draft.items.length} 条
          </p>
        </div>
        <DraftFields draft={draft} />
        <div className='flex flex-col gap-3 sm:flex-row'>
          <Button asChild className='h-12 w-full text-base sm:w-auto'>
            <a href={`/scan/${draft.batchId}`}>继续扫描</a>
          </Button>
          <Button
            type='button'
            variant='outline'
            className='h-12 w-full text-base sm:w-auto'
            onClick={onClear}
          >
            清除本地草稿
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DraftFields({ draft }: { draft: LocalActiveDraft }) {
  return (
    <dl className='grid gap-2 rounded-md bg-muted p-3 text-sm'>
      <div>
        <dt className='text-muted-foreground'>客户端批次 ID</dt>
        <dd className='font-medium break-all'>{draft.clientBatchId}</dd>
      </div>
      <div>
        <dt className='text-muted-foreground'>数据中心 ID</dt>
        <dd className='font-medium break-all'>{draft.dataCenterId}</dd>
      </div>
      <div>
        <dt className='text-muted-foreground'>机房 ID</dt>
        <dd className='font-medium break-all'>{draft.roomId}</dd>
      </div>
      <div>
        <dt className='text-muted-foreground'>机器配置 ID</dt>
        <dd className='font-medium break-all'>{draft.machineProfileId}</dd>
      </div>
      {draft.remark ? (
        <div>
          <dt className='text-muted-foreground'>备注</dt>
          <dd className='font-medium break-all'>{draft.remark}</dd>
        </div>
      ) : null}
    </dl>
  )
}

function CreateErrorAlert({ error }: { error: unknown }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>创建失败</AlertTitle>
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  )
}

function toValidationErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>
): RequiredValidationErrors {
  return issues.reduce<RequiredValidationErrors>((errors, issue) => {
    const field = issue.path[0]
    if (
      field === 'dataCenterId' ||
      field === 'roomId' ||
      field === 'machineProfileId' ||
      field === 'remark'
    ) {
      errors[field] = issue.message
    }
    return errors
  }, {})
}

function isContextEmpty(context: MobileContextDTO) {
  return (
    context.machine_profiles.length === 0 ||
    context.data_centers.length === 0 ||
    context.data_centers.every((dataCenter) => dataCenter.rooms.length === 0)
  )
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '请稍后重试。'
}

function defaultNavigateToScan(batchId: string) {
  window.location.assign(`/scan/${batchId}`)
}
