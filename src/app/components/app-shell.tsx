import type { ReactNode } from 'react'
import {
  isStandaloneRuntime,
  resolveAppRuntimeConfig,
} from '@app/lib/runtime-config'
import { useAuthStore } from '@shared/auth/auth-store'
import { Button } from '@shared/components/ui/button'
import { LogOutIcon } from 'lucide-react'
import { AppError } from './app-error'

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const runtimeConfig = resolveAppRuntimeConfig()

  if (!runtimeConfig.ok) {
    return (
      <main className='grid min-h-svh place-items-center bg-background px-4 text-foreground'>
        <div className='w-full max-w-sm'>
          <AppError title='App 配置错误' message={runtimeConfig.message} />
          <p className='mt-3 max-w-[65ch] text-xs text-muted-foreground'>
            请检查构建时注入的 App 运行配置，确保控制平面模式与 API
            地址策略匹配后重新打包。
          </p>
        </div>
      </main>
    )
  }

  const controlPlaneConfig = isStandaloneRuntime(runtimeConfig.config)
    ? null
    : runtimeConfig.config

  return (
    <div className='flex min-h-svh flex-col bg-background text-foreground'>
      <a
        href='#app-main'
        className='sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-sm focus:ring-[3px] focus:ring-ring/50 focus:outline-none'
      >
        跳到主内容
      </a>
      <header className='sticky top-0 z-10 border-b bg-background/95 backdrop-blur'>
        <div className='flex min-h-14 w-full items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]'>
          {controlPlaneConfig ? <RequiredHeader /> : <StandaloneHeader />}
        </div>
      </header>
      <main id='app-main' className='flex-1'>
        {children}
      </main>
    </div>
  )
}

function StandaloneHeader() {
  return (
    <div className='min-w-0'>
      <p className='text-base font-semibold'>现场扫描</p>
      <p className='truncate text-xs text-muted-foreground'>本机离线扫描</p>
    </div>
  )
}

function RequiredHeader() {
  const principal = useAuthStore((state) => state.auth.principal)
  const logout = useAuthStore((state) => state.auth.logout)

  return (
    <>
      <div className='min-w-0'>
        <p className='text-base font-semibold'>现场扫描</p>
        <p className='truncate text-xs text-muted-foreground'>
          {principal?.displayName ?? '未登录工程师'}
        </p>
      </div>
      <Button
        type='button'
        variant='outline'
        className='size-11 shrink-0'
        size='icon'
        aria-label='退出登录'
        onClick={() => void logout()}
      >
        <LogOutIcon className='size-5' />
      </Button>
    </>
  )
}
