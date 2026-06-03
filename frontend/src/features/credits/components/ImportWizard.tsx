import { useEffect, useState } from 'react'
import { Check, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import {
  IMPORT_USERJS_URL,
  JWXT_LOGIN_URL,
  SCRIPTCAT_HOME_URL,
} from '../lib/bookmarklet'
import {
  detectInstallState,
  isImporterInstalled,
  type InstallState,
} from '../lib/userscriptManager'

const STATE_STEP: Record<InstallState, number> = { none: 0, manager: 1, ready: 2 }
const POLL_MS = 1500

/**
 * 「从教务系统导入」引导向导。打开后**轮询检测**安装进度，自动逐级前进：
 *   ① 没有脚本猫 → 打开脚本猫官网安装
 *   ② 有脚本猫、没导入脚本 → 打开安装「导入飞跃」脚本
 *   ③ 都就绪 → 打开教务系统(webvpn) + 引导登录、点右下角【导入飞跃】按钮
 * 浏览器禁止无手势自动开标签，所以每步给一个按钮（用户点一下打开），检测到装好就自动跳下一步；
 * 篡改猴等无法固定 URL 探测的管理器，给「手动下一步」兜底。
 * 用户回到本页后由 CreditsPage 的可见性轮询自动取回并解析（带动画），向导随之关闭。
 */
export function ImportWizard({
  open,
  onOpenChange,
  onGoExport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 用户点「打开教务系统」时调用：开始等待回传（同时仍由可见性轮询兜底）。 */
  onGoExport: () => void
}) {
  // null = 检测中；只前进不后退（装好后别因抖动回退）。
  const [state, setState] = useState<InstallState | null>(null)

  // 只前进的状态推进。
  const advance = (to: InstallState) =>
    setState((prev) => (prev && STATE_STEP[to] < STATE_STEP[prev] ? prev : to))

  useEffect(() => {
    if (!open) {
      setState(null)
      return
    }
    let alive = true
    // 完整探测含 chrome-extension fetch（探不到会在 console 留 net::ERR_FAILED），
    // 故只在「打开」和「切回本标签页」时跑——用户去装脚本/扩展多在别的标签，切回即重测。
    const full = () => {
      void detectInstallState().then((s) => {
        if (alive) advance(s)
      })
    }
    // 轻量探测只读「自报」(无 fetch、无噪声)，定时跑以便脚本装好即自动进入第三步。
    const cheap = () => {
      if (alive && isImporterInstalled()) advance('ready')
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') full()
    }
    full()
    const timer = window.setInterval(cheap, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [open])

  const openTab = (url: string) => window.open(url, '_blank', 'noopener')
  const cur = state ? STATE_STEP[state] : -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>从教务系统自动导入成绩单</DialogTitle>
          <DialogDescription>
            用你已登录的教务会话在网页里导出成绩单并回传，全程不碰密码。按下面的引导走，装好一步自动跳下一步。
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-3">
          <Step
            index={0}
            cur={cur}
            title="安装脚本猫"
            detecting={state === null}
          >
            <p className="text-text-muted">
              飞跃用「脚本猫」（也兼容篡改猴 / 暴力猴）在教务系统页注入导出按钮。
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                size="sm"
                onClick={() => openTab(SCRIPTCAT_HOME_URL)}
              >
                <ExternalLink aria-hidden /> 打开脚本猫官网
              </Button>
              <button
                type="button"
                onClick={() => advance('manager')}
                className="text-xs text-text-faint hover:text-text-muted hover:underline"
              >
                已装好脚本猫？手动下一步
              </button>
            </div>
            <p className="text-text-faint">装好后这里会自动进入下一步。</p>
          </Step>

          <Step index={1} cur={cur} title="安装「导入飞跃」脚本">
            <p className="text-text-muted">
              点下面按钮，脚本管理器会弹出安装确认，点【安装】即可（以后自动更新）。
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                size="sm"
                onClick={() =>
                  openTab(new URL(IMPORT_USERJS_URL, location.origin).href)
                }
              >
                <Download aria-hidden /> 打开安装脚本
              </Button>
              <button
                type="button"
                onClick={() => advance('ready')}
                className="text-xs text-text-faint hover:text-text-muted hover:underline"
              >
                已安装？手动下一步
              </button>
            </div>
            <p className="text-text-faint">安装成功后自动进入下一步。</p>
          </Step>

          <Step index={2} cur={cur} title="去教务系统导出">
            <p className="text-text-muted">
              打开教务系统并登录，然后：
            </p>
            <ol className="ml-4 list-decimal space-y-1 text-text-muted">
              <li>进入「成绩查询」页面；</li>
              <li>
                点页面<strong className="text-text">右下角</strong>的绿色按钮
                <span className="mx-1 inline-flex items-center gap-1 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-2 py-0.5 align-middle text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <Download className="size-3" aria-hidden />
                  导入飞跃 · 成绩单
                </span>
                ；
              </li>
              <li>
                回到<strong className="text-text">本页面</strong>，报告会自动出现。
              </li>
            </ol>
            <Button
              size="sm"
              onClick={() => {
                openTab(JWXT_LOGIN_URL)
                onGoExport()
              }}
            >
              <ExternalLink aria-hidden /> 打开教务系统（webvpn）
            </Button>
          </Step>
        </ol>
      </DialogContent>
    </Dialog>
  )
}

/** 单个步骤行：序号/对勾 + 标题 + 仅当前步展开内容。 */
function Step({
  index,
  cur,
  title,
  detecting,
  children,
}: {
  index: number
  cur: number
  title: string
  detecting?: boolean
  children: React.ReactNode
}) {
  const done = cur > index
  const active = cur === index
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
          done && 'border-emerald-600/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          active && 'border-text bg-text text-bg',
          !done && !active && 'border-border text-text-faint',
        )}
      >
        {done ? (
          <Check className="size-3.5" aria-hidden />
        ) : active && detecting ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          index + 1
        )}
      </span>
      <div className="flex-1 pb-1">
        <p
          className={cn(
            'text-sm font-medium',
            active ? 'text-text' : 'text-text-muted',
          )}
        >
          {title}
        </p>
        {active && (
          <div className="mt-2 flex flex-col gap-2 text-xs">{children}</div>
        )}
      </div>
    </li>
  )
}
