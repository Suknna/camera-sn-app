# Catalog Seed

`catalog/app.catalog.yaml` is the compile-time sample catalog used by standalone builds and by self-build distributors who need their own data-center, room, and rack list.

## Schema

```yaml
version: "2026-06-26-demo"
data_centers:
  - id: "dc-demo-01"
    name: "Example data center"
    rooms:
      - id: "room-demo-a"
        name: "Room A"
        racks:
          - id: "rack-a01"
            name: "A01"
```

Required fields:

- `version`: non-empty string identifying the seed revision.
- `data_centers`: non-empty array.
- `data_centers[].id`: globally unique non-empty string.
- `data_centers[].name`: non-empty display name.
- `data_centers[].rooms`: non-empty array.
- `rooms[].id`: globally unique non-empty string.
- `rooms[].name`: non-empty display name.
- `rooms[].racks`: non-empty array.
- `racks[].id`: globally unique non-empty string.
- `racks[].name`: non-empty display name.

IDs are unique across data centers, rooms, and racks so the App can safely reference selected context in local drafts and exports.

## Failure Cases

Catalog generation fails for:

- invalid YAML syntax;
- unknown fields at any supported level;
- missing required fields;
- empty strings after trimming;
- empty arrays;
- duplicate IDs.

Run the validation test before building:

```bash
pnpm catalog:test
```

## Generate the TypeScript Seed

```bash
pnpm catalog:generate
```

The generated module is imported by the App bundle. It should only contain demo or self-build catalog data that is safe to distribute publicly.

## Self-Build Workflow

1. Copy the sample YAML structure.
2. Replace IDs and names with your own public-safe or local-only catalog values.
3. Run `pnpm catalog:test`.
4. Run `pnpm build` or the required-mode build command.
5. Sync native projects with Capacitor if building Android or iOS locally.

Do not commit real customer data, private rack layouts, production endpoints, or server serial numbers.
