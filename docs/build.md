# Build Guide

## Requirements

- Node.js compatible with the repository toolchain.
- pnpm `11.4.0` as declared by `packageManager`.
- Android Studio or Xcode only when opening native projects locally.

## Install

```bash
pnpm install --frozen-lockfile
```

## Validate the Catalog Seed

```bash
pnpm catalog:test
pnpm catalog:generate
```

The generator reads `catalog/app.catalog.yaml` and writes `src/app/generated/catalog-seed.ts`. The same generator runs before both standalone and enterprise-compatible builds.

## Web Builds

Standalone offline build:

```bash
pnpm build
```

Enterprise-compatible required-mode build:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm build:enterprise
```

Do not add an API path suffix to `VITE_API_BASE_URL`; the App client adds its versioned API prefix internally.

## Local Development

Standalone development server:

```bash
pnpm dev
```

Required-mode development server:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm dev:enterprise
```

Production builds must use HTTPS API origins. HTTP API origins are only accepted while running the development server.

## Capacitor Sync

Build web assets before syncing native projects:

```bash
pnpm build
pnpm exec cap sync android
pnpm exec cap sync ios
```

Open native projects for local testing:

```bash
pnpm exec cap open android
pnpm exec cap open ios
```

Native signing, store submission, TestFlight, Play Store, and artifact publishing are intentionally out of scope for this public repository.

## Verification Commands

Run the same checks as CI before sharing a change:

```bash
pnpm catalog:test
pnpm boundary:check
pnpm typecheck
pnpm test
pnpm build
```
