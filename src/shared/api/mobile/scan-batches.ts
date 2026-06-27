import type { AxiosInstance } from 'axios'
import { api } from '@shared/api/client'
import type {
  CreateMobileScanBatchRequest,
  MobileScanBatchDTO,
  SubmitMobileScanBatchRequest,
  SubmitMobileScanBatchResult,
} from '@shared/types/mobile'

export function createMobileScanBatchesApi(client: AxiosInstance = api) {
  return {
    async create(
      request: CreateMobileScanBatchRequest
    ): Promise<MobileScanBatchDTO> {
      const { data } = await client.post<MobileScanBatchDTO>(
        '/mobile/scan-batches',
        request
      )
      return data
    },

    async get(batchId: string): Promise<MobileScanBatchDTO> {
      const { data } = await client.get<MobileScanBatchDTO>(
        `/mobile/scan-batches/${batchId}`
      )
      return data
    },

    async submit(
      batchId: string,
      request: SubmitMobileScanBatchRequest
    ): Promise<SubmitMobileScanBatchResult> {
      const { data } = await client.post<SubmitMobileScanBatchResult>(
        `/mobile/scan-batches/${batchId}/submit`,
        request
      )
      return data
    },

    async cancel(batchId: string): Promise<MobileScanBatchDTO> {
      const { data } = await client.post<MobileScanBatchDTO>(
        `/mobile/scan-batches/${batchId}/cancel`
      )
      return data
    },
  }
}

export const mobileScanBatchesApi = createMobileScanBatchesApi()
