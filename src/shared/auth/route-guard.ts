import { redirect } from '@tanstack/react-router'
import { useAuthStore } from './auth-store'
import { requireRole, type Principal } from './principal'

export async function operatorGuard(): Promise<void> {
  const { auth } = useAuthStore.getState()

  if (!auth.accessToken) {
    auth.reset()
    throw redirect({ to: '/sign-in' })
  }

  try {
    await auth.fetchMe()
  } catch {
    auth.reset()
    throw redirect({ to: '/sign-in' })
  }

  const principal: Principal | null = useAuthStore.getState().auth.principal

  try {
    requireRole(principal, 'operator')
  } catch {
    throw redirect({ to: principal ? '/forbidden' : '/sign-in' })
  }
}
