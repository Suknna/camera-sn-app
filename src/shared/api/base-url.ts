export interface APIBaseURLEnv {
  VITE_API_BASE_URL?: string
  DEV?: boolean
}

export type APIBaseURLResult =
  | {
      ok: true
      baseURL: string
    }
  | { ok: false; message: string }

export class APIConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'APIConfigurationError'
  }
}

export function resolveAPIBaseURL(
  env: APIBaseURLEnv = import.meta.env
): APIBaseURLResult {
  const rawURL = env.VITE_API_BASE_URL?.trim()

  if (!rawURL) {
    return {
      ok: false,
      message: '工程师 App 必须显式配置 VITE_API_BASE_URL。',
    }
  }

  let url: URL
  try {
    url = new URL(rawURL)
  } catch {
    return {
      ok: false,
      message: 'VITE_API_BASE_URL 必须是有效的 http(s) URL。',
    }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, message: 'VITE_API_BASE_URL 只允许 http 或 https。' }
  }

  if (url.protocol === 'http:') {
    if (env.DEV === true) return { ok: true, baseURL: rawURL }

    return { ok: false, message: '生产工程师 App 必须使用 HTTPS API。' }
  }

  return { ok: true, baseURL: rawURL }
}
