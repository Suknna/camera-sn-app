import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { APIError } from '@shared/api/errors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSignIn } from './app-sign-in'

const authMocks = vi.hoisted(() => ({
  login: vi.fn<() => Promise<void>>(),
}))

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn<() => Promise<void>>(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => routerMocks.navigate,
}))

vi.mock('@shared/auth/auth-store', () => ({
  useAuthStore: <T,>(
    selector: (state: {
      auth: { login: (_req: unknown) => Promise<void> }
    }) => T
  ) =>
    selector({
      auth: { login: authMocks.login },
    }),
}))

describe('AppSignIn runtime config handling', () => {
  const validRuntimeConfig = {
    ok: true,
    config: {
      controlPlaneMode: 'required',
      apiBaseURL: 'https://api.example.com',
    },
  } as const

  let container: HTMLDivElement
  let root: Root | undefined

  beforeEach(() => {
    authMocks.login.mockReset()
    authMocks.login.mockResolvedValue(undefined)
    routerMocks.navigate.mockReset()
    routerMocks.navigate.mockResolvedValue(undefined)
    root = undefined
    container = document.createElement('div')
    document.body.append(container)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount())
    }
    container.remove()
  })

  it('shows a config error without the login button when runtime config is invalid', async () => {
    await renderSignIn({
      ok: false,
      message: '工程师 App 必须显式配置 VITE_API_BASE_URL。',
    })

    expect(container.textContent).toContain('App 配置错误')
    expect(container.textContent).toContain(
      '工程师 App 必须显式配置 VITE_API_BASE_URL。'
    )
    expect(container.querySelector('button')).toBeNull()
    expect(authMocks.login).not.toHaveBeenCalled()
  })

  it('shows API error codes inline when login fails', async () => {
    authMocks.login.mockRejectedValue(
      new APIError(
        {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
          request_id: 'req-app-login-1',
        },
        401
      )
    )

    await renderSignIn()
    await changeInput('#username', 'operator')
    await changeInput('#password', 'bad-password')
    await clickButton('登录')

    await waitForAssertion(() => {
      expect(container.textContent).toContain('用户名或密码错误')
      expect(container.textContent).toContain('错误码：INVALID_CREDENTIALS')
    })
  })

  it('shows the brand logo on the login form', async () => {
    await renderSignIn()

    const logo = container.querySelector<HTMLImageElement>(
      "img[src='/logo-mark.png']"
    )
    expect(logo?.getAttribute('alt')).toBe('')
    expect(logo?.getAttribute('aria-hidden')).toBe('true')
    expect(logo?.className).toContain('mx-auto')
    expect(logo?.className).toContain('size-12')
  })

  async function renderSignIn(
    runtimeConfig: Parameters<
      typeof AppSignIn
    >[0]['runtimeConfig'] = validRuntimeConfig
  ) {
    await act(async () => {
      root = createRoot(container)
      root.render(<AppSignIn runtimeConfig={runtimeConfig} />)
    })
  }

  async function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    )
    if (!button) throw new Error(`Button not found: ${label}`)

    await act(async () => {
      button.click()
    })
  }

  async function changeInput(selector: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(selector)
    if (!input) throw new Error(`Input not found: ${selector}`)

    await act(async () => {
      setNativeValue(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  async function waitForAssertion(assertion: () => void) {
    let lastError: unknown

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        assertion()
        return
      } catch (error) {
        lastError = error
        await act(async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 10))
        })
      }
    }

    throw lastError
  }
})

function setNativeValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element) as HTMLInputElement,
    'value'
  )
  descriptor?.set?.call(element, value)
}
