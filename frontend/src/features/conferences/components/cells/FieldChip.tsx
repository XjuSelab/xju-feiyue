import { fieldOf } from '../../classify'
import type { FieldId } from '../../types'

export function FieldChip({ field }: { field: FieldId }) {
  const f = fieldOf(field)
  if (!f) return null
  return (
    <span
      title={f.name_cn}
      className="inline-flex items-center gap-1.5 rounded-[4px] bg-bg-subtle py-0.5 pl-1.5 pr-2 font-sans text-[11.5px] leading-[1.6] text-text"
    >
      <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: f.color }} />
      {f.short}
    </span>
  )
}
