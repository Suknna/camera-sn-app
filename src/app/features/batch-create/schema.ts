import { z } from 'zod'

export const createBatchSchema = z.object({
  operatorName: z.string().trim().min(1, '请填写操作人姓名'),
  dataCenterId: z.string().min(1, '请选择数据中心'),
  roomId: z.string().min(1, '请选择机房'),
  arrivalBatchName: z.string().trim().min(1, '请填写到货批次'),
  machineConfigSummary: z.string().trim().min(1, '请填写机器配置'),
  defaultConfigNote: z
    .string()
    .trim()
    .max(1000, '默认配置备注最多 1000 字')
    .optional(),
})

export type CreateBatchFormValues = z.infer<typeof createBatchSchema>
