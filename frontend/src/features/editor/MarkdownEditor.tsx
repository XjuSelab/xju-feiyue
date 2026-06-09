import { useCallback, useMemo, useRef } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import type { ViewUpdate } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { isImageFile, isDocFile } from '@/lib/fileTypes'

// 必须是模块级稳定引用。@uiw/react-codemirror 把 basicSetup 列进它 reconfigure
// effect 的依赖；每次渲染传新对象字面量 → 每次按键都 StateEffect.reconfigure，
// 期间派发的事务会重绘正在输入法合成中的 DOM，导致中文全角标点要按两下才出
// （onChange/onUpdate 同理，下面用 ref 稳定化）。
const BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
}

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
  /** Image or document attachment files pasted into the editor (filtered by
   * `isImageFile || isDocFile`) — caller decides upload behavior. */
  onPasteFiles?: (files: File[]) => void
  /** Image or document attachment files dropped onto the editor (filtered by
   * `isImageFile || isDocFile`) — caller decides upload behavior. */
  onDropFiles?: (files: File[]) => void
  className?: string
}

/**
 * MarkdownEditor — CodeMirror 6 wrapper. R4 editor-agent。
 * - markdown lang highlight
 * - selection 监听上抛（spec 浮动工具条用）
 * - 字号 14 与 prose-claude 不一致，保留 prose 在预览侧渲染
 */
export function MarkdownEditor({
  value,
  onChange,
  onSelectionChange,
  onReady,
  onPasteFiles,
  onDropFiles,
  className,
}: Props) {
  // Stable refs so the editor extension below doesn't have to be rebuilt
  // every render (which would tear down + remount CodeMirror).
  const pasteRef = useRef(onPasteFiles)
  const dropRef = useRef(onDropFiles)
  pasteRef.current = onPasteFiles
  dropRef.current = onDropFiles

  // 父组件每次渲染都给 onChange / onSelectionChange / onReady 传新的内联函数。
  // 直接透传给 CodeMirror 会进它 reconfigure effect 的依赖 → 每次按键 reconfigure
  // → 干扰输入法合成（见 BASIC_SETUP 注释）。用 ref 固定回调引用，闭包内读最新值。
  const changeRef = useRef(onChange)
  const selRef = useRef(onSelectionChange)
  const readyRef = useRef(onReady)
  changeRef.current = onChange
  selRef.current = onSelectionChange
  readyRef.current = onReady

  const handleChange = useCallback((v: string) => changeRef.current(v), [])
  const handleCreate = useCallback((view: EditorView) => readyRef.current?.(view), [])
  const handleUpdate = useCallback((v: ViewUpdate) => {
    const cb = selRef.current
    if (!cb) return
    if (!v.selectionSet && !v.docChanged) return
    const sel = v.state.selection.main
    const text = v.state.doc.sliceString(sel.from, sel.to)
    let rect: { x: number; y: number } | null = null
    if (sel.from !== sel.to) {
      const coords = v.view.coordsAtPos(sel.from)
      if (coords) rect = { x: coords.left, y: coords.top }
    }
    cb({ text, from: sel.from, to: sel.to, rect })
  }, [])

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
      EditorView.domEventHandlers({
        paste(event) {
          const handler = pasteRef.current
          if (!handler) return false
          const files = Array.from(event.clipboardData?.files ?? []).filter(
            (f) => isImageFile(f) || isDocFile(f),
          )
          if (files.length === 0) return false
          event.preventDefault()
          handler(files)
          return true
        },
        drop(event) {
          const handler = dropRef.current
          if (!handler) return false
          const files = Array.from(event.dataTransfer?.files ?? []).filter(
            (f) => isImageFile(f) || isDocFile(f),
          )
          if (files.length === 0) return false
          event.preventDefault()
          handler(files)
          return true
        },
      }),
    ],
    [],
  )

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      extensions={extensions}
      basicSetup={BASIC_SETUP}
      className={className}
      onCreateEditor={handleCreate}
      onUpdate={handleUpdate}
    />
  )
}
