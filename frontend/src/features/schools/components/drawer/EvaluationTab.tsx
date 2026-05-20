import { useState } from 'react'
import { AlertCircle, ExternalLink } from 'lucide-react'
import type { Evaluation } from '../../types'

interface EvaluationTabProps {
  evaluations: Evaluation[]
}

export function EvaluationTab({ evaluations }: EvaluationTabProps) {
  const groups: Record<string, Evaluation[]> = {}
  evaluations.forEach((e) => {
    ;(groups[e.source] = groups[e.source] || []).push(e)
  })
  const sourceKeys = Object.keys(groups)

  return (
    <>
      <Disclaimer />
      {sourceKeys.length === 0 ? (
        <div className="rounded-md bg-bg-subtle px-3 py-8 text-center font-sans text-[13px] text-text-faint">
          尚未抓到网络评价
        </div>
      ) : (
        sourceKeys.map((src) => (
          <div key={src} className="mb-[18px]">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-[4px] bg-bg-subtle px-2 py-0.5 font-mono text-[11.5px] font-medium text-text">
                {src}
              </span>
              <span className="font-mono text-[11px] text-text-faint">{groups[src].length} 条</span>
            </div>
            {groups[src].map((ev, i) => (
              <EvalCard key={i} ev={ev} />
            ))}
          </div>
        ))
      )}
    </>
  )
}

function Disclaimer() {
  return (
    <div className="mb-3.5 flex items-start gap-2 rounded-md border border-[rgba(217,115,13,0.20)] bg-[rgba(217,115,13,0.08)] px-3 py-2.5 font-sans text-[12px] leading-[1.55] text-cat-course">
      <AlertCircle size={14} strokeWidth={1.8} className="mt-px flex-none" />
      <span>以下为网络公开评论,仅供个人参考,请结合多渠道判断。</span>
    </div>
  )
}

function EvalCard({ ev }: { ev: Evaluation }) {
  const [expanded, setExpanded] = useState(false)
  const long = ev.content.length > 240
  const display = expanded || !long ? ev.content : ev.content.slice(0, 240) + '…'
  return (
    <div className="mb-2 rounded-md border border-border bg-bg px-3.5 py-3 font-serif text-[13.5px] leading-[1.6]">
      <div>{display}</div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 cursor-pointer font-sans text-[12px] text-link hover:underline"
        >
          {expanded ? '收起' : `展开全文(${ev.content.length} 字)`}
        </button>
      )}
      <div className="mt-2.5 flex items-center gap-2.5 font-sans text-[11.5px] text-text-faint">
        {ev.posted_at && <span>{ev.posted_at}</span>}
        <a
          href={ev.source_url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-link"
        >
          原文 <ExternalLink size={12} strokeWidth={1.8} />
        </a>
      </div>
    </div>
  )
}
