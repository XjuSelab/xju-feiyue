export function RadiusShadowSection() {
  return (
    <section
      data-section="radius-shadow"
      className="space-y-6 rounded-md border border-border p-5"
    >
      <h2 className="text-lg font-semibold">3 · Radius &amp; Shadow</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="h-16 rounded-sm border border-border bg-bg-subtle" />
          <p className="font-mono text-xs text-text-muted">--radius-sm 6px</p>
        </div>
        <div className="space-y-1">
          <div className="h-16 rounded-md border border-border bg-bg-subtle" />
          <p className="font-mono text-xs text-text-muted">--radius-md 8px</p>
        </div>
        <div className="space-y-1">
          <div className="h-16 rounded-lg border border-border bg-bg-subtle" />
          <p className="font-mono text-xs text-text-muted">--radius-lg 12px</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-16 rounded-md border border-border bg-bg shadow-card" />
        <p className="font-mono text-xs text-text-muted">
          --shadow-card · 0 1px 2px rgba(0,0,0,0.04)
        </p>
      </div>
    </section>
  )
}
