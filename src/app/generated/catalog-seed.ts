import type { AppCatalogSeed } from '@app/lib/catalog/types'

export const catalogSeed = {
  "version": "2026-06-26-demo",
  "sourceHash": "2ab1132168c81c517b088ac8c0c4b8aaa751a57776aa1577d74aac6bcfd6a9ba",
  "dataCenters": [
    {
      "id": "dc-demo-01",
      "name": "示例数据中心01",
      "rooms": [
        {
          "id": "room-demo-a",
          "name": "A机房",
          "racks": [
            {
              "id": "rack-a01",
              "name": "A01"
            },
            {
              "id": "rack-a02",
              "name": "A02"
            }
          ]
        },
        {
          "id": "room-demo-b",
          "name": "B机房",
          "racks": [
            {
              "id": "rack-b01",
              "name": "B01"
            }
          ]
        }
      ]
    }
  ]
} as const satisfies AppCatalogSeed
