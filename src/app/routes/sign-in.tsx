import { createFileRoute } from '@tanstack/react-router'
import { AppSignIn } from '@app/features/sign-in/app-sign-in'
import { resolveAppRuntimeConfig } from '@app/lib/runtime-config'

export const Route = createFileRoute('/sign-in')({
  component: () => {
    const runtimeConfig = resolveAppRuntimeConfig()

    return <AppSignIn runtimeConfig={runtimeConfig} />
  },
})
