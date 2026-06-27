import { resolveAPIBaseURL } from '@shared/api/base-url'

export type ControlPlaneMode = 'standalone' | 'required'

export type AppRuntimeConfig =
  | { controlPlaneMode: 'standalone' }
  | {
      controlPlaneMode: 'required'
      apiBaseURL: string
    }

export interface AppRuntimeEnv {
  VITE_APP_CONTROL_PLANE_MODE?: string
  VITE_API_BASE_URL?: string
  DEV?: boolean
}

export type AppRuntimeConfigResult =
  | { ok: true; config: AppRuntimeConfig }
  | { ok: false; message: string }

export function resolveAppRuntimeConfig(
  env: AppRuntimeEnv = import.meta.env
): AppRuntimeConfigResult {
  const controlPlaneMode = env.VITE_APP_CONTROL_PLANE_MODE
  if (controlPlaneMode === undefined || controlPlaneMode === '') {
    return {
      ok: false,
      message:
        '工程师 App 必须显式配置 VITE_APP_CONTROL_PLANE_MODE 为 standalone 或 required。',
    }
  }

  if (controlPlaneMode !== 'standalone' && controlPlaneMode !== 'required') {
    return {
      ok: false,
      message: 'VITE_APP_CONTROL_PLANE_MODE 只允许 standalone 或 required。',
    }
  }

  if (controlPlaneMode === 'standalone') {
    if (env.VITE_API_BASE_URL !== undefined) {
      return {
        ok: false,
        message:
          'Standalone 工程师 App 禁止配置 VITE_API_BASE_URL；如需连接控制平面，请使用 VITE_APP_CONTROL_PLANE_MODE=required。',
      }
    }

    return { ok: true, config: { controlPlaneMode } }
  }

  const result = resolveAPIBaseURL(env)
  if (!result.ok) {
    return { ok: false, message: result.message }
  }

  return {
    ok: true,
    config: {
      controlPlaneMode,
      apiBaseURL: result.baseURL,
    },
  }
}

export function isStandaloneRuntime(
  config: AppRuntimeConfig
): config is Extract<AppRuntimeConfig, { controlPlaneMode: 'standalone' }> {
  return config.controlPlaneMode === 'standalone'
}
