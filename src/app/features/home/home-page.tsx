import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AppError } from '@app/components/app-error'
import { AppScreen } from '@app/components/app-screen'
import { createSQLiteScanRepository } from '@app/lib/local-db/sqlite-client'
import type {
  AppProfile,
  LocalBatchStatus,
  LocalScanBatchSummary,
  LocalScanRepository,
} from '@app/lib/local-db/types'
import {
  isLocalAppError,
  localErrorMessage,
  localErrorTitle,
} from '@app/lib/local-errors'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/components/ui/card'
import { Skeleton } from '@shared/components/ui/skeleton'
import { OperatorNamePage } from '../profile/operator-name-page'

interface HomePageProps {
  repository?: LocalScanRepository
}

type HomeState =
  | { status: 'loading' }
  | { status: 'profile-required' }
  | {
      status: 'ready'
      profile: AppProfile
      batches: LocalScanBatchSummary[]
    }
  | { status: 'error'; title: string; message: string }

export function HomePage({ repository: repositoryProp }: HomePageProps = {}) {
  const [repository] = useState<LocalScanRepository>(
    () => repositoryProp ?? createSQLiteScanRepository()
  )
  const [state, setState] = useState<HomeState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    async function initializeHome() {
      try {
        await repository.initialize()
        const profile = await repository.getProfile()
        if (!active) return
        if (!profile) {
          setState({ status: 'profile-required' })
          return
        }

        const batches = await repository.listBatches()
        if (active) setState({ status: 'ready', profile, batches })
      } catch (error) {
        if (active)
          setState({ status: 'error', ...toLocalRepositoryError(error) })
      }
    }

    void initializeHome()

    return () => {
      active = false
    }
  }, [repository])

  const showLocalHome = (profile: AppProfile) => {
    setState({ status: 'loading' })
    void repository
      .listBatches()
      .then((batches) => setState({ status: 'ready', profile, batches }))
      .catch((error: unknown) =>
        setState({ status: 'error', ...toLocalRepositoryError(error) })
      )
  }

  if (state.status === 'loading') {
    return <HomeLoading />
  }

  if (state.status === 'error') {
    return (
      <AppScreen title='现场扫描'>
        <AppError title={state.title} message={state.message} />
      </AppScreen>
    )
  }

  if (state.status === 'profile-required') {
    return <OperatorNamePage repository={repository} onSaved={showLocalHome} />
  }

  return (
    <AppScreen title='现场扫描'>
      <section className='space-y-4'>
        <Card>
          <CardHeader className='space-y-3 text-center'>
            <img
              src='/logo-mark.png'
              alt=''
              aria-hidden='true'
              className='mx-auto size-14'
            />
            <div className='space-y-2'>
              <h2 className='text-xl leading-none font-semibold'>
                本地扫描批次
              </h2>
              <CardDescription className='mx-auto max-w-[65ch] leading-6'>
                当前操作人：{state.profile.operatorName}
                。批次、扫码记录和导出状态保存在本机。
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className='h-12 w-full text-base'>
              <Link to='/batches/new'>开始扫描</Link>
            </Button>
          </CardContent>
        </Card>
        <LocalBatchList batches={state.batches} />
      </section>
    </AppScreen>
  )
}

function HomeLoading() {
  return (
    <AppScreen title='现场扫描'>
      <Card>
        <CardHeader className='space-y-2'>
          <Skeleton className='h-5 w-28' />
          <CardDescription className='leading-6'>
            正在初始化本地数据库与批次列表。
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Skeleton className='h-11 w-full' />
          <Skeleton className='h-11 w-full' />
        </CardContent>
      </Card>
    </AppScreen>
  )
}

function LocalBatchList({ batches }: { batches: LocalScanBatchSummary[] }) {
  if (batches.length === 0) {
    return (
      <section className='rounded-lg border border-dashed p-4 text-center'>
        <h2 className='text-base font-semibold'>暂无本地批次</h2>
        <p className='mx-auto mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground'>
          开始扫描后，本机批次会保存在这里，弱网和离线环境下也能继续查看。
        </p>
      </section>
    )
  }

  return (
    <section className='space-y-3'>
      <div className='space-y-1'>
        <h2 className='text-base font-semibold'>本地批次列表</h2>
        <p className='text-sm leading-6 text-muted-foreground'>
          按最近更新时间排序，所有状态来自本机 SQLite。
        </p>
      </div>
      <ul className='divide-y rounded-lg border bg-card text-card-foreground shadow-sm'>
        {batches.map((batch) => (
          <li key={batch.localBatchId} className='p-4'>
            <BatchSummaryItem batch={batch} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function BatchSummaryItem({ batch }: { batch: LocalScanBatchSummary }) {
  const status = batchStatusCopy(batch.status)
  const actionHref =
    batch.status === 'draft'
      ? `/scan/${batch.localBatchId}`
      : `/submit/${batch.localBatchId}`
  const actionLabel = batch.status === 'draft' ? '继续扫描' : '查看/导出'

  return (
    <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
      <div className='min-w-0 space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant={status.variant}>{status.label}</Badge>
          <h3 className='truncate text-base font-semibold'>{batch.batchNo}</h3>
        </div>
        <dl className='grid gap-2 text-sm sm:grid-cols-2'>
          <BatchField label='数据中心' value={batch.dataCenterName} />
          <BatchField label='机房' value={batch.roomName} />
          <BatchField label='SN 数量' value={`${batch.itemCount} 条`} />
          <BatchField
            label='更新时间'
            value={formatUpdatedAt(batch.updatedAt)}
          />
        </dl>
      </div>
      <Button asChild variant='outline' className='h-11 w-full sm:w-auto'>
        <a href={actionHref}>{actionLabel}</a>
      </Button>
    </div>
  )
}

function BatchField({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='truncate font-medium'>{value}</dd>
    </div>
  )
}

function batchStatusCopy(status: LocalBatchStatus): {
  label: string
  variant: 'default' | 'secondary' | 'outline'
} {
  if (status === 'completed') return { label: '已完成', variant: 'secondary' }
  if (status === 'exported') return { label: '已导出', variant: 'outline' }
  return { label: '进行中', variant: 'default' }
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

interface LocalRepositoryError {
  title: string
  message: string
}

function toLocalRepositoryError(error: unknown): LocalRepositoryError {
  if (isLocalAppError(error)) {
    return {
      title: localErrorTitle(error.code),
      message: localErrorMessage(error.code),
    }
  }

  return {
    title: localErrorTitle('LOCAL_DB_UNAVAILABLE'),
    message: localErrorMessage('LOCAL_DB_UNAVAILABLE'),
  }
}
