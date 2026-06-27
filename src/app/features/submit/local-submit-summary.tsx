import type {
  LocalBatchStatus,
  LocalScanBatchDetail,
} from '@app/lib/local-db/types'
import { Badge } from '@shared/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/components/ui/card'

interface LocalSubmitSummaryProps {
  batch: LocalScanBatchDetail
}

export function LocalSubmitSummary({ batch }: LocalSubmitSummaryProps) {
  const status = batchStatusCopy(batch.status)

  return (
    <Card>
      <CardHeader className='space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant={status.variant}>{status.label}</Badge>
          <h2 className='text-base leading-none font-semibold'>批次摘要</h2>
        </div>
        <CardDescription className='leading-6'>
          本页仅处理本机离线批次完成、Excel 导出与系统分享；不会上传到企业中心。
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-5'>
        <dl className='grid gap-4 border-y py-4 text-sm sm:grid-cols-2'>
          <SummaryField label='批次号' value={batch.batchNo} mono />
          <SummaryField
            label='客户端批次 ID'
            value={batch.clientBatchId}
            mono
          />
          <SummaryField label='数据中心' value={batch.dataCenterName} />
          <SummaryField label='机房' value={batch.roomName} />
          <SummaryField label='到货批次' value={batch.arrivalBatchName} />
          <SummaryField label='扫描条目数' value={`${batch.items.length} 条`} />
        </dl>

        {batch.items.length === 0 ? (
          <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
            当前批次没有扫描记录，至少扫描一条 SN 后才能完成批次。
          </p>
        ) : (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium'>本地扫描记录</h3>
            <ul className='divide-y border-y' aria-label='本地扫描记录'>
              {batch.items.map((item) => (
                <li key={item.localItemId} className='space-y-1 py-3'>
                  <p className='font-mono text-sm font-medium break-all'>
                    SN：{item.serialNumber}
                  </p>
                  <p className='text-xs leading-5 text-muted-foreground'>
                    机柜：<span className='font-mono'>{item.rackName}</span>；U
                    位：{item.uPosition ?? '未填写'}
                  </p>
                  <p className='text-xs leading-5 text-muted-foreground'>
                    仅本地校验，未中心校验
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

function SummaryField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className='space-y-1'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className={mono ? 'font-mono font-medium break-all' : 'font-medium'}>
        {value}
      </dd>
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
