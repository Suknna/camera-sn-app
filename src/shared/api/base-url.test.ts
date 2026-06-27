import { describe, expect, it } from 'vitest'
import { resolveAPIBaseURL } from './base-url'

describe('resolveAPIBaseURL', () => {
  it('fails closed without an explicit API URL', () => {
    const result = resolveAPIBaseURL({})

    expect(result).toEqual({
      ok: false,
      message: '工程师 App 必须显式配置 VITE_API_BASE_URL。',
    })
  })

  it('allows HTTPS app API URLs', () => {
    const result = resolveAPIBaseURL({
      VITE_API_BASE_URL: 'https://api.example.com',
    })

    expect(result).toEqual({
      ok: true,
      baseURL: 'https://api.example.com',
    })
  })

  it('allows HTTP app API URLs only while running the development server', () => {
    const result = resolveAPIBaseURL({
      VITE_API_BASE_URL: 'http://192.168.1.50:18080',
      DEV: true,
    })

    expect(result).toEqual({
      ok: true,
      baseURL: 'http://192.168.1.50:18080',
    })
  })

  it('rejects production HTTP app API URLs', () => {
    const result = resolveAPIBaseURL({
      VITE_API_BASE_URL: 'http://192.168.1.50:18080',
      DEV: false,
    })

    expect(result).toEqual({
      ok: false,
      message: '生产工程师 App 必须使用 HTTPS API。',
    })
  })

  it('rejects non-http API URL schemes', () => {
    const result = resolveAPIBaseURL({
      VITE_API_BASE_URL: 'ftp://api.example.com',
    })

    expect(result).toEqual({
      ok: false,
      message: 'VITE_API_BASE_URL 只允许 http 或 https。',
    })
  })

  it('exposes the validated Vite build target to client code', () => {
    expect(import.meta.env.VITE_BUILD_TARGET).toBe('app')
  })
})
