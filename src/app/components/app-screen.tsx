import type { ReactNode } from 'react'
import { AppHeader } from './app-header'

export interface AppScreenProps {
  title: string
  onBack?: () => void
  action?: ReactNode
  children: ReactNode
}

export function AppScreen({ title, onBack, action, children }: AppScreenProps) {
  return (
    <div className='flex min-h-svh flex-col bg-background text-foreground'>
      <AppHeader title={title} onBack={onBack} action={action} />
      <main
        id='app-main'
        className='flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
      >
        {children}
      </main>
    </div>
  )
}
