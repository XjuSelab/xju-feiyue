import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAICompose as useAIComposeMutation } from '@/api'

/**
 * Thin wrapper around the AI compose mutation for the summarize mode.
 * Kept separate from useAICompose so summary generation doesn't pollute
 * the AIDrawer's active/history state (those are for the diff workflow).
 */
export function useSummaryCompose() {
  const mutation = useAIComposeMutation()

  const generate = useCallback(
    (content: string, maxChars: number, onDone: (after: string) => void) => {
      if (!content.trim()) {
        toast.error('请先填写正文，再让 AI 总结')
        return
      }
      mutation.mutate(
        { mode: 'summarize', text: content, options: { maxChars } },
        {
          onSuccess: (resp) => onDone(resp.after.trim()),
          onError: (err) => toast.error(err instanceof Error ? err.message : 'AI 生成失败'),
        },
      )
    },
    [mutation],
  )

  return { generate, isPending: mutation.isPending }
}
