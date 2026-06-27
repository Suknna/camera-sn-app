import { describe, expect, it } from 'vitest'
import { getStandaloneCatalog } from './catalog-provider'

describe('getStandaloneCatalog', () => {
  it('returns a non-empty standalone catalog copy', () => {
    const catalog = getStandaloneCatalog()

    expect(catalog.version).toBeTruthy()
    expect(catalog.dataCenters.length).toBeGreaterThan(0)
    expect(catalog.dataCenters[0]?.rooms.length).toBeGreaterThan(0)
    expect(catalog.dataCenters[0]?.rooms[0]?.racks.length).toBeGreaterThan(0)
  })

  it('does not expose the generated seed by mutable reference', () => {
    const first = getStandaloneCatalog()
    const originalName = first.dataCenters[0]!.name
    first.dataCenters[0]!.name = 'mutated'

    expect(getStandaloneCatalog().dataCenters[0]!.name).toBe(originalName)
  })
})
