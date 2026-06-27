import type { UserDTO, UserRole } from '../types/api'

export interface Principal {
  id: string
  username: string
  displayName: string
  role: UserRole
  status: 'active'
}

export function toPrincipal(user: UserDTO): Principal {
  if (user.role !== 'operator' || user.status !== 'active') {
    throw new Error('Enterprise App access requires an active operator account.')
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    status: user.status,
  }
}

export function requireRole(principal: Principal | null, role: UserRole): void {
  if (!principal || principal.role !== role || principal.status !== 'active') {
    throw new Error('Required operator role is missing.')
  }
}
