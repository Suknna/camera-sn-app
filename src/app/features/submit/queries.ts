import { useMutation } from '@tanstack/react-query'
import { mobileScanBatchesApi } from '@shared/api/mobile/scan-batches'
import type { SubmitMobileScanBatchRequest } from '@shared/types/mobile'

export function useSubmitMobileBatchMutation(batchId: string) {
  return useMutation({
    mutationFn: (request: SubmitMobileScanBatchRequest) =>
      mobileScanBatchesApi.submit(batchId, request),
    retry: false,
  })
}
