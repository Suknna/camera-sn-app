import { Button } from '@shared/components/ui/button'
import { Settings2Icon } from 'lucide-react'

export interface ScanContextBarProps {
  rackLabel: string
  uPosition: string
  expanded: boolean
  controlsId: string
  onEdit: () => void
}

export function ScanContextBar({
  rackLabel,
  uPosition,
  expanded,
  controlsId,
  onEdit,
}: ScanContextBarProps) {
  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-card-foreground'>
      <div className='min-w-0 text-sm'>
        <p className='font-medium break-all'>
          {rackLabel || '未选择机柜'}
          {uPosition ? ` · U${uPosition}` : ''}
        </p>
        <p className='text-xs text-muted-foreground'>当前扫描位置</p>
      </div>
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='min-h-11 min-w-11 shrink-0 md:min-h-11 md:min-w-11'
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={onEdit}
      >
        <Settings2Icon className='mr-1 size-4' />
        切换
      </Button>
    </div>
  )
}
