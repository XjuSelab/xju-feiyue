import { CATEGORIES } from '@/lib/categories'

const NEUTRALS: ReadonlyArray<{ name: string; varName: string }> = [
  { name: 'bg', varName: '--color-bg' },
  { name: 'bg-subtle', varName: '--color-bg-subtle' },
  { name: 'bg-hover', varName: '--bg-hover' },
  { name: 'text', varName: '--color-text' },
  { name: 'text-muted', varName: '--color-text-muted' },
  { name: 'text-faint', varName: '--color-text-faint' },
  { name: 'border', varName: '--color-border' },
  { name: 'border-strong', varName: '--line-strong' },
]

const HELPERS: ReadonlyArray<{ name: string; varName: string }> = [
  { name: 'link', varName: '--color-link' },
  { name: 'code-inline-bg', varName: '--code-inline-bg' },
  { name: 'code-inline-fg', varName: '--code-inline-fg' },
]

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-12 w-full rounded-md border border-border"
        style={{ backgroundColor: `var(${varName})` }}
      />
      <div className="text-xs">
        <div className="font-mono text-text">{name}</div>
        <div className="font-mono text-[11px] text-text-faint">{varName}</div>
      </div>
    </div>
  )
}

export function ColorsSection() {
  return (
    <section
      data-section="colors"
      className="space-y-6 rounded-md border border-border p-5"
    >
      <h2 className="text-lg font-semibold">1 · Color Palette</h2>

      <div>
        <h3 className="mb-3 text-sm font-medium text-text-muted">
          Surface · Text · Line (8 grays)
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NEUTRALS.map((s) => (
            <Swatch key={s.varName} {...s} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-text-muted">
          7 Categories (strong)
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {CATEGORIES.map((c) => (
            <Swatch key={c.id} name={c.id} varName={c.colorVar} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-text-muted">
          7 Categories · 12% alpha tint
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {CATEGORIES.map((c) => (
            <Swatch key={c.id} name={`${c.id}-bg`} varName={c.tagBgVar} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-text-muted">Helpers</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HELPERS.map((s) => (
            <Swatch key={s.varName} {...s} />
          ))}
        </div>
      </div>
    </section>
  )
}
