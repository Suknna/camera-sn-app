import { Card, CardContent, CardHeader } from '@shared/components/ui/card'
import { Skeleton } from '@shared/components/ui/skeleton'

export interface AppLoadingProps {
  title?: string
  description?: string
}

export function AppLoading({
  title = '正在加载',
  description = '请稍候，正在准备工程师 App。',
}: AppLoadingProps) {
  return (
    <div
      className='flex min-h-svh items-center justify-center bg-background px-4 py-6 text-foreground'
      aria-busy='true'
      aria-live='polite'
    >
      <Card className='w-full max-w-sm'>
        <CardHeader className='space-y-2'>
          <p className='text-sm font-medium'>{title}</p>
          <p className='text-sm leading-6 text-muted-foreground'>
            {description}
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-full' />
          </div>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-24 w-full' />
        </CardContent>
      </Card>
    </div>
  )
}
