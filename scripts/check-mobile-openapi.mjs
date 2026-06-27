#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import YAML from 'yaml'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const allowedPaths = new Set([
  '/auth/login',
  '/auth/me',
  '/auth/logout',
  '/auth/change-password',
  '/mobile/context',
  '/mobile/scan-batches',
  '/mobile/scan-batches/{id}',
  '/mobile/scan-batches/{id}/submit',
  '/mobile/scan-batches/{id}/cancel',
])

const forbiddenPathPrefixes = ['/bootstrap', '/admin', '/audit', '/inventory']
const requiredSchemas = [
  'LoginRequest',
  'LoginResponse',
  'User',
  'ChangePasswordRequest',
  'MobileContextResponse',
  'DataCenter',
  'Room',
  'Rack',
  'MachineConfiguration',
  'CreateMobileScanBatchRequest',
  'MobileScanBatch',
  'SubmitMobileScanBatchRequest',
  'SubmitMobileScanBatchResponse',
  'SubmitScanItem',
  'SubmitScanItemResult',
  'APIErrorResponse',
]
const httpMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

function fail(message) {
  console.error(`mobile OpenAPI check failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const openAPIPath = path.join(repoRoot, 'api/mobile/openapi.yaml')
const document = YAML.parse(readFileSync(openAPIPath, 'utf8'))

assert(document && typeof document === 'object', 'document must be an object')
assert(document.openapi === '3.1.2', 'openapi must be 3.1.2')
assert(
  Array.isArray(document.servers) && document.servers[0]?.url === '/api/v1',
  'servers[0].url must be /api/v1'
)

const paths = document.paths
assert(paths && typeof paths === 'object', 'paths object is required')
const actualPaths = Object.keys(paths).sort()
const expectedPaths = [...allowedPaths].sort()
assert(
  JSON.stringify(actualPaths) === JSON.stringify(expectedPaths),
  `path set mismatch; expected ${expectedPaths.join(', ')}, got ${actualPaths.join(', ')}`
)

for (const pathName of actualPaths) {
  for (const prefix of forbiddenPathPrefixes) {
    assert(
      pathName !== prefix && !pathName.startsWith(`${prefix}/`),
      `unexpected OpenAPI path with forbidden prefix: ${pathName}`
    )
  }
}

const securitySchemes = document.components?.securitySchemes
assert(securitySchemes?.bearerAuth, 'bearerAuth security scheme is required')
assert(securitySchemes.bearerAuth.type === 'http', 'bearerAuth.type must be http')
assert(securitySchemes.bearerAuth.scheme === 'bearer', 'bearerAuth.scheme must be bearer')

const schemas = document.components?.schemas
assert(schemas && typeof schemas === 'object', 'components.schemas is required')
for (const schemaName of requiredSchemas) assert(schemas[schemaName], `required schema missing: ${schemaName}`)

const operationIDs = new Set()
for (const [pathName, pathItem] of Object.entries(paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method)) continue
    assert(operation?.operationId, `${method.toUpperCase()} ${pathName} must declare operationId`)
    assert(!operationIDs.has(operation.operationId), `duplicate operationId: ${operation.operationId}`)
    operationIDs.add(operation.operationId)
    assert(operation.responses && Object.keys(operation.responses).length > 0, `${method.toUpperCase()} ${pathName} must declare responses`)
  }
}

console.log(`mobile OpenAPI check passed: ${actualPaths.length} paths, ${operationIDs.size} operations, ${requiredSchemas.length} required schemas`)
