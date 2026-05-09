import { CodeBlock } from '@/components/common/CodeBlock'

const PY = `def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(fib(10))`

const TS = `import { useState } from 'react'

export function Counter() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>{n}</button>
}`

const SH = `# clone & install
git clone git@github.com:labnotes/app.git
cd app && pnpm i
pnpm dev`

export function CodeBlockSection() {
  return (
    <section
      data-section="codeblock"
      className="space-y-4 rounded-md border border-border p-5"
    >
      <h2 className="text-lg font-semibold">6 · CodeBlock</h2>
      <p className="text-xs text-text-muted">
        Hover (or focus) to reveal the copy button.
      </p>
      <div className="prose-claude !max-w-none">
        <CodeBlock language="python" code={PY} />
        <CodeBlock language="typescript" code={TS} />
        <CodeBlock language="bash" code={SH} />
      </div>
    </section>
  )
}
