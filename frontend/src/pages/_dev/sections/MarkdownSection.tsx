import { Markdown } from '@/components/common/Markdown'

const SAMPLE = `# LabNotes Markdown Demo

A short paragraph showing **bold**, *italic*, and an [external link](https://example.com).

## Lists

- Bullet one
- Bullet two
  - Nested
- Bullet three

1. Ordered one
2. Ordered two

## Table (GFM)

| Category | Color | Sample |
| --- | --- | --- |
| 科研 | red | \`E03E3E\` |
| 工具 | green | \`0F7B6C\` |
| 生活 | tan | \`B5926A\` |

## Blockquote

> 写笔记是把抽象的思考变成具体的痕迹。

## Code

Inline \`const x = 1\` and a fenced block:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Math

Inline math: $E = mc^2$. Block math:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

## Image placeholder

![placeholder](https://placehold.co/600x200/png?text=LabNotes)

---

End of demo.
`

export function MarkdownSection() {
  return (
    <section
      data-section="markdown"
      className="space-y-4 rounded-md border border-border p-5"
    >
      <h2 className="text-lg font-semibold">7 · Markdown (prose-claude)</h2>
      <Markdown content={SAMPLE} />
    </section>
  )
}
