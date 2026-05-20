import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Quota } from '../../types'

interface MatrixTabProps {
  quotas: Quota[]
  openQuota: string | null
  setOpenQuota: (k: string | null) => void
}

const YEARS = [2024, 2025, 2026]
const DEGREES: Array<'PhD' | 'MS' | 'Postdoc'> = ['PhD', 'MS', 'Postdoc']

export function MatrixTab({ quotas, openQuota, setOpenQuota }: MatrixTabProps) {
  if (quotas.length === 0) {
    return (
      <div className="rounded-md bg-bg-subtle px-3 py-8 text-center font-sans text-[13px] text-text-faint">
        该导师暂无招生矩阵数据(quota_info 表为空)
      </div>
    )
  }

  const lookup: Record<string, Quota> = {}
  quotas.forEach((q) => {
    lookup[`${q.year}-${q.degree}`] = q
  })

  const onCellClick = (year: number, degree: string) => {
    const key = `${year}-${degree}`
    setOpenQuota(openQuota === key ? null : key)
  }

  const opened = openQuota ? lookup[openQuota] : null

  return (
    <>
      <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-md border border-border font-sans text-[13px]">
        <thead>
          <tr>
            <Th first>学位</Th>
            {YEARS.map((y) => (
              <Th key={y}>{y}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEGREES.map((deg) => (
            <tr key={deg}>
              <td className="border-b border-border py-2.5 pl-3 pr-1.5 text-left align-middle font-medium text-text last:border-b-0">
                {deg}
              </td>
              {YEARS.map((y) => {
                const q = lookup[`${y}-${deg}`]
                return (
                  <td
                    key={y}
                    className="border-b border-border px-1.5 py-2.5 text-center align-middle text-text last:border-b-0"
                  >
                    {q ? (
                      <button
                        type="button"
                        onClick={() => onCellClick(y, deg)}
                        className="inline-flex cursor-pointer flex-col items-center gap-px rounded-[3px] px-1.5 py-1 transition-colors hover:bg-bg-subtle"
                      >
                        <span className="font-serif text-[15px] font-semibold">
                          {q.count == null ? '?' : q.count === 0 ? '0' : `${q.count}`}
                        </span>
                        {q.confidence != null && (
                          <span className="font-mono text-[10px] text-text-faint">
                            conf {(q.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {opened && (
        <div className="mt-2 rounded-md border-l-2 border-border-strong bg-bg-subtle px-3 py-2.5 font-sans text-[12.5px] leading-[1.55] text-text">
          <div className="mb-1 flex items-center gap-2 font-mono text-[10.5px] text-text-faint">
            <span>{openQuota?.replace('-', ' · ')}</span>
            {opened.confidence != null && <span>conf {(opened.confidence * 100).toFixed(0)}%</span>}
            <a
              href={opened.source_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-link"
            >
              原始链接 <ExternalLink size={12} strokeWidth={1.8} />
            </a>
          </div>
          <div>{opened.raw_text}</div>
        </div>
      )}
    </>
  )
}

function Th({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <th
      className={cn(
        'border-b border-border bg-bg-subtle px-1.5 py-2 text-center text-[11.5px] font-semibold uppercase tracking-[0.05em] text-text-muted',
        first && 'w-[80px] pl-3 text-left',
      )}
    >
      {children}
    </th>
  )
}
