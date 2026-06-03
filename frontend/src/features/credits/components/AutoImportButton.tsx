import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  FEIYUE_BOOKMARKLET,
  JWXT_GRADES_URL,
  JWXT_ORIGIN,
} from '../lib/bookmarklet'

type Phase = 'idle' | 'waiting' | 'pulling' | 'error'

/** 登录 + 拉取的宽限时限：超时则判失败。 */
const TIMEOUT_MS = 180_000

type Msg = {
  type?: string
  name?: string
  buf?: ArrayBuffer
  msg?: string
}

/**
 * 「从教务系统自动导入」：开 jwxt 标签 → 等书签 postMessage 回传 PDF → 交给 onFile 解析。
 * 状态：idle → waiting(转圈) → pulling(变绿+拉取) → 交接解析；失败/超时 → error(红+重试)。
 */
export function AutoImportButton({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void
  disabled?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [showHelp, setShowHelp] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  // React 屏蔽 javascript: href，用 setAttribute 绕过写入，使链接可拖到书签栏。
  useEffect(() => {
    linkRef.current?.setAttribute('href', FEIYUE_BOOKMARKLET)
  }, [showHelp, phase])

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== JWXT_ORIGIN) return
      const d = e.data as Msg | null
      if (!d || typeof d !== 'object') return
      if (d.type === 'feiyue-transcript-start') {
        setPhase('pulling')
      } else if (d.type === 'feiyue-transcript' && d.buf) {
        clearTimer()
        try {
          const file = new File([d.buf], d.name || '成绩单.pdf', {
            type: 'application/pdf',
          })
          setPhase('idle')
          setShowHelp(false)
          onFile(file)
        } catch {
          setPhase('error')
        }
      } else if (d.type === 'feiyue-transcript-error') {
        clearTimer()
        setPhase('error')
        toast.error(`教务系统导出失败：${d.msg || '未知错误'}`)
      }
    }
    window.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('message', onMsg)
      clearTimer()
    }
  }, [onFile, clearTimer])

  const start = useCallback(() => {
    setPhase('waiting')
    setShowHelp(true)
    // 不加 noopener：书签需要 window.opener 才能把 PDF postMessage 回来。
    window.open(JWXT_GRADES_URL, '_blank')
    clearTimer()
    timerRef.current = setTimeout(() => {
      setPhase((p) => (p === 'waiting' || p === 'pulling' ? 'error' : p))
    }, TIMEOUT_MS)
  }, [clearTimer])

  const busy = phase === 'waiting' || phase === 'pulling'

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {phase === 'error' ? (
        <Button
          type="button"
          variant="outline"
          onClick={start}
          className="border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
        >
          <RotateCcw aria-hidden /> 导入失败 · 重试
        </Button>
      ) : busy ? (
        <Button
          type="button"
          variant="outline"
          disabled
          className={cn(
            'disabled:opacity-100',
            phase === 'pulling' &&
              'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          )}
        >
          <Loader2 className="animate-spin" aria-hidden />
          {phase === 'pulling' ? '已连接 · 正在拉取成绩单…' : '等待教务系统登录…'}
        </Button>
      ) : (
        <Button type="button" onClick={start} disabled={disabled}>
          <Download aria-hidden /> 从教务系统自动导入
        </Button>
      )}

      {(busy || phase === 'error' || showHelp) && (
        <div className="max-w-xs rounded-lg border border-border bg-bg-subtle p-3 text-left text-xs text-text-muted">
          <p className="mb-1.5 font-medium text-text">使用步骤</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              首次使用：把
              <a
                ref={linkRef}
                href="#bookmarklet"
                draggable
                onClick={(e) => {
                  e.preventDefault()
                  void navigator.clipboard?.writeText(FEIYUE_BOOKMARKLET)
                  toast.success('已复制书签代码；也可直接把此链接拖到书签栏')
                }}
                className="mx-1 inline-flex items-center gap-1 rounded bg-bg px-1.5 py-0.5 font-medium text-link"
                title="拖到浏览器书签栏（或点击复制代码）"
              >
                <ExternalLink className="size-3" aria-hidden />
                导入飞跃
              </a>
              拖到书签栏
            </li>
            <li>新标签页登录教务系统，打开「查看成绩」页</li>
            <li>点书签「导入飞跃」→ 本页自动变绿并解析</li>
          </ol>
          <p className="mt-2 text-text-faint">
            若点书签后本页无反应（登录跳转可能切断回传），书签会自动改为下载 PDF，把它拖到下方上传区即可。
          </p>
        </div>
      )}
    </div>
  )
}
