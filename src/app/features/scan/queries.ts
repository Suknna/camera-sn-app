import { useMutation, useQuery } from '@tanstack/react-query'
import { mobileScanBatchesApi } from '@shared/api/mobile/scan-batches'
import { appQueryKeys } from '../query-keys'

export function useMobileBatchQuery(batchId: string) {
  return useQuery({
    queryKey: appQueryKeys.batch(batchId),
    queryFn: () => mobileScanBatchesApi.get(batchId),
    retry: false,
  })
}

export function useCancelMobileBatchMutation() {
  return useMutation({ mutationFn: mobileScanBatchesApi.cancel, retry: false })
}
