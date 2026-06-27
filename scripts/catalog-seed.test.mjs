import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateCatalogSeedModule,
  parseCatalogSeedText,
} from './catalog-seed.mjs'

const VALID_YAML = `
version: " v1 "
data_centers:
  - id: " dc-1 "
    name: " 数据中心 "
    rooms:
      - id: " room-1 "
        name: " A机房 "
        racks:
          - id: " rack-1 "
            name: " A01 "
`

test('valid YAML parses and trims names and IDs', () => {
  const seed = parseCatalogSeedText(VALID_YAML)

  assert.equal(seed.version, 'v1')
  assert.equal(seed.dataCenters[0]?.id, 'dc-1')
  assert.equal(seed.dataCenters[0]?.name, '数据中心')
  assert.equal(seed.dataCenters[0]?.rooms[0]?.id, 'room-1')
  assert.equal(seed.dataCenters[0]?.rooms[0]?.name, 'A机房')
  assert.equal(seed.dataCenters[0]?.rooms[0]?.racks[0]?.id, 'rack-1')
  assert.equal(seed.dataCenters[0]?.rooms[0]?.racks[0]?.name, 'A01')
  assert.match(seed.sourceHash, /^[a-f0-9]{64}$/)
})

test('generated module contains satisfies AppCatalogSeed', () => {
  const moduleText = generateCatalogSeedModule(parseCatalogSeedText(VALID_YAML))

  assert.match(moduleText, /import type \{ AppCatalogSeed \}/)
  assert.match(moduleText, /satisfies AppCatalogSeed/)
  assert.match(moduleText, /export const catalogSeed = /)
})

test('unknown top-level key fails', () => {
  assert.throws(
    () =>
      parseCatalogSeedText('version: "v1"\nextra: true\ndata_centers: []'),
    /app\.catalog\.yaml extra is not allowed/
  )
})

test('missing version fails', () => {
  assert.throws(
    () => parseCatalogSeedText('data_centers: []'),
    /app\.catalog\.yaml version is required/
  )
})

test('empty data_centers fails', () => {
  assert.throws(
    () => parseCatalogSeedText('version: "v1"\ndata_centers: []'),
    /app\.catalog\.yaml data_centers must contain at least one item/
  )
})

test('data center without rooms fails', () => {
  assert.throws(
    () =>
      parseCatalogSeedText(`
version: "v1"
data_centers:
  - id: "dc-1"
    name: "数据中心"
    rooms: []
`),
    /app\.catalog\.yaml data_centers\[0\]\.rooms must contain at least one item/
  )
})

test('room without racks fails', () => {
  assert.throws(
    () =>
      parseCatalogSeedText(`
version: "v1"
data_centers:
  - id: "dc-1"
    name: "数据中心"
    rooms:
      - id: "room-1"
        name: "A机房"
        racks: []
`),
    /app\.catalog\.yaml data_centers\[0\]\.rooms\[0\]\.racks must contain at least one item/
  )
})

test('duplicate global ID fails', () => {
  assert.throws(
    () =>
      parseCatalogSeedText(`
version: "v1"
data_centers:
  - id: "same-id"
    name: "数据中心"
    rooms:
      - id: "same-id"
        name: "A机房"
        racks:
          - id: "rack-1"
            name: "A01"
`),
    /app\.catalog\.yaml data_centers\[0\]\.rooms\[0\]\.id duplicates id already used at data_centers\[0\]\.id/
  )
})

test('rack unknown field fails', () => {
  assert.throws(
    () =>
      parseCatalogSeedText(`
version: "v1"
data_centers:
  - id: "dc-1"
    name: "数据中心"
    rooms:
      - id: "room-1"
        name: "A机房"
        racks:
          - id: "rack-1"
            name: "A01"
            extra: true
`),
    /app\.catalog\.yaml data_centers\[0\]\.rooms\[0\]\.racks\[0\]\.extra is not allowed/
  )
})

test('error messages include the logical path', () => {
  assert.throws(
    () =>
      parseCatalogSeedText(`
version: "v1"
data_centers:
  - id: "dc-1"
    name: "数据中心"
    rooms:
      - id: "room-1"
        name: "A机房"
        racks:
          - id: ""
            name: "A01"
`),
    /app\.catalog\.yaml data_centers\[0\]\.rooms\[0\]\.racks\[0\]\.id/
  )
})
