export interface AppCatalogRack {
  id: string
  name: string
}

export interface AppCatalogRoom {
  id: string
  name: string
  racks: AppCatalogRack[]
}

export interface AppCatalogDataCenter {
  id: string
  name: string
  rooms: AppCatalogRoom[]
}

export interface AppCatalogSeed {
  version: string
  sourceHash: string
  dataCenters: AppCatalogDataCenter[]
}

export interface AppCatalogContext {
  version: string
  dataCenters: AppCatalogDataCenter[]
}
