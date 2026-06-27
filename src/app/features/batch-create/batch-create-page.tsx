import { useEffect, useState, type FormEvent } from 'react'
import { AppError } from '@app/components/app-error'
import { AppScreen } from '@app/components/app-screen'
import { getStandaloneCatalog } from '@app/lib/catalog/catalog-provider'
import { createClientID } from '@app/lib/client-id'
import { createSQLiteScanRepository } from '@app/lib/local-db/sqlite-client'
import type { LocalScanRepository } from '@app/lib/local-db/types'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Skeleton } from '@shared/components/ui/skeleton'
import { Textarea } from '@shared/components/ui/textarea'
import {
  ContextSelectors,
  type ContextSelectorErrors,
} from './context-selectors'
import { RequiredBatchCreatePage } from './required-batch-create-page'
import { createBatchSchema, type CreateBatchFormValues } from './schema'

type ValidationErrors = ContextSelectorErrors & {
  operatorName?: string
  arrivalBatchName?: string
  machineConfigSummary?: string
  defaultConfigNote?: string
}

interface LocalRepositoryError {
  title: string
  message: string
}

export interface BatchCreatePageProps {
  repository?: LocalScanRepository
  createClientBatchID?: () => string
  navigateToScan?: (localBatchId: string) => void
  resolveRuntimeConfig?: () => AppRuntimeConfigResult
}

const initialFormValues: CreateBatchFormValues = {
  operatorName: '',
  dataCenterId: '',
  roomId: '',
  arrivalBatchName: '',
  machineConfigSummary: '',
  defaultConfigNote: '',
}

export function BatchCreatePage({
  resolveRuntimeConfig = resolveAppRuntimeConfig,
  ...pageProps
}: BatchCreatePageProps) {
  const runtimeConfig = resolveRuntimeConfig()

  if (!runtimeConfig.ok) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <AppError title='App 配置错误' message={runtimeConfig.message} />
      </AppScreen>
    )
  }

  if (runtimeConfig.config.controlPlaneMode === 'required') {
    return (
      <RequiredBatchCreatePage
        createClientBatchID={pageProps.createClientBatchID}
        navigateToScan={pageProps.navigateToScan}
      />
    )
  }

  return <StandaloneBatchCreatePage {...pageProps} />
}

function StandaloneBatchCreatePage({
  repository: repositoryProp,
  createClientBatchID = () => createClientID('batch'),
  navigateToScan = defaultNavigateToScan,
}: Omit<BatchCreatePageProps, 'resolveRuntimeConfig'>) {
  const [repository] = useState<LocalScanRepository>(
    () => repositoryProp ?? createSQLiteScanRepository()
  )
  const [catalog] = useState(getStandaloneCatalog)
  const [formValues, setFormValues] =
    useState<CreateBatchFormValues>(initialFormValues)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [initError, setInitError] = useState<LocalRepositoryError | null>(null)
  const [createError, setCreateError] = useState<LocalRepositoryError | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    async function initializeCreateForm() {
      try {
        await repository.initialize()
        const profile = await repository.getProfile()
        if (!active) return

        if (profile) {
          setFormValues((current) => ({
            ...current,
            operatorName: profile.operatorName,
          }))
        }
        setIsLoading(false)
      } catch (error) {
        if (!active) return

        setInitError(toLocalRepositoryError(error))
        setIsLoading(false)
      }
    }

    void initializeCreateForm()

    return () => {
      active = false
    }
  }, [repository])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationErrors({})
    setCreateError(null)

    const parsed = createBatchSchema.safeParse(formValues)
    if (!parsed.success) {
      setValidationErrors(toValidationErrors(parsed.error.issues))
      return
    }

    const dataCenter = catalog.dataCenters.find(
      (candidate) => candidate.id === parsed.data.dataCenterId
    )
    const room = dataCenter?.rooms.find(
      (candidate) => candidate.id === parsed.data.roomId
    )
    if (!dataCenter || !room) {
      setCreateError(toLocalRepositoryErrorCode('CATALOG_SEED_INVALID'))
      return
    }

    setIsSubmitting(true)
    void repository
      .createBatch({
        clientBatchId: createClientBatchID(),
        operatorName: parsed.data.operatorName,
        dataCenterId: dataCenter.id,
        roomId: room.id,
        arrivalBatchName: parsed.data.arrivalBatchName,
        machineConfigSummary: parsed.data.machineConfigSummary,
        defaultConfigNote: parsed.data.defaultConfigNote ?? '',
      })
      .then((batch) => navigateToScan(batch.localBatchId))
      .catch((error: unknown) => setCreateError(toLocalRepositoryError(error)))
      .finally(() => setIsSubmitting(false))
  }

  if (isLoading) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <Card>
          <CardHeader className='space-y-2'>
            <h2 className='text-base leading-none font-semibold'>
              加载本地目录
            </h2>
            <CardDescription className='leading-6'>
              正在初始化本地数据库和内置机房目录。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContextLoading />
          </CardContent>
        </Card>
      </AppScreen>
    )
  }

  if (initError) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <AppError title={initError.title} message={initError.message} />
      </AppScreen>
    )
  }

  if (isCatalogEmpty(catalog)) {
    return (
      <AppScreen title='新建扫描批次' onBack={() => window.history.back()}>
        <section className='rounded-lg border border-dashed p-6 text-center'>
          <h2 className='text-base font-semibold'>暂无内置目录</h2>
          <p className='mx-auto mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground'>
            请检查编译期目录
            seed，至少需要一个数据中心和一个机房后才能创建本地批次。
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
            <h2 className='text-base leading-none font-semibold'>
              本地批次信息
            </h2>
            <CardDescription className='max-w-[65ch] leading-6'>
              本地批次会保存在这台设备上，仅做本机目录和批内 SN
              校验，尚未经过中心校验。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <TextInputField
              id='batch-operator-name'
              label='操作人姓名'
              value={formValues.operatorName}
              placeholder='请输入现场操作人姓名'
              error={validationErrors.operatorName}
              disabled={isSubmitting}
              onChange={(operatorName) => {
                setFormValues({ ...formValues, operatorName })
                setValidationErrors({})
              }}
            />

            <TextInputField
              id='batch-arrival-name'
              label='到货批次'
              value={formValues.arrivalBatchName}
              placeholder='例如：2026-06 到货第一批'
              error={validationErrors.arrivalBatchName}
              disabled={isSubmitting}
              onChange={(arrivalBatchName) => {
                setFormValues({ ...formValues, arrivalBatchName })
                setValidationErrors({})
              }}
            />

            <ContextSelectors
              context={catalog}
              value={formValues}
              errors={validationErrors}
              disabled={isSubmitting}
              onDataCenterChange={(dataCenterId) => {
                setFormValues({ ...formValues, dataCenterId, roomId: '' })
                setValidationErrors({})
              }}
              onRoomChange={(roomId) => {
                setFormValues({ ...formValues, roomId })
                setValidationErrors({})
              }}
            />

            <TextareaField
              id='batch-machine-config-summary'
              label='机器配置'
              value={formValues.machineConfigSummary}
              placeholder='手工填写本批次默认机器配置，例如 CPU、内存、硬盘、网卡等'
              error={validationErrors.machineConfigSummary}
              disabled={isSubmitting}
              onChange={(machineConfigSummary) => {
                setFormValues({ ...formValues, machineConfigSummary })
                setValidationErrors({})
              }}
            />

            <TextareaField
              id='batch-default-config-note'
              label='默认配置备注（可选）'
              value={formValues.defaultConfigNote ?? ''}
              placeholder='可填写默认上架说明、特殊配置或交接备注'
              error={validationErrors.defaultConfigNote}
              disabled={isSubmitting}
              maxLength={1000}
              onChange={(defaultConfigNote) => {
                setFormValues({ ...formValues, defaultConfigNote })
                setValidationErrors({})
              }}
            />

            {createError ? <CreateErrorAlert error={createError} /> : null}

            <Button
              type='submit'
              className='h-12 w-full text-base'
              disabled={isSubmitting}
            >
              {isSubmitting ? '正在创建…' : '创建本地批次'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppScreen>
  )
}

function TextInputField({
  id,
  label,
  value,
  placeholder,
  error,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} className='text-sm text-destructive' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function TextareaField({
  id,
  label,
  value,
  placeholder,
  error,
  disabled,
  maxLength,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  error?: string
  disabled: boolean
  maxLength?: number
  onChange: (value: string) => void
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} className='text-sm text-destructive' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ContextLoading() {
  return (
    <div className='space-y-3' aria-label='正在加载本地批次创建页'>
      <Skeleton className='h-11 w-full' />
      <Skeleton className='h-11 w-full' />
      <Skeleton className='h-24 w-full' />
    </div>
  )
}

function CreateErrorAlert({ error }: { error: LocalRepositoryError }) {
  return (
    <Alert variant='destructive'>
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

function toValidationErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>
): ValidationErrors {
  return issues.reduce<ValidationErrors>((errors, issue) => {
    const field = issue.path[0]
    if (
      field === 'operatorName' ||
      field === 'dataCenterId' ||
      field === 'roomId' ||
      field === 'arrivalBatchName' ||
      field === 'machineConfigSummary' ||
      field === 'defaultConfigNote'
    ) {
      errors[field] = issue.message
    }
    return errors
  }, {})
}

function isCatalogEmpty(catalog: ReturnType<typeof getStandaloneCatalog>) {
  return (
    catalog.dataCenters.length === 0 ||
    catalog.dataCenters.every((dataCenter) => dataCenter.rooms.length === 0)
  )
}

function toLocalRepositoryError(error: unknown): LocalRepositoryError {
  if (isLocalAppError(error)) return toLocalRepositoryErrorCode(error.code)

  return toLocalRepositoryErrorCode('LOCAL_DB_UNAVAILABLE')
}

function toLocalRepositoryErrorCode(
  code: Parameters<typeof localErrorTitle>[0]
): LocalRepositoryError {
  return {
    title: localErrorTitle(code),
    message: localErrorMessage(code),
  }
}

function defaultNavigateToScan(localBatchId: string) {
  window.location.assign(`/scan/${localBatchId}`)
}
