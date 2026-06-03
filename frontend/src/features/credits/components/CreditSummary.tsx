import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fmtCredit } from '../lib/rules'
import type { CreditReport } from '../types'

/** 顶部总览：总体结论 + 五模块学分一览 + 未达标原因。 */
export function CreditSummary({ report }: { report: CreditReport }) {
  const { passed, modules, failedReasons, records } = report
  return (
    <div
      className={cn(
        'rounded-xl border p-5',
        passed
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-red-500/40 bg-red-500/5',
      )}
    >
      <div className="flex items-center gap-3">
        {passed ? (
          <CheckCircle2
            className="size-7 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        ) : (
          <XCircle
            className="size-7 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden
          />
        )}
        <div>
          <p className="text-lg font-semibold text-text">
            {passed
              ? '通识选修要求：全部达标'
              : `通识选修要求：${failedReasons.length} 项未达标`}
          </p>
          <p className="text-xs text-text-muted">
            共统计 {records.length} 门通识选修课程，按「获得学分」判定
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {modules.map((m) => (
          <div
            key={m.module}
            className="rounded-lg border border-border bg-bg p-3 text-center"
          >
            <p className="text-xs text-text-muted">模块{m.module}</p>
            <p
              className={cn(
                'text-xl font-semibold tabular-nums',
                m.passed
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {fmtCredit(m.earnedCredits)}
            </p>
            <p className="text-[11px] text-text-faint">
              {m.required ? `需 ≥${m.minCredits}` : '选修'}
            </p>
          </div>
        ))}
      </div>

      {!passed && (
        <ul className="mt-4 space-y-1 text-sm text-red-600 dark:text-red-400">
          {failedReasons.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
