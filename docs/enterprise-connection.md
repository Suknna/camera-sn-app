# Enterprise-Compatible Connection

Camera SN App can be built in `required` mode for deployments that provide a compatible enterprise control-plane API. This repository contains only the App-side public protocol client and does not include the control-plane implementation.

## Build-Time Configuration

```bash
VITE_API_BASE_URL=https://api.example.com pnpm build:enterprise
```

`VITE_API_BASE_URL` must be the HTTPS API origin only. The App client adds its versioned API prefix internally.

`VITE_APP_CONTROL_PLANE_MODE=required` is set by the `build:enterprise` script. Standalone builds reject `VITE_API_BASE_URL` to avoid accidental network coupling.

## Transport Requirements

- Production required-mode builds must use HTTPS.
- Bearer tokens are attached by the App after login.
- JSON requests use `Content-Type: application/json`.
- Network requests time out after 30 seconds.
- Error responses should use `{ "error": { "code": string, "message": string, "request_id": string } }`.

HTTP endpoints are only accepted while running the development server. Do not publish production builds configured with HTTP endpoints.

## Public API Expectations

A compatible API provides operator-only mobile workflow capabilities:

- login, logout, current user, and password change for active `operator` accounts;
- mobile context with data centers, rooms, racks, and machine profiles;
- mobile scan-batch creation with an idempotent client batch ID;
- mobile scan-batch retrieval;
- mobile scan-batch submission with client item IDs, raw barcode values, serial numbers, rack IDs, and optional U positions;
- mobile draft cancellation.

The App rejects non-operator or disabled users after current-user lookup. Admin, bootstrap, audit, inventory, deployment, and release automation APIs are not part of this public App boundary.

## Data Safety

Do not place real serial numbers, customer data, API keys, certificates, signing files, or production endpoints in `.env*`, tests, docs, screenshots, issues, or support reports.
