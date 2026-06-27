export const ErrorCode = {
  // auth / permission
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  USER_DISABLED: 'USER_DISABLED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // validation / business
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // infra
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface APIErrorBody {
  code: ErrorCode | string
  message: string
  request_id: string
  details?: Record<string, unknown>
}

export class APIError extends Error {
  public readonly code: ErrorCode | string
  public readonly status: number
  public readonly requestId: string
  public readonly details?: Record<string, unknown>

  constructor(body: APIErrorBody, status: number) {
    super(body.message)
    this.name = 'APIError'
    this.code = body.code
    this.status = status
    this.requestId = body.request_id
    this.details = body.details
  }
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError
}
