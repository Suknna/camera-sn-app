import { catalogSeed } from '@app/generated/catalog-seed'
import type { AppCatalogContext } from './types'

export function getStandaloneCatalog(): AppCatalogContext {
  return {
    version: catalogSeed.version,
    dataCenters: catalogSeed.dataCenters.map((dataCenter) => ({
      ...dataCenter,
      rooms: dataCenter.rooms.map((room) => ({
        ...room,
        racks: room.racks.map((rack) => ({ ...rack })),
      })),
    })),
  }
}
