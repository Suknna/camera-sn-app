import { describe, expect, it } from 'vitest'
import { scanItemInputSchema } from './schema'

describe('scanItemInputSchema', () => {
  it('keeps rawValue unchanged and converts empty U position to null', () => {
    const parsed = scanItemInputSchema.parse({
      rawValue: '  SN-001  ',
      barcodeFormat: ' CODE_128 ',
      rackId: ' rack-1 ',
      uPosition: '',
    })

    expect(parsed).toEqual({
      rawValue: '  SN-001  ',
      barcodeFormat: 'CODE_128',
      rackId: 'rack-1',
      uPosition: null,
    })
  })

  it('accepts integer U positions from 1 to 60', () => {
    expect(
      scanItemInputSchema.parse({
        rawValue: 'SN-001',
        barcodeFormat: 'manual',
        rackId: 'rack-1',
        uPosition: '1',
      }).uPosition
    ).toBe(1)
    expect(
      scanItemInputSchema.parse({
        rawValue: 'SN-060',
        barcodeFormat: 'manual',
        rackId: 'rack-1',
        uPosition: '60',
      }).uPosition
    ).toBe(60)
  })

  it('rejects blank SN, missing rack, and out-of-range U positions', () => {
    expect(
      scanItemInputSchema.safeParse({
        rawValue: '   ',
        barcodeFormat: 'manual',
        rackId: 'rack-1',
        uPosition: '',
      }).success
    ).toBe(false)
    expect(
      scanItemInputSchema.safeParse({
        rawValue: 'SN-001',
        barcodeFormat: 'manual',
        rackId: '',
        uPosition: '',
      }).success
    ).toBe(false)
    expect(
      scanItemInputSchema.safeParse({
        rawValue: 'SN-001',
        barcodeFormat: 'manual',
        rackId: 'rack-1',
        uPosition: '0',
      }).success
    ).toBe(false)
    expect(
      scanItemInputSchema.safeParse({
        rawValue: 'SN-001',
        barcodeFormat: 'manual',
        rackId: 'rack-1',
        uPosition: '61',
      }).success
    ).toBe(false)
  })
})
