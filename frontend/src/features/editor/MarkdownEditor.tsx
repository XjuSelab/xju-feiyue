import { useMemo } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'

type Props = {
  value: string
  onChange: (value: string) => void
  onSelectionChange?: (info: {
    text: string
    from: number
    to: number
    /** Viewport-anchored bbox of selection top, useful for FloatingToolbar */
    rect: { x: number; y: number } | null
  }) => void
  /** Receive the underlying CodeMirror EditorView so the parent can dispatch
   * transactions (toolbar insertions). Called once after mount. */
  onReady?: (view: EditorView) => void
  className?: string
}

/**
 * MarkdownEditor — CodeMirror 6 wrapper. R4 editor-agent。
 * - markdown lang highlight
 * - selection 监听上抛（spec 浮动工具条用）
 * - 字号 14 与 prose-claude 不一致，保留 prose 在预览侧渲染
 */
export function MarkdownEditor({ value, onChange, onSelectionChange, onReady, className }: Props) {
  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
        },
        '.cm-scroller': {
          fontFamily: 'var(--font-mono)',
          padding: '16px 24px',
        },
        '.cm-focused': { outline: 'none' },
      }),
    ],
    [],
  )

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      className={className}
      onCreateEditor={(view) => {
        onReady?.(view)
      }}
      onUpdate={(v) => {
        if (!onSelectionChange) return
        if (!v.selectionSet && !v.docChanged) return
        const sel = v.state.selection.main
        const text = v.state.doc.sliceString(sel.from, sel.to)
        let rect: { x: number; y: number } | null = null
        if (sel.from !== sel.to) {
          const coords = v.view.coordsAtPos(sel.from)
          if (coords) rect = { x: coords.left, y: coords.top }
        }
        onSelectionChange({ text, from: sel.from, to: sel.to, rect })
      }}
    />
  )
}
