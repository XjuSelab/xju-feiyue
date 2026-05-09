import type { ZodType } from 'zod'

/**
 * 单一 fetcher：dev 走 mock dispatch 表，prod 走真 fetch。
 * - 业务模块 (endpoints/*) 永远调用 `request({ schema })`
 *   schema.parse 强制输出在边界处通过 zod 校验
 * - 切真后端：把 baseURL 指向真服务、删 mock/handlers 即可，
 *   业务代码 0 改动
 */

const isDev = import.meta.env.DEV
const baseURL =
  (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api'
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

export function registerMock(
  method: HttpMethod,
  path: string,
  handler: MockHandler,
): void {
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

  if (isDev) {
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
    const init: RequestInit = {
      method: opts.method,
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    }
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
    const res = await fetch(url, init)
    if (!res.ok) {
      throw new ApiError(`HTTP ${res.status}`, res.status, opts.path)
    }
    raw = res.status === 204 ? null : await res.json()
  }

  return opts.schema.parse(raw)
}
