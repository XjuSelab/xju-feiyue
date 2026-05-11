export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="flex h-[60px] items-center justify-center border-t border-border text-xs text-text-faint"
    >
      Feiyue · 新疆大学飞跃手册 · {new Date().getFullYear()}
    </footer>
  )
}
