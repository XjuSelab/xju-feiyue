'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Site-wide Sonner toaster.
 *
 * Visual rules (kept in lock-step with the rest of the design system):
 * - Width: 320 px — narrower than sonner's default ~356 px so it doesn't
 *   crowd corner content.
 * - Surface: `bg-bg` + `border-border` so toasts look like the rest of
 *   our cards / popovers; no shadcn `bg-background` mismatch.
 * - Status: skip sonner's `richColors` flood-fill (too pop-up-y); convey
 *   variant via a 2 px left-border accent + the leading icon's color.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    // @ts-expect-error shadcn-generated: theme prop required but useTheme() may yield undefined under exactOptionalPropertyTypes
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={{ '--width': '320px' } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast: [
            'group toast',
            'group-[.toaster]:!bg-bg group-[.toaster]:!text-text',
            'group-[.toaster]:!border group-[.toaster]:!border-border',
            'group-[.toaster]:!rounded-md group-[.toaster]:!shadow-md',
            'group-[.toaster]:!px-3 group-[.toaster]:!py-2.5',
            'group-[.toaster]:!gap-2',
            // Left-edge accent — overridden by variant classNames below.
            'group-[.toaster]:!border-l-2',
          ].join(' '),
          title: 'group-[.toast]:!text-sm group-[.toast]:!font-medium',
          description: 'group-[.toast]:!text-xs group-[.toast]:!text-text-muted',
          icon: 'group-[.toast]:!size-4 group-[.toast]:!shrink-0',
          actionButton:
            'group-[.toast]:!bg-text group-[.toast]:!text-white group-[.toast]:!text-xs group-[.toast]:!rounded-sm group-[.toast]:!px-2 group-[.toast]:!py-1',
          cancelButton:
            'group-[.toast]:!bg-bg-subtle group-[.toast]:!text-text-muted group-[.toast]:!text-xs group-[.toast]:!rounded-sm',
          success: 'group-[.toaster]:!border-l-cat-life',
          error: 'group-[.toaster]:!border-l-cat-research',
          info: 'group-[.toaster]:!border-l-link',
          warning: 'group-[.toaster]:!border-l-cat-kaggle',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
