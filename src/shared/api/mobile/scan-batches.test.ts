import type { AxiosAdapter } from 'axios'
import type {
  MobileScanBatchDTO,
  SubmitMobileScanBatchResult,
} from '@shared/types/mobile'
import { describe, expect, it } from 'vitest'
import { createAPIClient } from '../client'
import { createMobileScanBatchesApi } from './scan-batches'

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
  responses: unknown[] = []
): AxiosAdapter {
  let responseIndex = 0

  return async (config) => {
    requests.push({
      url: config.url,
      method: config.method,
      data: parseData(config.data),
    })

    return {
      data: responses[responseIndex++] ?? {},
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

describe('mobile scan batches api', () => {
  it('maps mobile scan batch endpoints and preserves request payloads', async () => {
    const requests: CapturedRequest[] = []
    const draftBatch = {
      id: 'batch-1',
      batch_no: 'BATCH-001',
      client_batch_id: 'client-batch-1',
      data_center_id: 'dc-1',
      room_id: 'room-1',
      machine_profile_id: 'profile-1',
      status: 'draft',
      remark: 'arrival scan',
      submitted_at: null,
    } satisfies MobileScanBatchDTO
    const submitResult = {
      batch_id: 'batch-1',
      status: 'submitted',
      accepted_count: 0,
      conflict_count: 1,
      items: [
        {
          client_item_id: 'client-item-1',
          scan_item_id: 'scan-item-1',
          serial_number: 'SN-001',
          status: 'conflict',
          conflict_reason: 'SN_ALREADY_EXISTS',
        },
      ],
    } satisfies SubmitMobileScanBatchResult
    const client = createAPIClient({
      apiBaseURL: testAPIBaseURL,
      adapter: captureRequests(requests, [
        draftBatch,
        draftBatch,
        submitResult,
      ]),
    })
    const scanBatchesApi = createMobileScanBatchesApi(client)

    const created = await scanBatchesApi.create({
      client_batch_id: 'client-batch-1',
      data_center_id: 'dc-1',
      room_id: 'room-1',
      machine_profile_id: 'profile-1',
      remark: 'arrival scan',
    })
    await scanBatchesApi.get('batch-1')
    const submitted = await scanBatchesApi.submit('batch-1', {
      client_batch_id: 'client-batch-1',
      items: [
        {
          client_item_id: 'client-item-1',
          serial_number: 'SN-001',
          barcode_format: 'CODE_128',
          raw_value: '  SN-001  ',
          rack_id: 'rack-1',
          u_position: null,
        },
      ],
    })
    await scanBatchesApi.cancel('batch-1')

    expect(created).toEqual(draftBatch)
    expect(submitted).toEqual(submitResult)
    expect(requests).toEqual([
      {
        url: '/mobile/scan-batches',
        method: 'post',
        data: {
          client_batch_id: 'client-batch-1',
          data_center_id: 'dc-1',
          room_id: 'room-1',
          machine_profile_id: 'profile-1',
          remark: 'arrival scan',
        },
      },
      {
        url: '/mobile/scan-batches/batch-1',
        method: 'get',
        data: undefined,
      },
      {
        url: '/mobile/scan-batches/batch-1/submit',
        method: 'post',
        data: {
          client_batch_id: 'client-batch-1',
          items: [
            {
              client_item_id: 'client-item-1',
              serial_number: 'SN-001',
              barcode_format: 'CODE_128',
              raw_value: '  SN-001  ',
              rack_id: 'rack-1',
              u_position: null,
            },
          ],
        },
      },
      {
        url: '/mobile/scan-batches/batch-1/cancel',
        method: 'post',
        data: undefined,
      },
    ])
  })
})
