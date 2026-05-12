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

/**
 * Streaming variant of /ai/compose. Each model delta arrives via `onChunk`
 * so the caller can render it in real time (typing effect).
 *
 * In mock mode (dev without VITE_API_BASE) falls back to the one-shot
 * /ai/compose mock and replays the result as a synthetic typing animation.
 */
export async function composeStream(
  req: AIComposeRequest,
  { onChunk, onDone, onError }: StreamHandlers,
): Promise<void> {
  if (isMockMode()) {
    try {
      const resp = await compose(req)
      // Replay the result one token at a time so the UI still gets to
      // exercise the streaming code path during dev.
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
    return
  }

  let res: Response
  try {
    res = await fetch(`${getApiBase()}/ai/compose/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
  } catch (e) {
    onError(e instanceof Error ? e.message : '网络错误')
    return
  }
  if (!res.ok || !res.body) {
    onError(`HTTP ${res.status}`)
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
      const events = buf.split('\n\n')
      buf = events.pop() ?? ''
      for (const ev of events) {
        const line = ev.split('\n').find((l) => l.startsWith('data: '))
        if (!line) continue
        const payload = JSON.parse(line.slice(6)) as {
          chunk?: string
          done?: boolean
          error?: string
        }
        if (payload.error) {
          onError(payload.error)
          return
        }
        if (payload.done) {
          onDone()
          return
        }
        if (payload.chunk) onChunk(payload.chunk)
      }
    }
    onDone()
  } catch (e) {
    onError(e instanceof Error ? e.message : '流式读取失败')
  }
}
