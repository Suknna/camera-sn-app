import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/auth'
import type { LoginRequest, LoginResult, UserDTO } from '../types/api'
import { useAuthStore } from './auth-store'
import { getAccessToken } from './token-storage'

vi.mock('../api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('../lib/handle-server-error', () => ({
  handleServerError: vi.fn(),
}))

const mockedAuthApi = vi.mocked(authApi)

const activeOperator: UserDTO = {
  id: 'u1',
  username: 'operator',
  display_name: 'Operator',
  role: 'operator',
  status: 'active',
}

const loginRequest: LoginRequest = {
  username: 'operator',
  password: 'password',
}

const loginResult: LoginResult = {
  access_token: 'token-1',
  token_type: 'Bearer',
  expires_in: 3600,
  user: activeOperator,
}

function seedAuthenticatedState(token = 'stale-token') {
  const auth = useAuthStore.getState().auth
  auth.setAccessToken(token)
  auth.setPrincipal(activeOperator)
  expect(getAccessToken()).toBe(token)
}

function expectLoggedOutState() {
  const state = useAuthStore.getState().auth
  expect(state.accessToken).toBe('')
  expect(state.principal).toBeNull()
  expect(state.isLoading).toBe(false)
  expect(getAccessToken()).toBe('')
}

describe('auth-store', () => {
  beforeEach(() => {
    mockedAuthApi.login.mockReset()
    mockedAuthApi.me.mockReset()
    mockedAuthApi.logout.mockReset()
    localStorage.clear()
    useAuthStore.getState().auth.reset()
  })

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState().auth
    expect(state.accessToken).toBe('')
    expect(state.principal).toBeNull()
    expect(getAccessToken()).toBe('')
  })

  it('clears principal when setPrincipal receives null', () => {
    seedAuthenticatedState()

    useAuthStore.getState().auth.setPrincipal(null)

    const state = useAuthStore.getState().auth
    expect(state.accessToken).toBe('stale-token')
    expect(state.principal).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(getAccessToken()).toBe('stale-token')
  })

  it('rejects non-operator role during setPrincipal and clears old auth', () => {
    seedAuthenticatedState()

    expect(() =>
      useAuthStore.getState().auth.setPrincipal({
        id: 'u1',
        username: 'u',
        display_name: 'U',
        role: 'unknown' as never,
        status: 'active',
      })
    ).toThrow('Enterprise App access requires an active operator account.')

    expectLoggedOutState()
  })

  it('rejects disabled user during setPrincipal and clears old auth', () => {
    seedAuthenticatedState()

    expect(() =>
      useAuthStore.getState().auth.setPrincipal({
        id: 'u2',
        username: 'disabled',
        display_name: 'Disabled',
        role: 'operator',
        status: 'disabled',
      })
    ).toThrow('Enterprise App access requires an active operator account.')

    expectLoggedOutState()
  })

  it('rejects unknown status during setPrincipal and clears old auth', () => {
    seedAuthenticatedState()

    expect(() =>
      useAuthStore.getState().auth.setPrincipal({
        id: 'u3',
        username: 'suspended',
        display_name: 'Suspended',
        role: 'operator',
        status: 'suspended' as never,
      })
    ).toThrow('Enterprise App access requires an active operator account.')

    expectLoggedOutState()
  })

  it('stores returned token and principal after login', async () => {
    mockedAuthApi.login.mockResolvedValue(loginResult)

    await useAuthStore.getState().auth.login(loginRequest)

    const state = useAuthStore.getState().auth
    expect(mockedAuthApi.login).toHaveBeenCalledWith(loginRequest)
    expect(state.accessToken).toBe('token-1')
    expect(state.principal).toEqual({
      id: 'u1',
      username: 'operator',
      displayName: 'Operator',
      role: 'operator',
      status: 'active',
    })
    expect(state.isLoading).toBe(false)
    expect(getAccessToken()).toBe('token-1')
  })

  it('clears old auth when login API fails', async () => {
    const error = new Error('login failed')
    mockedAuthApi.login.mockRejectedValue(error)
    seedAuthenticatedState()

    await expect(
      useAuthStore.getState().auth.login(loginRequest)
    ).rejects.toThrow('login failed')

    expect(mockedAuthApi.login).toHaveBeenCalledWith(loginRequest)
    expectLoggedOutState()
  })

  it('clears old auth when login returns non-operator role', async () => {
    mockedAuthApi.login.mockResolvedValue({
      ...loginResult,
      access_token: 'new-token',
      user: { ...activeOperator, role: 'unknown' as never },
    })
    seedAuthenticatedState()

    await expect(
      useAuthStore.getState().auth.login(loginRequest)
    ).rejects.toThrow(
      'Enterprise App access requires an active operator account.'
    )

    expect(mockedAuthApi.login).toHaveBeenCalledWith(loginRequest)
    expectLoggedOutState()
  })

  it('clears old auth when login returns disabled user', async () => {
    mockedAuthApi.login.mockResolvedValue({
      ...loginResult,
      access_token: 'new-token',
      user: { ...activeOperator, status: 'disabled' },
    })
    seedAuthenticatedState()

    await expect(
      useAuthStore.getState().auth.login(loginRequest)
    ).rejects.toThrow(
      'Enterprise App access requires an active operator account.'
    )

    expect(mockedAuthApi.login).toHaveBeenCalledWith(loginRequest)
    expectLoggedOutState()
  })

  it('loads current user principal with fetchMe', async () => {
    mockedAuthApi.me.mockResolvedValue(activeOperator)

    await useAuthStore.getState().auth.fetchMe()

    const state = useAuthStore.getState().auth
    expect(mockedAuthApi.me).toHaveBeenCalledOnce()
    expect(state.principal).toEqual({
      id: 'u1',
      username: 'operator',
      displayName: 'Operator',
      role: 'operator',
      status: 'active',
    })
    expect(state.isLoading).toBe(false)
  })

  it('clears old auth and storage when fetchMe fails', async () => {
    const error = new Error('me failed')
    mockedAuthApi.me.mockRejectedValue(error)
    seedAuthenticatedState()

    await expect(useAuthStore.getState().auth.fetchMe()).rejects.toThrow(
      'me failed'
    )

    expect(mockedAuthApi.me).toHaveBeenCalledOnce()
    expectLoggedOutState()
  })

  it('clears token and principal after logout', async () => {
    mockedAuthApi.logout.mockResolvedValue(undefined)
    useAuthStore.getState().auth.setAccessToken('token-1')
    useAuthStore.getState().auth.setPrincipal(activeOperator)

    await useAuthStore.getState().auth.logout()

    const state = useAuthStore.getState().auth
    expect(mockedAuthApi.logout).toHaveBeenCalledOnce()
    expect(state.accessToken).toBe('')
    expect(state.principal).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(getAccessToken()).toBe('')
  })

  it('reset clears token, principal, loading, and storage', () => {
    seedAuthenticatedState()
    useAuthStore.setState((state) => ({
      auth: { ...state.auth, isLoading: true },
    }))

    useAuthStore.getState().auth.reset()

    expectLoggedOutState()
  })
})
