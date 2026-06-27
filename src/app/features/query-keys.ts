export const appQueryKeys = {
  root: ['app'] as const,
  mobile: () => [...appQueryKeys.root, 'mobile'] as const,
  context: () => [...appQueryKeys.mobile(), 'context'] as const,
  batch: (batchId: string) =>
    [...appQueryKeys.mobile(), 'scan-batches', batchId] as const,
}
