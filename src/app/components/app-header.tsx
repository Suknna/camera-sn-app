import type { ReactNode } from 'react'
import { Button } from '@shared/components/ui/button'
import { ChevronLeftIcon } from 'lucide-react'

export interface AppHeaderProps {
  title: string
  onBack?: () => void
  action?: ReactNode
}

export function AppHeader({ title, onBack, action }: AppHeaderProps) {
  return (
    <header className='sticky top-0 z-10 border-b bg-background/95 backdrop-blur'>
      <div className='flex min-h-14 w-full items-center gap-2 px-4 pt-[env(safe-area-inset-top)]'>
        {onBack ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-11 shrink-0'
            aria-label='返回'
            onClick={onBack}
          >
            <ChevronLeftIcon className='size-5' />
          </Button>
        ) : null}
        <h1 className='min-w-0 flex-1 truncate text-lg font-semibold'>
          {title}
        </h1>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>
    </header>
  )
}
