import { CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { fmtCredit } from '../lib/rules'
import type { ModuleStat } from '../types'

/** 单模块卡片：学分进度条 + 特殊要求行 + 选课明细。 */
export function ModuleCard({ stat }: { stat: ModuleStat }) {
  const { module, name, earnedCredits, minCredits, meetsMin, records, specials, passed } =
    stat
  const ratio =
    minCredits > 0
      ? Math.min(100, (earnedCredits / minCredits) * 100)
      : earnedCredits > 0
        ? 100
        : 0

  return (
    <Card className={cn('flex flex-col', !passed && 'border-red-500/40')}>
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-lg font-semibold text-text">
              模块{module}
            </span>
            {name && <span className="text-xs text-text-muted">{name}</span>}
          </div>
          {passed ? (
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            >
              达标
            </Badge>
          ) : (
            <Badge variant="destructive">未达标</Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'text-2xl font-bold tabular-nums',
              meetsMin ? 'text-text' : 'text-red-600 dark:text-red-400',
            )}
          >
            {fmtCredit(earnedCredits)}
          </span>
          <span className="text-sm text-text-faint">
            / {minCredits > 0 ? `${minCredits} 学分` : '选修'}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              meetsMin ? 'bg-emerald-500' : 'bg-red-500',
            )}
            style={{ width: `${ratio}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        {specials.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-bg-subtle p-2.5">
            {specials.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  {s.passed ? (
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : (
                    <XCircle
                      className="size-3.5 shrink-0 text-red-600 dark:text-red-400"
                      aria-hidden
                    />
                  )}
                  <span className="text-text-muted">
                    {s.label} ≥{s.minCredits}
                  </span>
                </span>
                <span
                  className={cn(
                    'tabular-nums',
                    s.passed
                      ? 'text-text-muted'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {fmtCredit(s.matchedCredits)}
                </span>
              </div>
            ))}
          </div>
        )}

        {records.length > 0 ? (
          <ul className="space-y-2">
            {records.map((r, i) => (
              <li key={`${r.course}-${i}`} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text">{r.displayName}</span>
                  <span className="shrink-0 tabular-nums text-text-muted">
                    {fmtCredit(r.earnedCredit)} 学分
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-text-faint">
                  {r.grade && <span>{r.grade}</span>}
                  {r.grade && <span aria-hidden>·</span>}
                  <span className="truncate">{r.semester}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">
            未选修该模块课程
          </p>
        )}
      </CardContent>
    </Card>
  )
}
