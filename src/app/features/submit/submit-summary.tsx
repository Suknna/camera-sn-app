import type { LocalCreatedDraft } from '@app/lib/local-draft-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/components/ui/card'

interface SubmitSummaryProps {
  draft: LocalCreatedDraft
}

export function SubmitSummary({ draft }: SubmitSummaryProps) {
  return (
    <Card>
      <CardHeader className='space-y-2'>
        <h2 className='text-base leading-none font-semibold'>提交摘要</h2>
        <CardDescription className='leading-6'>
          本次将提交 {draft.items.length}{' '}
          条扫描记录。提交失败后可继续重试同一批次。
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-5'>
        <dl className='grid gap-4 border-y py-4 text-sm sm:grid-cols-2'>
          <div className='space-y-1'>
            <dt className='text-muted-foreground'>后端批次 ID</dt>
            <dd className='font-mono font-medium break-all'>{draft.batchId}</dd>
          </div>
          <div className='space-y-1'>
            <dt className='text-muted-foreground'>客户端批次 ID</dt>
            <dd className='font-mono font-medium break-all'>
              {draft.clientBatchId}
            </dd>
          </div>
          <div className='space-y-1'>
            <dt className='text-muted-foreground'>批次号</dt>
            <dd className='font-mono font-medium break-all'>{draft.batchNo}</dd>
          </div>
          <div className='space-y-1'>
            <dt className='text-muted-foreground'>扫描条目数</dt>
            <dd className='font-medium'>{draft.items.length}</dd>
          </div>
        </dl>

        {draft.items.length === 0 ? (
          <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
            当前批次没有待提交扫描记录。
          </p>
        ) : (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium'>待提交扫描记录</h3>
            <ul className='divide-y border-y' aria-label='待提交扫描记录'>
              {draft.items.map((item) => (
                <li key={item.clientItemId} className='space-y-1 py-3'>
                  <p className='font-mono text-sm font-medium break-all'>
                    SN：{item.serialNumber}
                  </p>
                  <p className='text-xs leading-5 text-muted-foreground'>
                    机柜：<span className='font-mono'>{item.rackId}</span>；U
                    位：
                    {item.uPosition ?? '未填写'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
