import { cn } from '@/lib/cn'
import { CCF_FIELDS } from '../data'
import type { FieldId } from '../types'

interface FieldTabsProps {
  value: FieldId | 'all'
  onChange: (v: FieldId | 'all') => void
  countsByField: Record<string, number>
  total: number
}

export function FieldTabs({ value, onChange, countsByField, total }: FieldTabsProps) {
  const tabCls = (on: boolean) =>
    cn(
      'conf-field-tab relative inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-[13px] pb-3 pt-2 font-serif text-[16px] font-medium tracking-[-0.005em] transition-colors',
      on ? 'text-text' : 'text-text-muted hover:text-text',
    )
  const count = (n: number) => (
    <span className="align-[1px] font-mono text-[11px] text-text-faint">{n}</span>
  )

  return (
    <div className="conf-field-tabs mb-3.5 flex overflow-x-auto whitespace-nowrap border-b border-border">
      <button
        type="button"
        data-on={value === 'all' || undefined}
        onClick={() => onChange('all')}
        className={tabCls(value === 'all')}
      >
        全部 {count(total)}
      </button>
      {CCF_FIELDS.map((f) => (
        <button
          key={f.id}
          type="button"
          data-on={value === f.id || undefined}
          onClick={() => onChange(f.id)}
          className={tabCls(value === f.id)}
        >
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: f.color }} />
          {f.name_cn}
          {count(countsByField[f.id] || 0)}
        </button>
      ))}
    </div>
  )
}
