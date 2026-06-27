export type UserRole = 'operator'
export type UserStatus = 'active' | 'disabled'

export interface UserDTO {
  id: string
  username: string
  display_name: string
  role: UserRole
  status: UserStatus
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResult {
  access_token: string
  token_type: string
  expires_in: number
  user: UserDTO
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
}

export interface APIErrorBody {
  code: string
  message: string
  request_id: string
  details?: Record<string, unknown>
}

export interface APIErrorResponse {
  error: APIErrorBody
}
