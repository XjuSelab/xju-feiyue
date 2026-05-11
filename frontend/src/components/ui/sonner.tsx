'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Site-wide Sonner toaster. Mounted once in App.tsx.
 *
 * Surface tokens (bg/border/text) hook directly into the project's
 * `--color-bg / --color-text / --line-strong` instead of shadcn's
 * `--background / --foreground / --border` so toasts visually match
 * the rest of the cards / popovers. Variant cues (success/error/etc.)
 * come from a 2 px left-border accent in the matching category color
 * + sonner's own leading icon — no flood-fill richColors.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    // @ts-expect-error shadcn-generated: theme prop required but useTheme() may yield undefined under exactOptionalPropertyTypes
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        // Surface — let sonner's own layout handle widths / spacing,
        // we just retint the colors.
        style: {
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--line-strong)',
          borderLeftWidth: '2px',
          fontSize: '13px',
          padding: '10px 12px',
          minHeight: '40px',
        },
        classNames: {
          description: 'text-[12px] text-text-muted',
          success: '!border-l-[var(--cat-life)]',
          error: '!border-l-[var(--cat-research)]',
          info: '!border-l-[var(--color-link)]',
          warning: '!border-l-[var(--cat-kaggle)]',
        },
      }}
      // 320 px is narrower than sonner's default ~356 px — keeps toasts
      // unobtrusive at the bottom-right corner.
      style={{ '--width': '320px' } as React.CSSProperties}
      {...props}
    />
  )
}

export { Toaster }
