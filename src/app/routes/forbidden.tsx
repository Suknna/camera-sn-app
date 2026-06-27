import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@shared/components/ui/button'

export const Route = createFileRoute('/forbidden')({
  component: AppForbidden,
})

function AppForbidden() {
  return (
    <div className='flex min-h-svh items-center justify-center bg-background p-4'>
      <div className='max-w-sm space-y-4 text-center'>
        <h1 className='text-xl font-semibold'>无权使用工程师 App</h1>
        <p className='text-muted-foreground'>当前账号不是现场工程师账号。</p>
        <Button asChild>
          <Link to='/sign-in'>返回登录</Link>
        </Button>
      </div>
    </div>
  )
}
