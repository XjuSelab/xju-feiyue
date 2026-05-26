import { ExternalLink } from 'lucide-react'
import type { Conference } from '../../types'

/** 官网（未发布则禁用占位）+ DBLP 链接。 */
export function LinksCell({ conf }: { conf: Conference }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {conf.homepage ? (
        <a
          href={conf.homepage}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm border border-text bg-text px-[9px] py-1 font-sans text-[12px] leading-[1.4] text-white transition-colors hover:bg-[#2A2825]"
        >
          官网 <ExternalLink size={11} strokeWidth={1.8} aria-hidden />
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex cursor-not-allowed items-center gap-1 rounded-sm border border-border bg-bg-subtle px-[9px] py-1 font-sans text-[12px] leading-[1.4] text-text-faint opacity-70"
        >
          官网未发布
        </span>
      )}
      {conf.dblp && (
        <a
          href={conf.dblp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm border border-transparent px-[9px] py-1 font-sans text-[12px] leading-[1.4] text-text-muted transition-colors hover:border-border hover:bg-bg-subtle hover:text-text"
        >
          DBLP <ExternalLink size={11} strokeWidth={1.8} aria-hidden />
        </a>
      )}
    </div>
  )
}
