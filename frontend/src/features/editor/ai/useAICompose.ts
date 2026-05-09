import { useState, useCallback } from 'react'
import { useAICompose as useAIComposeMutation } from '@/api'
import type { AIComposeMode, AIComposeResponse } from '@/api/schemas/ai'
import { toast } from 'sonner'

export type ComposeHistoryItem = {
  id: string
  mode: AIComposeMode
  before: string
  after: string
  segments: AIComposeResponse['segments']
  elapsedMs: number
  at: number
}

export function useAICompose() {
  const mutation = useAIComposeMutation()
  const [history, setHistory] = useState<ComposeHistoryItem[]>([])
  const [active, setActive] = useState<ComposeHistoryItem | null>(null)

  const compose = useCallback(
    (
      mode: AIComposeMode,
      text: string,
      options?: Record<string, unknown>,
    ) => {
      if (!text.trim()) {
        toast.error('请先选中一段文字（≥ 4 字）')
        return
      }
      const requestBody = options
        ? { mode, text, options }
        : { mode, text }
      mutation.mutate(requestBody, {
        onSuccess: (resp) => {
          const item: ComposeHistoryItem = {
            id: `c_${Date.now().toString(36)}`,
            mode,
            before: resp.before,
            after: resp.after,
            segments: resp.segments,
            elapsedMs: resp.elapsedMs,
            at: Date.now(),
          }
          setHistory((h) => [item, ...h].slice(0, 20))
          setActive(item)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'AI 生成失败')
        },
      })
    },
    [mutation],
  )

  const restoreFromHistory = useCallback((id: string) => {
    setActive((cur) => {
      if (cur && cur.id === id) return null
      return null
    })
    setHistory((h) => {
      const found = h.find((i) => i.id === id)
      if (found) setActive(found)
      return h
    })
  }, [])

  return {
    compose,
    isPending: mutation.isPending,
    active,
    setActive,
    history,
    clearActive: () => setActive(null),
    restoreFromHistory,
  }
}
