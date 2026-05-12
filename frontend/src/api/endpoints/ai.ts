import { getApiBase, isMockMode, request } from '../client'
import {
  AIComposeResponseSchema,
  type AIComposeRequest,
  type AIComposeResponse,
} from '../schemas/ai'

/**
 * R4 editor-agent 实现：mock 后端在 mock/handlers.ts 中按 mode 分派一个
 * 简单的字符串 transform，再用 diffEngine 计算 segments。
 */
export async function compose(req: AIComposeRequest): Promise<AIComposeResponse> {
  return request({
    method: 'POST',
    path: '/ai/compose',
    body: req,
    schema: AIComposeResponseSchema,
  })
}

type StreamHandlers = {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (msg: string) => void
}

/** Replay a one-shot compose response as a synthetic typing animation. */
async function playSynthetic(
  req: AIComposeRequest,
  { onChunk, onDone, onError }: StreamHandlers,
): Promise<void> {
  try {
    const resp = await compose(req)
    const text = resp.after
    const step = Math.max(2, Math.ceil(text.length / 14))
    for (let i = 0; i < text.length; i += step) {
      onChunk(text.slice(i, i + step))
      await new Promise((r) => setTimeout(r, 60))
    }
    onDone()
  } catch (e) {
    onError(e instanceof Error ? e.message : 'AI 生成失败')
  }
}

/**
 * Streaming variant of /ai/compose. Each model delta arrives via `onChunk`
 * so the caller can render it in real time (typing effect).
 *
 * Three layers of fallback so the UX never just sits there with an empty
 * textarea:
 * 1. Mock mode (dev without VITE_API_BASE): synthesize chunks from the
 *    one-shot mock response.
 * 2. Stream endpoint not reachable / non-OK: fall back to one-shot
 *    /ai/compose, replay as fake chunks.
 * 3. Stream connects but no chunk arrives within FIRST_CHUNK_TIMEOUT_MS
 *    (usually nginx buffering the whole response): abort and fall back
 *    to one-shot.
 */
const FIRST_CHUNK_TIMEOUT_MS = 5000

export async function composeStream(
  req: AIComposeRequest,
  handlers: StreamHandlers,
): Promise<void> {
  if (isMockMode()) {
    await playSynthetic(req, handlers)
    return
  }

  const { onChunk, onDone, onError } = handlers
  const controller = new AbortController()
  let firstChunk = false
  let bailedToFallback = false

  const giveUp = setTimeout(() => {
    if (!firstChunk) {
      bailedToFallback = true
      controller.abort()
    }
  }, FIRST_CHUNK_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${getApiBase()}/ai/compose/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(giveUp)
    if (bailedToFallback) {
      await playSynthetic(req, handlers)
      return
    }
    onError(e instanceof Error ? e.message : '网络错误')
    return
  }

  if (!res.ok || !res.body) {
    clearTimeout(giveUp)
    await playSynthetic(req, handlers)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      // SSE event delimiter is a blank line: LF on the wire, but some
      // proxies inject CRLF. Try both.
      const sep = buf.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n'
      const events = buf.split(sep)
      buf = events.pop() ?? ''
      for (const ev of events) {
        const line = ev.split(/\r?\n/).find((l) => l.startsWith('data: '))
        if (!line) continue
        const payload = JSON.parse(line.slice(6)) as {
          chunk?: string
          done?: boolean
          error?: string
        }
        if (payload.error) {
          clearTimeout(giveUp)
          onError(payload.error)
          return
        }
        if (payload.done) {
          clearTimeout(giveUp)
          onDone()
          return
        }
        if (payload.chunk) {
          if (!firstChunk) {
            firstChunk = true
            clearTimeout(giveUp)
          }
          onChunk(payload.chunk)
        }
      }
    }
    clearTimeout(giveUp)
    onDone()
  } catch (e) {
    clearTimeout(giveUp)
    if (bailedToFallback) {
      await playSynthetic(req, handlers)
      return
    }
    onError(e instanceof Error ? e.message : '流式读取失败')
  }
}
