import { Badge } from '@shared/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/components/ui/card'
import type {
  MobileBatchStatus,
  MobileConflictReason,
  SubmitMobileScanBatchResult,
} from '@shared/types/mobile'

interface SubmitResultProps {
  result: SubmitMobileScanBatchResult
}

export function SubmitResult({ result }: SubmitResultProps) {
  const conflictItems = result.items.filter(
    (item) => item.status === 'conflict' || item.conflict_reason !== null
  )

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-2'>
            <h2 className='text-base leading-none font-semibold'>结果摘要</h2>
            <CardDescription className='leading-6'>
              已保留后端返回的提交状态与每条扫描记录结果。
            </CardDescription>
          </div>
          <StatusBadge status={result.status} />
        </div>
      </CardHeader>

      <CardContent className='space-y-5'>
        <dl className='grid grid-cols-2 gap-4 border-y py-4 text-sm'>
          <div className='space-y-1'>
            <dt className='text-muted-foreground'>已接收条目</dt>
            <dd className='text-2xl font-semibold'>{result.accepted_count}</dd>
          </div>
          <div className='space-y-1'>
            <dt className='text-muted-foreground'>冲突条目</dt>
            <dd className='text-2xl font-semibold'>{result.conflict_count}</dd>
          </div>
        </dl>

        {conflictItems.length > 0 ? (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium'>冲突记录</h3>
            <ul className='divide-y border-y' aria-label='冲突条目'>
              {conflictItems.map((item) => (
                <li key={item.client_item_id} className='space-y-1 py-3'>
                  <p className='font-mono text-sm font-medium break-all'>
                    SN：{item.serial_number}
                  </p>
                  {item.conflict_reason ? (
                    <p className='text-sm leading-6 text-destructive'>
                      冲突原因：{conflictReasonMessage(item.conflict_reason)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: MobileBatchStatus }) {
  if (status === 'accepted') {
    return <Badge>已接受</Badge>
  }

  if (status === 'submitted') {
    return <Badge variant='secondary'>等待管理员审核</Badge>
  }

  if (status === 'rejected') {
    return <Badge variant='destructive'>已拒绝</Badge>
  }

  if (status === 'cancelled') {
    return <Badge variant='outline'>已取消</Badge>
  }

  return <Badge variant='outline'>草稿</Badge>
}

function conflictReasonMessage(reason: MobileConflictReason): string {
  if (reason === 'SN_ALREADY_EXISTS') return 'SN 已存在'
  return '存在冲突'
}
