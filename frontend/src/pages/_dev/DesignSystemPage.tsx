import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'

import { Toaster } from '@/components/ui/sonner'
import { ColorsSection } from './sections/ColorsSection'
import { TypographySection } from './sections/TypographySection'
import { RadiusShadowSection } from './sections/RadiusShadowSection'
import { ShadcnSection } from './sections/ShadcnSection'
import { CategoryBadgeSection } from './sections/CategoryBadgeSection'
import { CodeBlockSection } from './sections/CodeBlockSection'
import { MarkdownSection } from './sections/MarkdownSection'
import { StatesSection } from './sections/StatesSection'

/**
 * Dev-only design system showcase page.
 * 仅在 import.meta.env.DEV 时由 App.tsx 挂载，R3 起接 router。
 */
export function DesignSystemPage() {
  return (
    <div
      data-page="design-system"
      className="min-h-screen bg-bg text-text"
    >
      <header className="border-b border-border bg-bg/80 px-6 py-4 backdrop-blur">
        <h1 className="font-serif text-2xl font-semibold">
          LabNotes · Design System
        </h1>
        <p className="text-sm text-text-muted">
          Round 2 — tokens / shadcn / prose-claude reference page
        </p>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <ColorsSection />
        <TypographySection />
        <RadiusShadowSection />
        <ShadcnSection />
        <CategoryBadgeSection />
        <CodeBlockSection />
        <MarkdownSection />
        <StatesSection />
      </main>

      <Toaster />
    </div>
  )
}
