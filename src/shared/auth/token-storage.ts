const TOKEN_KEY = 'camera-sn-access-token'

export function getAccessToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setAccessToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignore storage errors such as private browsing restrictions.
  }
}

export function clearAccessToken(): void {
  setAccessToken('')
}
