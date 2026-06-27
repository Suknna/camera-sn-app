import { createFileRoute } from '@tanstack/react-router'
import { ScanPage } from '@app/features/scan/scan-page'

export const Route = createFileRoute('/_authenticated/scan/$batchId')({
  component: ScanRoute,
})

function ScanRoute() {
  const { batchId: localBatchId } = Route.useParams()

  return <ScanPage localBatchId={localBatchId} />
}
