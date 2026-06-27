import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setHapticsForTest, playScanSuccessFeedback } from './scan-feedback'

afterEach(() => {
  __setHapticsForTest(async () => {})
})

describe('playScanSuccessFeedback', () => {
  it('fires haptics', async () => {
    const haptics = vi.fn(async () => {})
    __setHapticsForTest(haptics)
    await playScanSuccessFeedback()
    expect(haptics).toHaveBeenCalledTimes(1)
  })

  it('swallows haptics errors', async () => {
    __setHapticsForTest(async () => {
      throw new Error('no haptics')
    })
    await expect(playScanSuccessFeedback()).resolves.toBeUndefined()
  })
})
