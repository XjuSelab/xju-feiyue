interface SummaryCellProps {
  text?: string | null
}

export function SummaryCell({ text }: SummaryCellProps) {
  if (!text) {
    return <span className="font-sans text-[11.5px] italic text-text-faint">未调研</span>
  }
  return (
    <div
      title={text}
      className="cursor-help overflow-hidden font-serif text-[13px] leading-[1.5] text-text"
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}
    >
      {text}
    </div>
  )
}
