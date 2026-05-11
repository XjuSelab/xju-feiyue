"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Force theme="light": the site has no dark mode, and letting sonner fall back
// to "system" resolves to dark in some headless/CI browsers → black toast.
// Background/text/border use this project's tokens (bg-bg / text-text /
// border-border), not shadcn's bg-background / text-foreground, so the surface
// matches the rest of Feiyue (cream-paper, not stark white/black).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-bg group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-card",
          description: "group-[.toast]:text-text-muted",
          actionButton:
            "group-[.toast]:bg-text group-[.toast]:text-bg",
          cancelButton:
            "group-[.toast]:bg-bg-subtle group-[.toast]:text-text-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
