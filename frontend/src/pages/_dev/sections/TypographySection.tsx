export function TypographySection() {
  return (
    <section
      data-section="typography"
      className="space-y-6 rounded-md border border-border p-5"
    >
      <h2 className="text-lg font-semibold">2 · Typography</h2>

      <div className="space-y-1">
        <p className="text-xs text-text-muted">Serif (Source Serif 4)</p>
        <p className="font-serif text-3xl font-bold">论文阅读笔记 H1</p>
        <p className="font-serif text-2xl font-semibold">实验记录 H2</p>
        <p className="font-serif text-xl font-semibold">章节标题 H3</p>
        <p className="font-serif text-base">
          正文：The quick brown fox jumps over the lazy dog · 中文混排测试。
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-text-muted">Sans (Inter Tight)</p>
        <p className="font-sans text-2xl font-bold">UI · Heading</p>
        <p className="font-sans text-base">
          UI 正文 15/24 — Buttons, labels, navigation.
        </p>
        <p className="font-sans text-sm text-text-muted">Caption · 提示语</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-text-muted">Mono (JetBrains Mono)</p>
        <p className="font-mono text-base">const x: number = 42</p>
        <p className="font-mono text-sm text-text-muted">
          // inline mono comment
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-text-muted">Weight scale</p>
        <p className="font-sans text-base font-normal">400 Regular</p>
        <p className="font-sans text-base font-medium">500 Medium</p>
        <p className="font-sans text-base font-semibold">600 Semibold</p>
        <p className="font-sans text-base font-bold">700 Bold</p>
      </div>
    </section>
  )
}
