/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_TARGET?: 'app'
  readonly VITE_APP_CONTROL_PLANE_MODE?: 'standalone' | 'required'
  readonly VITE_API_BASE_URL?: string
}
