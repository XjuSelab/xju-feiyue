import { useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import type { Advisor } from '../../types'
import { formatRelTime } from '../../data'
import { REP_LABEL } from '../cells/rep-meta'
import { OverviewTab } from './OverviewTab'
import { MatrixTab } from './MatrixTab'
import { EvaluationTab } from './EvaluationTab'
import { TraceTab } from './TraceTab'

type DrawerTab = 'overview' | 'matrix' | 'eval' | 'trace'

interface AdvisorDrawerProps {
  advisor: Advisor | null
  onClose: () => void
}

const REP_BIG_BADGE: Record<string, string> = {
  positive: 'bg-tag-tools text-cat-tools',
  neutral: 'bg-bg-subtle text-text-muted',
  unknown: 'bg-bg-subtle text-text-faint',
  negative: 'bg-cat-research text-white',
}

export function AdvisorDrawer({ advisor, onClose }: AdvisorDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview')
  const [openQuota, setOpenQuota] = useState<string | null>(null)

  const open = advisor !== null

  useEffect(() => {
    if (advisor) {
      setTab('overview')
      setOpenQuota(null)
    }
    // identity comparison via id is intentional — we only want to reset
    // when switching to a different advisor, not on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisor?.id])

  if (!advisor) {
    return (
      <Sheet open={false} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" />
      </Sheet>
    )
  }

  const a = advisor

  const recLabel = a.is_recruiting === true ? '招生' : a.is_recruiting === false ? '不招' : '未知'
  const recKlass =
    a.is_recruiting === true
      ? 'bg-tag-tools text-cat-tools'
      : a.is_recruiting === false
        ? 'bg-[rgba(224,62,62,0.10)] text-cat-research'
        : 'bg-bg-subtle text-text-muted'
  const repTag = a.reputation_tag || 'unknown'

  const tabs: { k: DrawerTab; l: string; c?: number }[] = [
    { k: 'overview', l: '概览' },
    { k: 'matrix', l: '招生矩阵', c: a.quotas.length },
    { k: 'eval', l: '评价证据', c: a.evaluations.length },
    { k: 'trace', l: '调研轨迹', c: (a.trace || []).length },
  ]

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-[min(520px,92vw)] max-w-none flex-col gap-0 border-l border-border bg-bg p-0 shadow-[-8px_0_32px_rgba(0,0,0,0.08)] sm:max-w-none"
      >
        <SheetTitle className="sr-only">{a.name_cn} 详情</SheetTitle>
        <SheetDescription className="sr-only">导师详情抽屉</SheetDescription>

        <div className="flex-none border-b border-border">
          <div className="flex items-start gap-3.5 px-5 pb-4 pt-5">
            <div className="min-w-0 flex-1">
              <h2 className="m-0 mb-0.5 font-serif text-[22px] font-semibold tracking-[-0.01em] text-text">
                {a.name_cn}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-sans text-[12.5px] text-text-muted">
                <span className="font-medium text-text">{a.school.name_cn}</span>
                {a.departments.map((d) => (
                  <span key={d.code}>· {d.name_cn}</span>
                ))}
                {a.title && <span>· {a.title}</span>}
              </div>
            </div>
            <DialogPrimitive.Close
              aria-label="关闭"
              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-sm bg-transparent text-text-muted transition-colors hover:bg-bg-subtle hover:text-text"
            >
              <X size={16} strokeWidth={1.8} />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pb-3.5">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-sans text-[12.5px] font-medium',
                recKlass,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {recLabel}
              {a.recruiting_confidence != null && (
                <span className="font-mono text-[11px] opacity-75">
                  · {(a.recruiting_confidence * 100).toFixed(0)}%
                </span>
              )}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-sans text-[12.5px] font-medium',
                REP_BIG_BADGE[repTag],
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {REP_LABEL[repTag as keyof typeof REP_LABEL]}
            </span>
            {a.last_enriched_at && (
              <span className="self-center font-mono text-[11px] text-text-faint">
                调研于 {formatRelTime(a.last_enriched_at)}
              </span>
            )}
          </div>

          <div className="flex gap-0 border-b border-border px-3.5">
            {tabs.map((t) => {
              const on = tab === t.k
              return (
                <button
                  type="button"
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  data-on={on || undefined}
                  className={cn(
                    'schools-dr-tab relative cursor-pointer px-3 py-2.5 font-sans text-[12.5px] font-medium transition-colors',
                    on ? 'text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {t.l}
                  {t.c != null && t.c > 0 && (
                    <span
                      className={cn(
                        'ml-1 rounded-[3px] bg-bg-subtle px-1.5 py-px font-mono text-[10.5px]',
                        on ? 'text-text-muted' : 'text-text-faint',
                      )}
                    >
                      {t.c}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="schools-dr-body flex-1 overflow-y-auto px-5 pb-8 pt-4">
          {tab === 'overview' && <OverviewTab advisor={a} />}
          {tab === 'matrix' && (
            <MatrixTab quotas={a.quotas} openQuota={openQuota} setOpenQuota={setOpenQuota} />
          )}
          {tab === 'eval' && <EvaluationTab evaluations={a.evaluations} />}
          {tab === 'trace' && <TraceTab trace={a.trace || []} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
