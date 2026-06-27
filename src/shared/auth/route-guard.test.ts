import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../api/auth'
import type { UserDTO } from '../types/api'
import { useAuthStore } from './auth-store'
import type { Principal } from './principal'
import { operatorGuard } from './route-guard'
import { getAccessToken } from './token-storage'

vi.mock('@tanstack/react-router', () => ({
  redirect: (args: unknown) => ({ redirected: args }),
}))

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
  id: 'u-operator',
  username: 'operator',
  display_name: 'Operator',
  role: 'operator',
  status: 'active',
}

const operatorPrincipal: Principal = {
  id: 'u-operator',
  username: 'operator',
  displayName: 'Operator',
  role: 'operator',
  status: 'active',
}

function setPrincipal(principal: Principal) {
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      principal,
    },
  }))
}

function setCachedAuth(principal: Principal, accessToken = 'token-1') {
  useAuthStore.getState().auth.setAccessToken(accessToken)
  setPrincipal(principal)
}

async function expectRedirectToSignIn(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ redirected: { to: '/sign-in' } })
}

function expectLoggedOutState() {
  const state = useAuthStore.getState().auth
  expect(state.accessToken).toBe('')
  expect(state.principal).toBeNull()
  expect(state.isLoading).toBe(false)
  expect(getAccessToken()).toBe('')
}

describe('operatorGuard', () => {
  beforeEach(() => {
    mockedAuthApi.me.mockReset()
    localStorage.clear()
    useAuthStore.getState().auth.reset()
  })

  it('redirects to sign-in without token', async () => {
    await expectRedirectToSignIn(operatorGuard())

    expect(mockedAuthApi.me).not.toHaveBeenCalled()
  })

  it('rejects cached principal without token and clears auth', async () => {
    setPrincipal(operatorPrincipal)

    await expectRedirectToSignIn(operatorGuard())

    expect(mockedAuthApi.me).not.toHaveBeenCalled()
    expectLoggedOutState()
  })

  it('allows active operator after token validation', async () => {
    mockedAuthApi.me.mockResolvedValue(activeOperator)
    setCachedAuth(operatorPrincipal)

    await expect(operatorGuard()).resolves.toBeUndefined()

    expect(mockedAuthApi.me).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().auth.principal).toEqual(operatorPrincipal)
  })

  it('loads operator principal from token before allowing route', async () => {
    mockedAuthApi.me.mockResolvedValue(activeOperator)
    useAuthStore.getState().auth.setAccessToken('token-1')

    await expect(operatorGuard()).resolves.toBeUndefined()

    expect(mockedAuthApi.me).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().auth.principal).toEqual(operatorPrincipal)
  })

  it('rejects and clears auth when token validation fails', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('me failed'))
    setCachedAuth(operatorPrincipal)

    await expectRedirectToSignIn(operatorGuard())

    expect(mockedAuthApi.me).toHaveBeenCalledOnce()
    expectLoggedOutState()
  })

  it('rejects and clears auth when token validates to disabled operator', async () => {
    mockedAuthApi.me.mockResolvedValue({
      ...activeOperator,
      status: 'disabled',
    })
    setCachedAuth(operatorPrincipal)

    await expectRedirectToSignIn(operatorGuard())

    expect(mockedAuthApi.me).toHaveBeenCalledOnce()
    expectLoggedOutState()
  })
})
