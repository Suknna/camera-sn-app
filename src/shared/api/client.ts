import axios, {
  type AxiosAdapter,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { getAccessToken } from '../auth/token-storage'
import type { APIErrorResponse } from '../types/api'
import {
  APIConfigurationError,
  resolveAPIBaseURL,
  type APIBaseURLResult,
} from './base-url'
import { APIError, type APIErrorBody, ErrorCode } from './errors'

const resolvedAPIBaseURL = resolveAPIBaseURL()

export const API_BASE_URL = resolvedAPIBaseURL.ok
  ? resolvedAPIBaseURL.baseURL
  : ''

interface APIClientOptions {
  accessTokenProvider?: () => string
  apiBaseURL?: APIBaseURLResult
  adapter?: AxiosAdapter
}

export function createAPIClient(options: APIClientOptions = {}): AxiosInstance {
  const accessTokenProvider = options.accessTokenProvider ?? getAccessToken
  const apiBaseURL = options.apiBaseURL ?? resolvedAPIBaseURL
  const client = axios.create({
    baseURL: apiBaseURL.ok ? `${apiBaseURL.baseURL}/api/v1` : undefined,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
    adapter: options.adapter,
  })

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (!apiBaseURL.ok) {
      throw new APIConfigurationError(apiBaseURL.message)
    }

    const token = accessTokenProvider()
    if (token && !config.headers.get('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<APIErrorResponse | unknown> | APIConfigurationError) => {
      if (error instanceof APIConfigurationError) {
        throw error
      }

      const response = error.response
      if (response?.data && isErrorResponse(response.data)) {
        throw new APIError(response.data.error, response.status)
      }
      const fallback: APIErrorBody = {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message || 'network error',
        request_id: '',
      }
      throw new APIError(fallback, response?.status ?? 0)
    }
  )

  return client
}

function isErrorResponse(data: unknown): data is APIErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as Record<string, unknown>).error === 'object' &&
    (data as Record<string, unknown>).error !== null &&
    'code' in
      ((data as Record<string, unknown>).error as Record<string, unknown>)
  )
}

export const api = createAPIClient()
