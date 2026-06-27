import { isRedirect, redirect } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import { createAppOperatorGuard } from './app-route-guard'
import { isStandaloneRuntime, resolveAppRuntimeConfig } from './runtime-config'

const requiredModeEnv = { VITE_APP_CONTROL_PLANE_MODE: 'required' }

const requiredRuntimeConfig = {
  ok: true,
  config: {
    controlPlaneMode: 'required',
    apiBaseURL: 'https://api.example.com',
  },
} as const

describe('resolveAppRuntimeConfig', () => {
  it('fails when VITE_APP_CONTROL_PLANE_MODE is missing', () => {
    expect(resolveAppRuntimeConfig({})).toEqual({
      ok: false,
      message:
        '工程师 App 必须显式配置 VITE_APP_CONTROL_PLANE_MODE 为 standalone 或 required。',
    })
  })

  it('fails when VITE_APP_CONTROL_PLANE_MODE is unknown', () => {
    expect(
      resolveAppRuntimeConfig({ VITE_APP_CONTROL_PLANE_MODE: 'enterprise' })
    ).toEqual({
      ok: false,
      message: 'VITE_APP_CONTROL_PLANE_MODE 只允许 standalone 或 required。',
    })
  })

  it('resolves standalone mode without API configuration', () => {
    const result = resolveAppRuntimeConfig({
      VITE_APP_CONTROL_PLANE_MODE: 'standalone',
    })

    expect(result).toEqual({
      ok: true,
      config: { controlPlaneMode: 'standalone' },
    })
    if (result.ok) {
      expect(isStandaloneRuntime(result.config)).toBe(true)
      expect('apiBaseURL' in result.config).toBe(false)
    }
  })

  it('fails when standalone mode includes VITE_API_BASE_URL', () => {
    expect(
      resolveAppRuntimeConfig({
        VITE_APP_CONTROL_PLANE_MODE: 'standalone',
        VITE_API_BASE_URL: 'https://api.example.com',
      })
    ).toEqual({
      ok: false,
      message:
        'Standalone 工程师 App 禁止配置 VITE_API_BASE_URL；如需连接控制平面，请使用 VITE_APP_CONTROL_PLANE_MODE=required。',
    })
  })

  it('fails in required mode when VITE_API_BASE_URL is missing', () => {
    expect(resolveAppRuntimeConfig(requiredModeEnv)).toEqual({
      ok: false,
      message: '工程师 App 必须显式配置 VITE_API_BASE_URL。',
    })
  })

  it('fails in required mode when VITE_API_BASE_URL is not a valid URL', () => {
    expect(
      resolveAppRuntimeConfig({
        ...requiredModeEnv,
        VITE_API_BASE_URL: 'not a url',
      })
    ).toEqual({
      ok: false,
      message: 'VITE_API_BASE_URL 必须是有效的 http(s) URL。',
    })
  })

  it('fails in required mode when VITE_API_BASE_URL uses ftp', () => {
    expect(
      resolveAppRuntimeConfig({
        ...requiredModeEnv,
        VITE_API_BASE_URL: 'ftp://api',
      })
    ).toEqual({
      ok: false,
      message: 'VITE_API_BASE_URL 只允许 http 或 https。',
    })
  })

  it('fails in required mode for production HTTP API URLs', () => {
    expect(
      resolveAppRuntimeConfig({
        ...requiredModeEnv,
        VITE_API_BASE_URL: 'http://api.example.com',
      })
    ).toEqual({
      ok: false,
      message: '生产工程师 App 必须使用 HTTPS API。',
    })
  })

  it('passes in required mode for HTTP API URLs while running the development server', () => {
    expect(
      resolveAppRuntimeConfig({
        ...requiredModeEnv,
        VITE_API_BASE_URL: 'http://api.example.com',
        DEV: true,
      })
    ).toEqual({
      ok: true,
      config: {
        controlPlaneMode: 'required',
        apiBaseURL: 'http://api.example.com',
      },
    })
  })

  it('passes in required mode for https', () => {
    expect(
      resolveAppRuntimeConfig({
        ...requiredModeEnv,
        VITE_API_BASE_URL: 'https://api.example.com',
      })
    ).toEqual(requiredRuntimeConfig)
  })
})

describe('appOperatorGuard', () => {
  it('redirects to sign-in without calling operatorGuard when runtime config is invalid', async () => {
    const operatorGuard = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined)
    const appOperatorGuard = createAppOperatorGuard(
      () => ({ ok: false, message: 'invalid config' }),
      operatorGuard
    )

    try {
      await appOperatorGuard()
      throw new Error('expected redirect')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      expect(error).toMatchObject({ options: { to: '/sign-in' } })
    }
    expect(operatorGuard).not.toHaveBeenCalled()
  })

  it('allows standalone runtime without calling operatorGuard', async () => {
    const operatorGuard = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined)
    const appOperatorGuard = createAppOperatorGuard(
      () => ({ ok: true, config: { controlPlaneMode: 'standalone' } }),
      operatorGuard
    )

    await expect(appOperatorGuard()).resolves.toBeUndefined()

    expect(operatorGuard).not.toHaveBeenCalled()
  })

  it('delegates to operatorGuard in required runtime', async () => {
    const operatorGuard = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined)
    const appOperatorGuard = createAppOperatorGuard(
      () => requiredRuntimeConfig,
      operatorGuard
    )

    await expect(appOperatorGuard()).resolves.toBeUndefined()

    expect(operatorGuard).toHaveBeenCalledOnce()
  })

  it('preserves operatorGuard auth redirects in required runtime', async () => {
    const authRedirect = redirect({ to: '/sign-in' })
    const operatorGuard = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(authRedirect)
    const appOperatorGuard = createAppOperatorGuard(
      () => requiredRuntimeConfig,
      operatorGuard
    )

    try {
      await appOperatorGuard()
      throw new Error('expected redirect')
    } catch (error) {
      expect(error).toBe(authRedirect)
      expect(isRedirect(error)).toBe(true)
      expect(error).toMatchObject({ options: { to: '/sign-in' } })
    }
    expect(operatorGuard).toHaveBeenCalledOnce()
  })
})
