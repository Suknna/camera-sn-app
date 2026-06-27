import { create } from 'zustand'
import { authApi } from '../api/auth'
import { handleServerError } from '../lib/handle-server-error'
import type { LoginRequest, UserDTO } from '../types/api'
import { toPrincipal, type Principal } from './principal'
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken as persistAccessToken,
} from './token-storage'

interface AuthState {
  auth: {
    accessToken: string
    principal: Principal | null
    isLoading: boolean
    setAccessToken: (token: string) => void
    setPrincipal: (user: UserDTO | null) => void
    login: (req: LoginRequest) => Promise<void>
    fetchMe: () => Promise<void>
    logout: () => Promise<void>
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const clearAuthenticatedSession = () => {
    clearAccessToken()
    set((state) => ({
      auth: {
        ...state.auth,
        accessToken: '',
        principal: null,
        isLoading: false,
      },
    }))
  }

  return {
    auth: {
      // localStorage is intentional: Capacitor WebView does not handle cookies
      // cleanly when the frontend calls an absolute API origin.
      accessToken: getAccessToken(),
      principal: null,
      isLoading: false,

      setAccessToken: (accessToken) => {
        persistAccessToken(accessToken)
        set((state) => ({ auth: { ...state.auth, accessToken } }))
      },

      setPrincipal: (user) => {
        if (!user) {
          set((state) => ({ auth: { ...state.auth, principal: null } }))
          return
        }

        try {
          const principal = toPrincipal(user)
          set((state) => ({ auth: { ...state.auth, principal } }))
        } catch (err) {
          clearAuthenticatedSession()
          throw err
        }
      },

      login: async (req) => {
        set((state) => ({ auth: { ...state.auth, isLoading: true } }))
        try {
          const result = await authApi.login(req)
          const principal = toPrincipal(result.user)
          persistAccessToken(result.access_token)
          set((state) => ({
            auth: {
              ...state.auth,
              accessToken: result.access_token,
              principal,
              isLoading: false,
            },
          }))
        } catch (err) {
          clearAuthenticatedSession()
          handleServerError(err)
          throw err
        }
      },

      fetchMe: async () => {
        set((state) => ({ auth: { ...state.auth, isLoading: true } }))
        try {
          const user = await authApi.me()
          const principal = toPrincipal(user)
          set((state) => ({
            auth: { ...state.auth, principal, isLoading: false },
          }))
        } catch (err) {
          clearAuthenticatedSession()
          throw err
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch (err) {
          handleServerError(err)
        } finally {
          clearAuthenticatedSession()
        }
      },

      reset: () => {
        clearAuthenticatedSession()
      },
    },
  }
})
