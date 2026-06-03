import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { FEIYUE_BOOKMARKLET, JWXT_LOGIN_URL } from '../lib/bookmarklet'
import { fetchStashedTranscript } from '../lib/stash'

type Phase = 'idle' | 'waiting' | 'pulling' | 'error'

const POLL_MS = 2500
const TIMEOUT_MS = 180_000

/**
 * 「从教务系统自动导入」（后端中转版）：点击 → 开 webvpn 登录页 + 轮询后端暂存件；
 * 你在 jwxt 成绩页点「导入飞跃」书签把 PDF 回传到后端 → 本页轮询取回 → 交给 onFile 解析。
 * 状态：idle → waiting(转圈轮询) → pulling(收到·变绿) → 交接解析；超时 → error(红+重试)。
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
  const stopRef = useRef(true)
  const deadlineRef = useRef(0)
  const linkRef = useRef<HTMLAnchorElement>(null)

  // React 屏蔽 javascript: href，用 setAttribute 绕过，使链接可拖到书签栏。
  useEffect(() => {
    linkRef.current?.setAttribute('href', FEIYUE_BOOKMARKLET)
  }, [showHelp, phase])

  // 卸载即停轮询。
  useEffect(
    () => () => {
      stopRef.current = true
    },
    [],
  )

  const poll = useCallback(async () => {
    if (stopRef.current) return
    if (Date.now() > deadlineRef.current) {
      stopRef.current = true
      setPhase('error')
      return
    }
    try {
      const file = await fetchStashedTranscript()
      if (stopRef.current) return
      if (file) {
        stopRef.current = true
        setPhase('pulling')
        setShowHelp(false)
        onFile(file)
        window.setTimeout(() => setPhase('idle'), 1500)
        return
      }
      // 暂无 → 继续轮询
    } catch {
      // 网络抖动 → 继续轮询
    }
    if (!stopRef.current) window.setTimeout(poll, POLL_MS)
  }, [onFile])

  const start = useCallback(() => {
    stopRef.current = false
    deadlineRef.current = Date.now() + TIMEOUT_MS
    setPhase('waiting')
    setShowHelp(true)
    // 不自动 window.open：深链/门户冷启动可能弹到打不开的 authserver 子域。
    // 改由用户用「打开教务系统」链接或自己常用方式登录；中转轮询不依赖由谁开标签。
    window.setTimeout(poll, POLL_MS)
  }, [poll])

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
          <RotateCcw aria-hidden /> 导入超时 · 重试
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
          {phase === 'pulling' ? '已收到成绩单 · 解析中…' : '等待教务系统回传…'}
        </Button>
      ) : (
        <Button type="button" onClick={start} disabled={disabled}>
          <Download aria-hidden /> 从教务系统自动导入
        </Button>
      )}

      {(busy || phase === 'error' || showHelp) && (
        <div className="max-w-xs rounded-lg border border-border bg-bg-subtle p-3 text-left text-xs text-text-muted">
          <p className="mb-1.5 font-medium text-text">一键导入（首次装一次，零设置）</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              安装{' '}
              <a
                href="https://www.tampermonkey.net/"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-link hover:underline"
              >
                Tampermonkey
              </a>
              （浏览器商店一键添加）
            </li>
            <li>
              点{' '}
              <a
                href="/import.user.js"
                className="font-medium text-link hover:underline"
              >
                安装「导入飞跃」脚本
              </a>
              （会弹出安装，之后自动更新）
            </li>
            <li>
              <a
                href={JWXT_LOGIN_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-link hover:underline"
              >
                登录教务系统
              </a>
              ，任意页面右下角点「📥 导入飞跃」→ 本页自动出报告
            </li>
          </ol>
          <details className="mt-2">
            <summary className="cursor-pointer text-text-faint">
              不想装扩展？改用书签
            </summary>
            <p className="mt-1">
              把
              <a
                ref={linkRef}
                href="#bookmarklet"
                draggable
                onClick={(e) => {
                  e.preventDefault()
                  void navigator.clipboard?.writeText(FEIYUE_BOOKMARKLET)
                }}
                className="mx-1 inline-flex items-center gap-1 rounded bg-bg px-1.5 py-0.5 font-medium text-link"
                title="拖到书签栏，或点击复制代码"
              >
                <ExternalLink className="size-3" aria-hidden />
                导入飞跃
              </a>
              拖到书签栏，登录教务成绩页后点它即可（效果相同）。
            </p>
          </details>
          <p className="mt-2 text-text-faint">
            全程不碰密码：只在你自己已登录的教务页面里导出，回传后本页自动取回。
          </p>
        </div>
      )}
    </div>
  )
}
