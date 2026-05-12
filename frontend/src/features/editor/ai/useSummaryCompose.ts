import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { composeStream } from '@/api/endpoints/ai'

type StartArgs = {
  content: string
  /** Called with the cumulative summary text on every delta. */
  onProgress: (current: string) => void
  /** Final value (also passed to onProgress on the last tick). */
  onDone?: (final: string) => void
}

/**
 * Drive the streaming /ai/compose/stream endpoint for the summarize mode.
 * Keeps a ref to the live buffer so chunks are appended without a stale
 * closure, and exposes `isPending` for the loading animation.
 */
export function useSummaryCompose() {
  const [isPending, setPending] = useState(false)
  const bufferRef = useRef('')

  const generate = useCallback(({ content, onProgress, onDone }: StartArgs) => {
    if (!content.trim()) {
      toast.error('请先填写正文，再让 AI 总结')
      return
    }
    bufferRef.current = ''
    setPending(true)
    void composeStream(
      { mode: 'summarize', text: content },
      {
        onChunk: (delta) => {
          bufferRef.current += delta
          onProgress(bufferRef.current)
        },
        onDone: () => {
          setPending(false)
          onDone?.(bufferRef.current.trim())
        },
        onError: (msg) => {
          setPending(false)
          toast.error(msg || 'AI 生成失败')
        },
      },
    )
  }, [])

  return { generate, isPending }
}
