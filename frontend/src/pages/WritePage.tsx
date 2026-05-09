import { useParams } from 'react-router-dom'

/**
 * Round 3 placeholder. Round 4 editor-agent 替换为：
 *   三栏 (CodeMirror 编辑 / Markdown 预览 / AIDrawer) + 浮动工具条 + diff
 */
export function WritePage() {
  const { draftId } = useParams<{ draftId: string }>()

  return (
    <section
      data-page="write"
      className="mx-auto max-w-5xl px-6 py-12"
    >
      <h1 className="font-serif text-2xl font-semibold text-text">写作</h1>
      <p className="mt-2 text-sm text-text-muted">
        WritePage placeholder · Round 4 editor-agent 接管。
      </p>
      {draftId && (
        <p className="mt-2 font-mono text-xs text-text-faint">
          draftId: {draftId}
        </p>
      )}
    </section>
  )
}
