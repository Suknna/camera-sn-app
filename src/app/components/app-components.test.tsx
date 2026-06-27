import '@app/styles.css'
import { useAuthStore } from '@shared/auth/auth-store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { AppError } from './app-error'
import { AppShell } from './app-shell'

describe('app components', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    useAuthStore.getState().auth.reset()
  })

  it('renders AppError message and optional code', async () => {
    const screen = await render(
      <AppError title='配置错误' message='API 地址缺失' code='APP_CONFIG' />
    )

    await expect.element(screen.getByText('配置错误')).toBeVisible()
    await expect.element(screen.getByText('API 地址缺失')).toBeVisible()
    await expect.element(screen.getByText('APP_CONFIG')).toBeVisible()
  })

  it('renders standalone AppShell without auth principal or logout action', async () => {
    vi.stubEnv('VITE_APP_CONTROL_PLANE_MODE', 'standalone')

    const screen = await render(
      <AppShell>
        <p>扫描首页</p>
      </AppShell>
    )

    const skipLink = screen.container.querySelector('a[href="#app-main"]')
    const main = screen.container.querySelector('main#app-main')

    expect(skipLink).not.toBeNull()
    expect(main).not.toBeNull()
    await expect.element(screen.getByText('本机离线扫描')).toBeVisible()
    expect(screen.container.textContent).not.toContain('未登录工程师')
    expect(screen.container.querySelector('button')).toBeNull()
  })

  it('renders required AppShell principal and a 44px logout button', async () => {
    vi.stubEnv('VITE_APP_CONTROL_PLANE_MODE', 'required')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    useAuthStore.getState().auth.setPrincipal({
      id: 'user-1',
      username: 'op',
      display_name: '王工',
      role: 'operator',
      status: 'active',
    })

    const screen = await render(
      <AppShell>
        <p>扫描首页</p>
      </AppShell>
    )

    const logoutButton = screen.container.querySelector('button')

    await expect.element(screen.getByText('王工')).toBeVisible()
    expect(logoutButton).not.toBeNull()
    expect(logoutButton?.className).toContain('size-11')
    await expect
      .element(screen.getByRole('button', { name: '退出登录' }))
      .toBeVisible()
  })

  it('renders config error instead of children when AppShell config is invalid', async () => {
    vi.stubEnv('VITE_APP_CONTROL_PLANE_MODE', 'required')
    vi.stubEnv('VITE_API_BASE_URL', '')

    const screen = await render(
      <AppShell>
        <p>扫描首页</p>
      </AppShell>
    )

    await expect.element(screen.getByText('App 配置错误')).toBeVisible()
    await expect
      .element(screen.getByText('工程师 App 必须显式配置 VITE_API_BASE_URL。'))
      .toBeVisible()
    expect(screen.container.textContent).toContain('请检查构建时注入的 App 运行配置')
    expect(screen.container.textContent).not.toContain('缺少必需配置')
    expect(screen.container.textContent).not.toContain('扫描首页')
  })
})
