import { z } from 'zod'

export const scanItemInputSchema = z.object({
  rawValue: z
    .string()
    .refine((value) => value.trim().length > 0, 'SN 不能为空'),
  barcodeFormat: z.string().trim().min(1, '条码格式不能为空'),
  rackId: z.string().trim().min(1, '请选择机柜'),
  uPosition: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(60)])
    .transform((value) => (value === '' ? null : value)),
})

export type ScanItemInput = z.infer<typeof scanItemInputSchema>
