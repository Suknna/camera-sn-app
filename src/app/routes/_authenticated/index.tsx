import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@app/features/home/home-page'

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
})
