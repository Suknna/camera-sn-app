import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResult,
  UserDTO,
} from '../types/api'
import { api } from './client'

export const authApi = {
  login: (req: LoginRequest) =>
    api.post<LoginResult>('/auth/login', req).then((r) => r.data),
  me: () => api.get<UserDTO>('/auth/me').then((r) => r.data),
  logout: () => api.post<void>('/auth/logout').then((r) => r.data),
  changePassword: (req: ChangePasswordRequest) =>
    api.post<void>('/auth/change-password', req).then((r) => r.data),
}
