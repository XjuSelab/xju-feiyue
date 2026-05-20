import { cn } from '@/lib/cn'

interface RecruitCellProps {
  status: boolean | null
}

export function RecruitCell({ status }: RecruitCellProps) {
  const label = status === true ? '招生' : status === false ? '不招' : '未知'
  const klass =
    status === true
      ? 'bg-tag-tools text-cat-tools'
      : status === false
        ? 'bg-[rgba(224,62,62,0.10)] text-cat-research'
        : 'bg-bg-subtle text-text-muted'

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-[5px] rounded-[4px] px-2 py-px font-sans text-[11.5px] font-medium leading-[1.6]',
        klass,
      )}
    >
      <span className="h-[6px] w-[6px] rounded-full bg-current" />
      {label}
    </span>
  )
}
