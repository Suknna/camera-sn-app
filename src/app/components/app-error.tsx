import type { ReactNode } from 'react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@shared/components/ui/alert'
import { AlertTriangleIcon } from 'lucide-react'

export interface AppErrorProps {
  title: string
  message: string
  code?: string
  action?: ReactNode
}

export function AppError({ title, message, code, action }: AppErrorProps) {
  return (
    <Alert variant='destructive'>
      <AlertTriangleIcon className='size-4' />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className='space-y-2'>
        <p className='max-w-[65ch]'>{message}</p>
        {code ? (
          <p className='text-xs'>
            错误代码：<code className='font-mono'>{code}</code>
          </p>
        ) : null}
        {action ? <div className='pt-1'>{action}</div> : null}
      </AlertDescription>
    </Alert>
  )
}
