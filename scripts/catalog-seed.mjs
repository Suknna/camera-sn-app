import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_INPUT = path.resolve(__dirname, '../catalog/app.catalog.yaml')
const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  '../src/app/generated/catalog-seed.ts'
)

const TOP_LEVEL_KEYS = ['version', 'data_centers']
const DATA_CENTER_KEYS = ['id', 'name', 'rooms']
const ROOM_KEYS = ['id', 'name', 'racks']
const RACK_KEYS = ['id', 'name']

export function parseCatalogSeedText(text, sourceName = 'app.catalog.yaml') {
  const document = parseDocument(text)
  if (document.errors.length > 0) {
    const message = document.errors.map((error) => error.message).join('; ')
    throw new Error(`${sourceName} syntax error: ${message}`)
  }

  const sourceHash = createHash('sha256').update(text).digest('hex')
  return normalizeCatalogSeedObject(document.toJS(), sourceName, sourceHash)
}

export function validateCatalogSeedObject(value, sourceName = 'app.catalog.yaml') {
  const sourceHash = createHash('sha256')
    .update(JSON.stringify(value) ?? '')
    .digest('hex')
  return normalizeCatalogSeedObject(value, sourceName, sourceHash)
}

export function generateCatalogSeedModule(seed) {
  return [
    "import type { AppCatalogSeed } from '@app/lib/catalog/types'",
    '',
    `export const catalogSeed = ${JSON.stringify(seed, null, 2)} as const satisfies AppCatalogSeed`,
    '',
  ].join('\n')
}

export function generateCatalogSeedFile({ inputPath, outputPath }) {
  const text = fs.readFileSync(inputPath, 'utf8')
  const seed = parseCatalogSeedText(text, inputPath)
  const moduleText = generateCatalogSeedModule(seed)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, moduleText, 'utf8')

  const relativeOutput = path
    .relative(path.resolve(__dirname, '..'), outputPath)
    .split(path.sep)
    .join('/')
  console.log(`Generated app catalog seed: ${relativeOutput}`)
}

function normalizeCatalogSeedObject(value, sourceName, sourceHash) {
  const root = expectRecord(value, sourceName, '')
  expectExactKeys(root, TOP_LEVEL_KEYS, sourceName, '')

  const version = expectNonEmptyString(root.version, sourceName, 'version')
  const dataCentersInput = expectNonEmptyArray(
    root.data_centers,
    sourceName,
    'data_centers'
  )
  const seenIDs = new Map()

  const dataCenters = dataCentersInput.map((dataCenter, dataCenterIndex) => {
    const dataCenterPath = `data_centers[${dataCenterIndex}]`
    const record = expectRecord(dataCenter, sourceName, dataCenterPath)
    expectExactKeys(record, DATA_CENTER_KEYS, sourceName, dataCenterPath)

    const id = expectNonEmptyString(record.id, sourceName, `${dataCenterPath}.id`)
    assertUniqueID(id, sourceName, `${dataCenterPath}.id`, seenIDs)

    const roomsInput = expectNonEmptyArray(
      record.rooms,
      sourceName,
      `${dataCenterPath}.rooms`
    )

    return {
      id,
      name: expectNonEmptyString(
        record.name,
        sourceName,
        `${dataCenterPath}.name`
      ),
      rooms: roomsInput.map((room, roomIndex) => {
        const roomPath = `${dataCenterPath}.rooms[${roomIndex}]`
        const roomRecord = expectRecord(room, sourceName, roomPath)
        expectExactKeys(roomRecord, ROOM_KEYS, sourceName, roomPath)

        const roomID = expectNonEmptyString(
          roomRecord.id,
          sourceName,
          `${roomPath}.id`
        )
        assertUniqueID(roomID, sourceName, `${roomPath}.id`, seenIDs)

        const racksInput = expectNonEmptyArray(
          roomRecord.racks,
          sourceName,
          `${roomPath}.racks`
        )

        return {
          id: roomID,
          name: expectNonEmptyString(
            roomRecord.name,
            sourceName,
            `${roomPath}.name`
          ),
          racks: racksInput.map((rack, rackIndex) => {
            const rackPath = `${roomPath}.racks[${rackIndex}]`
            const rackRecord = expectRecord(rack, sourceName, rackPath)
            expectExactKeys(rackRecord, RACK_KEYS, sourceName, rackPath)

            const rackID = expectNonEmptyString(
              rackRecord.id,
              sourceName,
              `${rackPath}.id`
            )
            assertUniqueID(rackID, sourceName, `${rackPath}.id`, seenIDs)

            return {
              id: rackID,
              name: expectNonEmptyString(
                rackRecord.name,
                sourceName,
                `${rackPath}.name`
              ),
            }
          }),
        }
      }),
    }
  })

  return { version, sourceHash, dataCenters }
}

function expectRecord(value, sourceName, logicalPath) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw pathError(sourceName, logicalPath, 'must be an object')
  }
  return value
}

function expectExactKeys(record, expectedKeys, sourceName, logicalPath) {
  const allowedKeys = new Set(expectedKeys)
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw pathError(sourceName, joinPath(logicalPath, key), 'is not allowed')
    }
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(record, key)) {
      throw pathError(sourceName, joinPath(logicalPath, key), 'is required')
    }
  }
}

function expectNonEmptyString(value, sourceName, logicalPath) {
  if (typeof value !== 'string') {
    throw pathError(sourceName, logicalPath, 'must be a string')
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw pathError(sourceName, logicalPath, 'must be a non-empty string')
  }

  return trimmed
}

function expectNonEmptyArray(value, sourceName, logicalPath) {
  if (!Array.isArray(value)) {
    throw pathError(sourceName, logicalPath, 'must be an array')
  }

  if (value.length === 0) {
    throw pathError(sourceName, logicalPath, 'must contain at least one item')
  }

  return value
}

function assertUniqueID(id, sourceName, logicalPath, seenIDs) {
  const existingPath = seenIDs.get(id)
  if (existingPath !== undefined) {
    throw pathError(
      sourceName,
      logicalPath,
      `duplicates id already used at ${existingPath}`
    )
  }

  seenIDs.set(id, logicalPath)
}

function pathError(sourceName, logicalPath, message) {
  const prefix = logicalPath ? `${sourceName} ${logicalPath}` : sourceName
  return new Error(`${prefix} ${message}.`)
}

function joinPath(parentPath, key) {
  return parentPath ? `${parentPath}.${key}` : key
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    generateCatalogSeedFile({ inputPath: DEFAULT_INPUT, outputPath: DEFAULT_OUTPUT })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  }
}
