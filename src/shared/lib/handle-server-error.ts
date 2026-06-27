import { toast } from 'sonner'
import { isAPIError } from '../api/errors'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(error)
  }

  if (isAPIError(error)) {
    toast.error(error.message)
    return
  }

  if (error instanceof Error) {
    toast.error(error.message)
    return
  }

  toast.error('Something went wrong!')
}
