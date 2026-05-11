"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Force theme="light": the site has no dark mode, and letting sonner fall back
// to "system" resolves to dark in some headless/CI browsers → black toast.
// Background/text/border use this project's tokens (bg-bg / text-text /
// border-border), not shadcn's bg-background / text-foreground, so the surface
// matches the rest of Feiyue (cream-paper, not stark white/black).
// `--width: 180px` ≈ half sonner's default (356px) — short copy like
// "登录成功" fits without wrap; longer error text wraps to a 2nd line,
// which is acceptable and still narrower than the old full-width chip.
const TOASTER_STYLE = { "--width": "180px" } as React.CSSProperties

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={TOASTER_STYLE}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-bg group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-card",
          description: "group-[.toast]:text-text-muted",
          actionButton:
            "group-[.toast]:bg-text group-[.toast]:text-bg",
          cancelButton:
            "group-[.toast]:bg-bg-subtle group-[.toast]:text-text-muted",
          // sonner's typed toasts (success/error/...) render an SVG icon
          // inside [data-icon]; the SVG uses currentColor, so tinting the
          // wrapper colors the checkmark.
          success: "[&_[data-icon]]:text-emerald-600",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
