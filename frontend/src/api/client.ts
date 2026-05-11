import type { ZodType } from 'zod'

/**
 * 单一 fetcher：mock dispatch（dev 默认）或真 fetch（设置了
 * VITE_API_BASE 即切真后端，dev / prod 都生效）。
 * - 业务模块 (endpoints/*) 永远调用 `request({ schema })`
 *   schema.parse 强制输出在边界处通过 zod 校验
 * - 切真后端：在 .env.local 写 VITE_API_BASE=http://localhost:8000
 *   即可，业务代码 0 改动
 */

const apiBase = import.meta.env['VITE_API_BASE'] as string | undefined
const useMock = import.meta.env.DEV && !apiBase
const baseURL = apiBase ?? '/api'
const MOCK_LATENCY_MS = 200

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type MockReq = {
  method: HttpMethod
  path: string
  query: URLSearchParams
  body: unknown
  headers: Headers
}

export type MockHandler = (req: MockReq) => Promise<unknown>

const mockHandlers = new Map<string, MockHandler>()

export function registerMock(method: HttpMethod, path: string, handler: MockHandler): void {
  mockHandlers.set(`${method} ${path}`, handler)
}

export class ApiError extends Error {
  override readonly name = 'ApiError'
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message)
  }
}

type RequestOpts<T> = {
  method: HttpMethod
  path: string
  schema: ZodType<T>
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}

export async function request<T>(opts: RequestOpts<T>): Promise<T> {
  const queryParams = new URLSearchParams()
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) queryParams.set(k, String(v))
    }
  }

  let raw: unknown

  if (useMock) {
    const handler = mockHandlers.get(`${opts.method} ${opts.path}`)
    if (!handler) {
      throw new ApiError(
        `No mock handler registered for ${opts.method} ${opts.path}`,
        501,
        opts.path,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
    raw = await handler({
      method: opts.method,
      path: opts.path,
      query: queryParams,
      body: opts.body,
      headers: new Headers(opts.headers ?? {}),
    })
  } else {
    const url = new URL(`${baseURL}${opts.path}`, window.location.origin)
    queryParams.forEach((v, k) => url.searchParams.set(k, v))
    const isFormData = opts.body instanceof FormData
    const init: RequestInit = {
      method: opts.method,
      // Don't set Content-Type for FormData — fetch fills the multipart
      // boundary automatically; manually setting it would break the boundary.
      headers: isFormData
        ? { ...(opts.headers ?? {}) }
        : { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    }
    if (opts.body !== undefined) {
      init.body = isFormData ? (opts.body as FormData) : JSON.stringify(opts.body)
    }
    const res = await fetch(url, init)
    if (!res.ok) {
      // 后端约定：错误体形如 { detail: string }（FastAPI 默认）。
      // 读出 detail 当 ApiError.message，前端 toast / 字段错误能直接显示。
      let message = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { detail?: unknown } | null
        if (body && typeof body.detail === 'string' && body.detail.length > 0) {
          message = body.detail
        }
      } catch {
        /* keep HTTP fallback */
      }
      throw new ApiError(message, res.status, opts.path)
    }
    raw = res.status === 204 ? null : await res.json()
  }

  return opts.schema.parse(raw)
}
