'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Site-wide Sonner toaster — mounted once in App.tsx.
 *
 * Keep customization minimal: only retint the surface to match the
 * design tokens. Over-aggressive className overrides in earlier
 * iterations interfered with sonner's internal layout and the toast
 * <ol> never made it to the DOM at all.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    // @ts-expect-error shadcn-generated: theme prop required but useTheme() may yield undefined under exactOptionalPropertyTypes
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-bg group-[.toaster]:text-text group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-md',
          description: 'group-[.toast]:text-text-muted',
          actionButton:
            'group-[.toast]:bg-text group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-bg-subtle group-[.toast]:text-text-muted',
        },
      }}
      // 320 px keeps toasts unobtrusive at the bottom-right corner.
      style={{ '--width': '320px' } as React.CSSProperties}
      {...props}
    />
  )
}

export { Toaster }
