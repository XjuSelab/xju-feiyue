import { useState, type MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmailCellProps {
  email?: string | null
  obfuscated: boolean
}

export function EmailCell({ email, obfuscated }: EmailCellProps) {
  const [copied, setCopied] = useState(false)

  if (!email) {
    return (
      <span className="font-sans text-[11.5px] italic text-text-faint">
        {obfuscated ? '— 邮箱混淆' : '— 未公开'}
      </span>
    )
  }

  const onClick = (e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <span
      onClick={onClick}
      title={`复制 ${email}`}
      className={cn(
        'inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-[4px] px-[7px] py-[3px] font-mono text-[11.5px] transition-colors',
        copied ? 'bg-tag-tools text-cat-tools' : 'bg-bg-subtle text-text hover:bg-bg-hover',
      )}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{email}</span>
      <span
        className={cn(
          'flex-none transition-opacity',
          copied ? 'text-cat-tools opacity-100' : 'opacity-50 group-hover:opacity-100',
        )}
      >
        {copied ? <Check size={11} strokeWidth={2.2} /> : <Copy size={11} strokeWidth={1.8} />}
      </span>
    </span>
  )
}
