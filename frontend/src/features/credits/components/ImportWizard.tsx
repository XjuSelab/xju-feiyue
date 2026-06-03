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
const POLL_MS = 2500

/**
 * 「从教务系统导入」引导向导。检测安装进度并自动逐级前进，但**检测只是加速、绝不阻塞**：
 *   ① 安装用户脚本管理器(推荐脚本猫,也支持篡改猴/暴力猴)
 *   ② 安装「导入飞跃」脚本
 *   ③ 去 WebVPN 导出 + 引导点右下角按钮
 * 自动前进的可靠信号:脚本猫/暴力猴(fetch 探测静态资源,含 Chrome+Edge 两个商店 ID)、
 * 我们的脚本自报(window.__feiyueImporterReady)。**篡改猴无法从网页探测** → 每步都给
 * 「手动下一步」,且文案说明,绝不会卡住。详见 lib/userscriptManager.ts。
 */
export function ImportWizard({
  open,
  onOpenChange,
  onGoExport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 用户点「打开 WebVPN」时调用：开始等待回传（同时仍由可见性轮询兜底）。 */
  onGoExport: () => void
}) {
  // null = 首检中；只前进不后退（装好后别因抖动回退）。
  const [state, setState] = useState<InstallState | null>(null)

  const advance = (to: InstallState) =>
    setState((prev) => (prev && STATE_STEP[to] < STATE_STEP[prev] ? prev : to))

  useEffect(() => {
    if (!open) {
      setState(null)
      return
    }
    let alive = true
    // 完整探测含 chrome-extension fetch(探不到会在 console 留 net::ERR,正常)。
    const full = () => {
      void detectInstallState().then((s) => {
        if (alive) advance(s)
      })
    }
    // 轻量:只读自报(无 fetch、无噪声)。
    const cheap = () => {
      if (alive && isImporterInstalled()) advance('ready')
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') full()
    }
    // 脚本(刚加载)主动自报 → 立即到就绪。
    const onReady = () => {
      if (alive) advance('ready')
    }
    full()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('feiyue:importer-ready', onReady)
    // 定时只读自报(无 fetch、无 console 噪声);管理器的 fetch 探测只在
    // 打开 / 切回标签页(onVisible) / 脚本自报(onReady)时跑 —— 装脚本猫多在新标签,
    // 回到本页即 focus 触发探测。装不上自动识别的(篡改猴)有「手动下一步」兜底。
    const timer = window.setInterval(cheap, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('feiyue:importer-ready', onReady)
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
            用你已登录的教务会话在网页里导出成绩单并回传，全程不碰密码。按下面的引导走，装好一步自动跳下一步（也可手动点「下一步」）。
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-3">
          <Step
            index={0}
            cur={cur}
            title="安装用户脚本管理器"
            detecting={state === null}
          >
            <p className="text-text-muted">
              需要一个用户脚本管理器在教务系统页注入导出按钮。推荐
              <strong className="text-text">脚本猫</strong>（也支持篡改猴 / 暴力猴）。
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button size="sm" onClick={() => openTab(SCRIPTCAT_HOME_URL)}>
                <ExternalLink aria-hidden /> 打开脚本猫官网
              </Button>
              <button
                type="button"
                onClick={() => advance('manager')}
                className="text-xs text-text-faint hover:text-text-muted hover:underline"
              >
                我已装好管理器，下一步
              </button>
            </div>
            <p className="text-text-faint">
              装脚本猫 / 暴力猴会自动识别并跳下一步；用篡改猴请点「下一步」。
            </p>
          </Step>

          <Step index={1} cur={cur} title="安装「导入飞跃」脚本">
            <p className="text-text-muted">
              点下面按钮，管理器会弹出安装确认，点【安装】即可（以后自动更新）。
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                size="sm"
                onClick={() =>
                  openTab(new URL(IMPORT_USERJS_URL, location.origin).href)
                }
              >
                <Download aria-hidden /> 安装脚本
              </Button>
              <button
                type="button"
                onClick={() => advance('ready')}
                className="text-xs text-text-faint hover:text-text-muted hover:underline"
              >
                已安装，下一步
              </button>
            </div>
            <p className="text-text-faint">安装完成后点「下一步」去导出。</p>
          </Step>

          <Step index={2} cur={cur} title="去 WebVPN 导出成绩单">
            <p className="text-text-muted">打开 WebVPN 并登录，然后：</p>
            <ol className="ml-4 list-decimal space-y-1 text-text-muted">
              <li>进入「本科生教学管理」页面；</li>
              <li>
                点页面<strong className="text-text">右下角</strong>的绿色按钮
                <span className="mx-1 inline-flex items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-500/10 px-2 py-0.5 align-middle text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
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
              <ExternalLink aria-hidden /> 打开 WebVPN
            </Button>
          </Step>
        </ol>

        {cur < 2 && (
          <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-text-faint">
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            正在自动检测脚本猫 / 暴力猴…装好会自动跳转；用篡改猴的话装好直接点「下一步」。
          </div>
        )}
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
