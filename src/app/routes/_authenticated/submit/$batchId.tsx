import { createFileRoute } from '@tanstack/react-router'
import { SubmitPage } from '@app/features/submit/submit-page'

export const Route = createFileRoute('/_authenticated/submit/$batchId')({
  component: SubmitRoute,
})

function SubmitRoute() {
  const { batchId } = Route.useParams()

  return <SubmitPage batchId={batchId} />
}
