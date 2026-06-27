import type { AxiosInstance } from 'axios'
import { api } from '@shared/api/client'
import type { MobileContextDTO } from '@shared/types/mobile'

export function createMobileContextApi(client: AxiosInstance = api) {
  return {
    async getContext(): Promise<MobileContextDTO> {
      const { data } = await client.get<MobileContextDTO>('/mobile/context')
      return data
    },
  }
}

export const mobileContextApi = createMobileContextApi()
