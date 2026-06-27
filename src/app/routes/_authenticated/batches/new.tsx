import { createFileRoute } from '@tanstack/react-router'
import { BatchCreatePage } from '@app/features/batch-create/batch-create-page'

export const Route = createFileRoute('/_authenticated/batches/new')({
  component: BatchCreatePage,
})
