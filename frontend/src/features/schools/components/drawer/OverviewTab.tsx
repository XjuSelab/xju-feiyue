import { useState } from 'react'
import { ExternalLink, Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Advisor } from '../../types'
import { EmailCell } from '../cells/EmailCell'

interface OverviewTabProps {
  advisor: Advisor
}

export function OverviewTab({ advisor: a }: OverviewTabProps) {
  const [bioOpen, setBioOpen] = useState(false)

  return (
    <>
      {a.enriched_summary ? (
        <div className="mb-[18px] rounded-md border-l-[3px] border-text bg-bg-subtle px-4 py-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            <Info size={12} strokeWidth={1.8} />
            投递参考
          </div>
          <div className="font-serif text-[14px] leading-[1.65] text-text">
            {a.enriched_summary}
          </div>
        </div>
      ) : (
        <div className="mb-[18px] rounded-md border-l-[3px] border-border-strong bg-bg-subtle px-4 py-3.5">
          <div className="mb-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            投递参考
          </div>
          <div className="font-sans text-[13px] italic text-text-faint">
            该导师未调研 / 调研无结论
          </div>
        </div>
      )}

      <Section title="联系方式">
        <Kv k="邮箱">
          <EmailCell email={a.email ?? null} obfuscated={a.email_obfuscated} />
        </Kv>
        <Kv k="电话">
          {a.phone ? (
            <span className="font-mono text-[12px] text-text">{a.phone}</span>
          ) : (
            <span className="italic text-text-faint">— 未公开</span>
          )}
        </Kv>
        <Kv k="个人主页">
          <a
            href={a.homepage}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-link"
          >
            {a.homepage} <ExternalLink size={12} strokeWidth={1.8} />
          </a>
        </Kv>
        <Kv k="原始爬取页">
          <a
            href={a.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-link"
          >
            {a.source_url} <ExternalLink size={12} strokeWidth={1.8} />
          </a>
        </Kv>
      </Section>

      <Section title="研究方向">
        {a.research_interests.length > 0 ? (
          <div className="flex flex-wrap items-center gap-[3px]">
            {a.research_interests.map((r, i) => (
              <span
                key={i}
                className="inline-flex rounded-[3px] bg-bg-subtle px-[9px] py-0.5 font-sans text-[12.5px] leading-[1.6] text-text-muted"
              >
                {r}
              </span>
            ))}
          </div>
        ) : (
          <span className="font-sans text-[11.5px] italic text-text-faint">未填</span>
        )}
      </Section>

      <Section title="个人简介">
        {a.bio_text ? (
          bioOpen ? (
            <>
              <div className="mt-1.5 rounded-md bg-bg-subtle px-3.5 py-2.5 font-serif text-[13.5px] leading-[1.65] text-text">
                {a.bio_text}
              </div>
              <button
                type="button"
                onClick={() => setBioOpen(false)}
                className="mt-1.5 inline-flex cursor-pointer items-center gap-0.5 font-sans text-[12px] text-link hover:underline"
              >
                收起
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setBioOpen(true)}
              className="inline-flex cursor-pointer items-center gap-0.5 font-sans text-[12px] text-link hover:underline"
            >
              展开简介({a.bio_text.length} 字) ↓
            </button>
          )
        ) : (
          <span className="font-sans text-[11.5px] italic text-text-faint">未抓取到</span>
        )}
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
        {title}
      </div>
      {children}
    </div>
  )
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 border-b border-border py-1.5 font-sans text-[13px] last:border-b-0',
      )}
    >
      <span className="text-text-muted">{k}</span>
      <span className="break-all text-text">{children}</span>
    </div>
  )
}
