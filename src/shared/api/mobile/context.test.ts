import type { AxiosAdapter } from 'axios'
import type { MobileContextDTO } from '@shared/types/mobile'
import { describe, expect, it } from 'vitest'
import { createAPIClient } from '../client'
import { createMobileContextApi } from './context'

const testAPIBaseURL = {
  ok: true,
  baseURL: 'https://api.example.com',
} as const

interface CapturedRequest {
  url?: string
  method?: string
  data?: unknown
}

function captureRequests(
  requests: CapturedRequest[],
  response: MobileContextDTO
): AxiosAdapter {
  return async (config) => {
    requests.push({
      url: config.url,
      method: config.method,
      data: parseData(config.data),
    })

    return {
      data: response,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
}

function parseData(data: unknown): unknown {
  if (typeof data === 'string' && data !== '') return JSON.parse(data)
  return data
}

describe('mobile context api', () => {
  it('gets mobile context from the mobile context endpoint', async () => {
    const requests: CapturedRequest[] = []
    const context = {
      data_centers: [
        {
          id: 'dc-1',
          code: 'DC1',
          name: 'Data Center 1',
          rooms: [
            {
              id: 'room-1',
              code: 'R1',
              name: 'Room 1',
              racks: [{ id: 'rack-1', code: 'A01', name: 'Rack A01' }],
            },
          ],
        },
      ],
      machine_profiles: [{ id: 'profile-1', name: '2U Standard' }],
    } satisfies MobileContextDTO
    const client = createAPIClient({
      apiBaseURL: testAPIBaseURL,
      adapter: captureRequests(requests, context),
    })
    const contextApi = createMobileContextApi(client)

    const result = await contextApi.getContext()

    expect(result).toEqual(context)
    expect(requests).toEqual([
      {
        url: '/mobile/context',
        method: 'get',
        data: undefined,
      },
    ])
  })
})
