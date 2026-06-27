# Camera SN Mobile API Contract

This is the public-safe copy of the Camera SN App required-mode API contract.

The private control-plane repository owns the server implementation and remains the source of truth for the contract. This copy exists so App contributors can inspect and validate the required-mode API surface without access to private backend code.

The contract intentionally includes only:

- App authentication endpoints under `/api/v1/auth/*`
- App scanning endpoints under `/api/v1/mobile/*`

It intentionally excludes admin, bootstrap, audit, inventory, deployment, signing, customer endpoint, and private release details.
