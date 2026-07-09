import type { ZodType, ZodTypeDef } from 'zod'

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
// Default to same-origin direct path: prod nginx maps /(auth|notes|drafts|
// interactions|ai|health|uploads|admin)/* → backend, so /auth/login goes
// straight through. Override with VITE_API_BASE for cross-origin setups.
const baseURL = apiBase ?? ''

/** Whether the in-process mock dispatch is active. Exported for endpoints
 * like /ai/compose/stream that bypass the mock JSON path (raw fetch + SSE)
 * and need to fall back when mocks are mounted. */
export const isMockMode = (): boolean => useMock
export const getApiBase = (): string => baseURL

/**
 * Re-base a stored upload URL onto the current API origin, keeping only its
 * path. Upload URLs are persisted *absolute* (built from the backend
 * `public_base_url`), which can be a different domain than the one the SPA is
 * actually served on (e.g. winbeau.top vs feiyue.selab.top). A cross-origin
 * `fetch()` of such a URL is CORS-blocked and the preview hangs forever. Using
 * `<apiBase><path>` makes the fetch same-origin in prod (apiBase='') and
 * CORS-allowed in dev (apiBase=localhost:8000). Use for any fetch/<img> of an
 * uploaded asset; plain navigation (window.open) can keep the absolute URL.
 */
export function resolveAssetUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    return `${baseURL}${u.pathname}${u.search}`
  } catch {
    return url
  }
}

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
type MockPattern = { method: HttpMethod; regex: RegExp; handler: MockHandler }
const mockPatterns: MockPattern[] = []

export function registerMock(method: HttpMethod, path: string, handler: MockHandler): void {
  if (path.includes(':')) {
    // `:name` → match any segment without `/`. Anchor at both ends.
    const pattern = path.replace(/:[A-Za-z_]+/g, '[^/]+')
    const regex = new RegExp(`^${pattern}$`)
    mockPatterns.push({ method, regex, handler })
    return
  }
  mockHandlers.set(`${method} ${path}`, handler)
}

function findMockHandler(method: HttpMethod, path: string): MockHandler | undefined {
  const exact = mockHandlers.get(`${method} ${path}`)
  if (exact) return exact
  return mockPatterns.find((p) => p.method === method && p.regex.test(path))?.handler
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

export type QueryValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string | number | boolean>
  | undefined

type RequestOpts<T> = {
  method: HttpMethod
  path: string
  // Input 放开为 unknown：带 .default() 的 schema input/output 类型不同，
  // 绑死 Input=Output 会让 T 被推断成 input 形状（默认字段变可选）。
  schema: ZodType<T, ZodTypeDef, unknown>
  body?: unknown
  query?: Record<string, QueryValue>
  headers?: Record<string, string>
}

export async function request<T>(opts: RequestOpts<T>): Promise<T> {
  const queryParams = new URLSearchParams()
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue
      // Arrays emit repeated keys (FastAPI's default list[str] decoding).
      if (Array.isArray(v)) {
        for (const item of v) queryParams.append(k, String(item))
      } else {
        queryParams.set(k, String(v))
      }
    }
  }

  let raw: unknown

  if (useMock) {
    const handler = findMockHandler(opts.method, opts.path)
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
