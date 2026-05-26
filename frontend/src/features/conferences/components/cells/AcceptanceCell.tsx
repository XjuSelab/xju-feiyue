import type { Conference } from '../../types'

/** 录取统计：接受率 + 投稿/接受数 + 数据来源年份；缺数据显示 —。 */
export function AcceptanceCell({ conf }: { conf: Conference }) {
  const { submissions: sub, accepted: acc, acceptance_rate, stats_year: yr } = conf
  const rate =
    acceptance_rate ??
    (sub != null && acc != null && sub > 0 ? Math.round((acc / sub) * 1000) / 10 : null)

  if (rate == null && sub == null && acc == null) {
    return <span className="font-sans text-[12px] italic text-text-faint">—</span>
  }
  return (
    <div className="flex flex-col gap-0.5 font-mono text-[11.5px]">
      {rate != null && <span className="text-[13px] font-medium text-text">{rate}%</span>}
      {sub != null && acc != null && (
        <span className="text-text-muted">
          {sub.toLocaleString()} 投 · {acc.toLocaleString()} 收
        </span>
      )}
      {yr != null && <span className="text-text-faint">{yr} 数据</span>}
    </div>
  )
}
