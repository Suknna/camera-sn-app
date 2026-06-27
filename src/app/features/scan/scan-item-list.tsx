import type { LocalDraftScanItem } from '@app/lib/local-draft-store'
import type { LocalScanItem } from '@app/lib/local-db/types'
import { Button } from '@shared/components/ui/button'
import { Trash2Icon } from 'lucide-react'

type ScanListItem = LocalScanItem | LocalDraftScanItem

interface ScanItemListProps {
  items: ScanListItem[]
  disabled?: boolean
  emptyTitle?: string
  emptyDescription?: string
  subtitle?: string
  onRemove: (itemId: string) => void
}

export function ScanItemList({
  items,
  disabled = false,
  emptyTitle = '待完成列表为空',
  emptyDescription = '选择机柜后连续扫码，识别结果会保存到本机 SQLite。',
  subtitle = '本机扫描记录',
  onRemove,
}: ScanItemListProps) {
  if (items.length === 0) {
    return (
      <section className='rounded-lg border border-dashed p-6 text-center'>
        <h2 className='text-base font-semibold'>{emptyTitle}</h2>
        <p className='mx-auto mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground'>
          {emptyDescription}
        </p>
      </section>
    )
  }

  return (
    <section className='space-y-3' aria-labelledby='scan-item-list-title'>
      <div className='flex items-center justify-between gap-3'>
        <h2 id='scan-item-list-title' className='text-base font-semibold'>
          已扫 {items.length} 台
        </h2>
        <p className='text-sm text-muted-foreground'>{subtitle}</p>
      </div>
      <ul className='space-y-2'>
        {items.map((item) => {
          const itemId = getItemId(item)

          return (
            <li
              key={itemId}
              className='grid gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-xs sm:grid-cols-[1fr_auto] sm:items-center'
            >
              <div className='min-w-0 space-y-1'>
                <p className='font-mono text-sm font-medium break-all'>
                  SN：{item.serialNumber}
                </p>
                <p className='text-xs break-all text-muted-foreground'>
                  原始值：{item.rawValue}
                </p>
                <p className='text-xs text-muted-foreground'>
                  机柜：{getRackLabel(item)}；U 位：{item.uPosition ?? '未填写'}
                  ；格式：
                  {item.barcodeFormat}
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='min-h-11 min-w-11 md:min-h-11 md:min-w-11'
                aria-label={`删除 ${item.serialNumber}`}
                disabled={disabled}
                onClick={() => onRemove(itemId)}
              >
                <Trash2Icon className='size-4' />
                <span className='sr-only'>删除</span>
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function getItemId(item: ScanListItem): string {
  return 'localItemId' in item ? item.localItemId : item.clientItemId
}

function getRackLabel(item: ScanListItem): string {
  return 'rackName' in item && item.rackName ? item.rackName : item.rackId
}
