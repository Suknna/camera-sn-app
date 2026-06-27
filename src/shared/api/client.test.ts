import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { APIConfigurationError, type APIBaseURLResult } from './base-url'
import { createAPIClient } from './client'
import { APIError, ErrorCode } from './errors'

const validAPIBaseURL: APIBaseURLResult = {
  ok: true,
  baseURL: 'https://api.example.com',
}

function readAuthorization(config: InternalAxiosRequestConfig): string {
  const authorization = config.headers.get('Authorization')
  return typeof authorization === 'string' ? authorization : ''
}

describe('api client', () => {
  it('maps a 401 backend error body to APIError', async () => {
    const adapter: AxiosAdapter = async (config) => {
      return Promise.reject({
        config,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
          data: {
            error: {
              code: ErrorCode.UNAUTHORIZED,
              message: 'authorization header is required',
              request_id: 'req-1',
            },
          },
        },
        isAxiosError: true,
      })
    }

    const client = createAPIClient({ adapter, apiBaseURL: validAPIBaseURL })

    try {
      await client.get('/auth/me')
      throw new Error('expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      const apiError = error as APIError
      expect(apiError.code).toBe(ErrorCode.UNAUTHORIZED)
      expect(apiError.status).toBe(401)
      expect(apiError.requestId).toBe('req-1')
    }
  })

  it('maps backend error fields to APIError fields', async () => {
    const adapter: AxiosAdapter = async (config) => {
      return Promise.reject({
        config,
        response: {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config,
          data: {
            error: {
              code: ErrorCode.INVALID_ARGUMENT,
              message: 'bad',
              request_id: 'r1',
              details: { field: 'username' },
            },
          },
        },
        isAxiosError: true,
      })
    }

    const client = createAPIClient({ adapter, apiBaseURL: validAPIBaseURL })

    try {
      await client.get('/auth/me')
      throw new Error('expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      const apiError = error as APIError
      expect(apiError.code).toBe(ErrorCode.INVALID_ARGUMENT)
      expect(apiError.message).toBe('bad')
      expect(apiError.requestId).toBe('r1')
      expect(apiError.details).toEqual({ field: 'username' })
    }
  })

  it('injects bearer token only when token provider returns a token', async () => {
    let authorizationWithoutToken = 'unset'
    const adapterWithoutToken: AxiosAdapter = async (config) => {
      authorizationWithoutToken = readAuthorization(config)
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }

    const clientWithoutToken = createAPIClient({
      accessTokenProvider: () => '',
      apiBaseURL: validAPIBaseURL,
      adapter: adapterWithoutToken,
    })

    await clientWithoutToken.get('/auth/me')

    expect(authorizationWithoutToken).toBe('')

    let authorizationWithToken = ''
    const adapterWithToken: AxiosAdapter = async (config) => {
      authorizationWithToken = readAuthorization(config)
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }

    const clientWithToken = createAPIClient({
      accessTokenProvider: () => 'token-1',
      apiBaseURL: validAPIBaseURL,
      adapter: adapterWithToken,
    })

    await clientWithToken.get('/auth/me')

    expect(authorizationWithToken).toBe('Bearer token-1')
  })

  it('rejects invalid API config before token injection and adapter execution', async () => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    const accessTokenProvider = vi.fn(() => 'token-1')
    const client = createAPIClient({
      accessTokenProvider,
      adapter,
      apiBaseURL: {
        ok: false,
        message: '工程师 App 必须显式配置 VITE_API_BASE_URL。',
      },
    })

    await expect(client.get('/auth/me')).rejects.toBeInstanceOf(
      APIConfigurationError
    )
    expect(adapter).not.toHaveBeenCalled()
    expect(accessTokenProvider).not.toHaveBeenCalled()
  })
})
