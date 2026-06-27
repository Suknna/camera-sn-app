# Architecture

Camera SN App is an offline-first field scanning application. It keeps field work usable when network access is unavailable and only connects to a compatible enterprise control-plane API when the build is explicitly configured for required mode.

## Runtime Modes

- `standalone`: uses the compile-time catalog seed, local SQLite storage, local draft state, Excel export, and native sharing without any control-plane connection.
- `required`: requires `VITE_API_BASE_URL` at build time and uses the public API client for operator login, catalog context, scan-batch creation, submission, and cancellation.

`VITE_APP_CONTROL_PLANE_MODE` must be set explicitly. The app does not infer a mode from the presence of other environment variables.

## Standalone Data Flow

1. `catalog/app.catalog.yaml` is validated by `pnpm catalog:generate`.
2. The generator writes `src/app/generated/catalog-seed.ts` for the web and native app bundle.
3. On first run, the app imports the catalog seed into the local SQLite database.
4. The operator creates local scan batches, scans SN barcodes, and stores raw barcode values plus normalized serial numbers locally.
5. Completed batches can be exported to Excel with SN values preserved as text.
6. Exported files are shared through the native system share sheet when the platform supports it.

## Local Persistence

The local database stores only the App workflow state needed by the field scanner:

- operator profile name for standalone use;
- catalog seed version, data centers, rooms, and racks;
- scan batches, batch attributes, scan items, and item-level overrides;
- export records for generated workbooks.

U positions are optional and constrained to the physical rack range supported by the App. Duplicate serial numbers are rejected within the same local batch before export.

## Required Enterprise API Boundary

Required mode expects a compatible HTTPS API origin such as `https://api.example.com`. The public API client adds the versioned API prefix internally; do not include that prefix in `VITE_API_BASE_URL`.

The App boundary is intentionally narrow:

- operator authentication and current-user lookup;
- mobile catalog context for data centers, rooms, racks, and machine profiles;
- mobile scan-batch create, read, submit, and cancel operations;
- structured JSON error responses for user-facing failures.

This repository does not include backend storage, admin workflows, audit handling, deployment automation, signing assets, or release distribution automation.

## Boundary Guardrails

`pnpm boundary:check` fails if App/shared code imports or references admin/bootstrap semantics. Keep all public code App-only and avoid adding control-plane implementation details to this repository.
