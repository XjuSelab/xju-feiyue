import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ADVISORY_NOTES } from '../data'
import { fmtCredit } from '../lib/rules'
import type { CreditReport } from '../types'

type Check = { label: string; ok: boolean; detail: string }

/** 达标检查清单：逐条规则 ✓/✗ + 无法核验的提示项。 */
export function RequirementChecklist({ report }: { report: CreditReport }) {
  const checks: Check[] = []
  for (const m of report.modules) {
    if (m.required) {
      checks.push({
        label: `模块${m.module} 获得学分 ≥ ${m.minCredits}`,
        ok: m.meetsMin,
        detail: `${fmtCredit(m.earnedCredits)} 学分`,
      })
    }
    for (const s of m.specials) {
      checks.push({
        label: `模块${m.module} 含${s.label} ≥ ${s.minCredits} 学分`,
        ok: s.passed,
        detail: `${fmtCredit(s.matchedCredits)} 学分`,
      })
    }
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="mb-3 text-sm font-semibold text-text">达标检查清单</h2>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2">
              {c.ok ? (
                <CheckCircle2
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              ) : (
                <XCircle
                  className="size-4 shrink-0 text-red-600 dark:text-red-400"
                  aria-hidden
                />
              )}
              <span className="text-text">{c.label}</span>
            </span>
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                c.ok ? 'text-text-muted' : 'text-red-600 dark:text-red-400',
              )}
            >
              {c.detail}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5 border-t border-border pt-3">
        {ADVISORY_NOTES.map((n) => (
          <p
            key={n}
            className="flex items-start gap-2 text-xs text-text-faint"
          >
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{n}</span>
          </p>
        ))}
      </div>
    </section>
  )
}
