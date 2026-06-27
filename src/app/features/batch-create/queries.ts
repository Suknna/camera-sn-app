import { useMutation, useQuery } from '@tanstack/react-query'
import { mobileContextApi } from '@shared/api/mobile/context'
import { mobileScanBatchesApi } from '@shared/api/mobile/scan-batches'
import { appQueryKeys } from '../query-keys'

export function useMobileContextQuery() {
  return useQuery({
    queryKey: appQueryKeys.context(),
    queryFn: mobileContextApi.getContext,
    retry: false,
  })
}

export function useCreateMobileBatchMutation() {
  return useMutation({
    mutationFn: mobileScanBatchesApi.create,
    retry: false,
  })
}
