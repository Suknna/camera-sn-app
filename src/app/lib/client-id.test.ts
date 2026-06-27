import { describe, expect, it } from 'vitest'
import { createClientID } from './client-id'

describe('createClientID', () => {
  it('prefixes generated UUIDs with the requested client ID type', () => {
    expect(createClientID('batch', () => 'uuid')).toBe('batch_uuid')
  })
})
