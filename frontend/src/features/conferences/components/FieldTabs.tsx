import { cn } from '@/lib/cn'
import { CCF_FIELDS } from '../data'
import type { FieldId } from '../types'

interface FieldTabsProps {
  value: FieldId | 'all'
  onChange: (v: FieldId | 'all') => void
  countsByField: Record<string, number>
  total: number
}

// 圆角矩形按钮（可多行换行），替代原先横向滚动的下划线 tab 条。
const pill = (on: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-sans text-[13px] font-medium leading-none transition-colors duration-75',
    on
      ? 'border-text bg-text text-white'
      : 'border-border bg-bg text-text-muted hover:border-border-strong hover:text-text',
  )

export function FieldTabs({ value, onChange, countsByField, total }: FieldTabsProps) {
  const count = (n: number, on: boolean) => (
    <span className={cn('font-mono text-[11px]', on ? 'text-white/65' : 'text-text-faint')}>
      {n}
    </span>
  )

  return (
    <div className="mb-3.5 flex flex-wrap gap-2">
      <button type="button" onClick={() => onChange('all')} className={pill(value === 'all')}>
        全部 {count(total, value === 'all')}
      </button>
      {CCF_FIELDS.map((f) => {
        const on = value === f.id
        return (
          <button key={f.id} type="button" onClick={() => onChange(f.id)} className={pill(on)}>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: f.color }} />
            {f.name_cn}
            {count(countsByField[f.id] || 0, on)}
          </button>
        )
      })}
    </div>
  )
}
