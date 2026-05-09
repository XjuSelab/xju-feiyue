export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="flex h-[60px] items-center justify-center border-t border-border text-xs text-text-faint"
    >
      LabNotes · 实验室经验共享 · {new Date().getFullYear()}
    </footer>
  )
}
