# Camera SN App

Camera SN App is an offline-first field scanning application for recording server serial numbers during receiving, racking, and inventory work.

## Features

- Standalone offline scanning with local SQLite storage.
- Compile-time example catalog seed for data centers, rooms, and racks.
- Batch-level machine configuration with per-item overrides.
- Excel export with serial numbers preserved as text.
- Native system sharing through Capacitor.
- Optional required-mode connection to a compatible enterprise control-plane API.

## Repository Scope

This public repository contains the App source code and public protocol client needed by the mobile field workflow. It does not include the enterprise control-plane implementation, backend deployment, admin console, audit service, or private release automation.

## Mobile API contract

The required enterprise mode uses the public-safe contract in `api/mobile/openapi.yaml`. The private control plane is the server-side source of truth, and this repository keeps a synchronized copy for App development and CI validation.

## Development

```bash
pnpm install --frozen-lockfile
pnpm catalog:test
pnpm typecheck
pnpm test
pnpm build
```

## Standalone Build

```bash
pnpm build
```

## Enterprise-Compatible Build

```bash
VITE_API_BASE_URL=https://api.example.com pnpm build:enterprise
```

## Catalog Seed

Edit `catalog/app.catalog.yaml`, then run:

```bash
pnpm catalog:generate
```

Invalid catalog YAML fails the build.

## App Identifier

The official source uses `com.camerasn.field`. Self-build distributors who need their own Android application ID or iOS Bundle ID must change those identifiers explicitly before distribution.

## License

Apache-2.0
