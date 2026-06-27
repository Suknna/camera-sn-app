import { redirect } from '@tanstack/react-router'
import { operatorGuard } from '@shared/auth/route-guard'
import {
  isStandaloneRuntime,
  resolveAppRuntimeConfig,
  type AppRuntimeConfigResult,
} from './runtime-config'

export function createAppOperatorGuard(
  resolveConfig: () => AppRuntimeConfigResult = resolveAppRuntimeConfig,
  guard: () => Promise<void> = operatorGuard
) {
  return async function appOperatorGuard(): Promise<void> {
    const runtimeConfig = resolveConfig()
    if (!runtimeConfig.ok) {
      throw redirect({ to: '/sign-in' })
    }

    if (isStandaloneRuntime(runtimeConfig.config)) {
      return
    }

    await guard()
  }
}

export const appOperatorGuard = createAppOperatorGuard()
