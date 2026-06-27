import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@app/components/app-shell'
import { appOperatorGuard } from '@app/lib/app-route-guard'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: appOperatorGuard,
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
