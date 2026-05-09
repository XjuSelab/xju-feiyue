import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Heart, MessageSquare, Clock } from 'lucide-react'
import { CATEGORIES, getCategory } from '@/lib/categories'
import type { Note } from '@/api/schemas/note'
import notesJson from '@/api/mock/notes.json'

const NOTES = notesJson as readonly Note[]

/** 从 mock 数据里挑 3 张高赞 + 跨类别的笔记做 hero 瀑布。 */
const HERO_NOTE_IDS = ['note_recommend_002', 'note_course_001', 'note_kaggle_001'] as const

const HERO_NOTES: readonly Note[] = HERO_NOTE_IDS.map((id) => {
  const found = NOTES.find((n) => n.id === id)
  if (!found) throw new Error(`hero note missing: ${id}`)
  return found
})

const STACK_POSITIONS = [
  { x: '-72%', y: '0px', rot: '-4deg' },
  { x: '-50%', y: '24px', rot: '2deg' },
  { x: '-28%', y: '48px', rot: '-1deg' },
] as const

const BRAND_PANEL_BG_STYLE: CSSProperties = {
  backgroundColor: 'var(--brand-panel-bg)',
  backgroundImage: [
    'radial-gradient(at 12% 18%, var(--brand-panel-glow-warm), transparent 55%)',
    'radial-gradient(at 82% 82%, var(--brand-panel-glow-cool), transparent 60%)',
    'radial-gradient(var(--brand-panel-grid) 1px, transparent 1px)',
  ].join(', '),
  backgroundSize: 'auto, auto, 24px 24px',
  backgroundPosition: '0 0, 0 0, 0 0',
}

/**
 * BrandPanel — 登录页左栏 (R5 direction B)。
 * 仅 lg+ 显示。从顶到底：wordmark → 56px hero → 18px subhead
 * → 3 张笔记卡瀑布 → 7 类 chip strip → footer 提示。
 */
export function BrandPanel() {
  return (
    <aside
      aria-label="LabNotes 简介"
      data-brand-panel
      className="relative hidden overflow-hidden lg:col-span-7 lg:flex lg:flex-col lg:px-20 lg:py-16 xl:px-24"
      style={BRAND_PANEL_BG_STYLE}
    >
      <header className="relative">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-serif text-[18px] font-semibold text-text"
        >
          <NotebookPen size={20} strokeWidth={1.75} aria-hidden />
          LabNotes
        </Link>

        <h1 className="mt-10 max-w-[16ch] font-serif text-[44px] font-semibold leading-[1] tracking-[-0.02em] text-text xl:text-[56px]">
          把今天的实验，
          <br />
          写成下次能直接抄的作业。
        </h1>
        <p className="mt-4 max-w-[42ch] text-[16px] leading-[1.5] text-text-muted">
          科研 · 课程 · 推免 · 竞赛 · Kaggle · 工具 · 生活 —— 七类笔记，一个共享笔记本。
        </p>
      </header>

      <div aria-hidden className="relative mx-auto mt-10 h-[260px] w-full max-w-[640px]">
        {HERO_NOTES.map((note, i) => (
          <NoteStackCard key={note.id} note={note} index={i} />
        ))}
      </div>

      <footer className="relative mt-auto pt-10">
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            return (
              <li
                key={c.id}
                data-cat={c.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-1.5 text-[12.5px] font-medium text-text-muted"
              >
                <span
                  aria-hidden
                  className="flex size-4 items-center justify-center"
                  style={{ color: `var(${c.colorVar})` }}
                >
                  <Icon size={14} strokeWidth={1.75} />
                </span>
                {c.label}
              </li>
            )
          })}
        </ul>
        <p className="mt-6 text-[12.5px] text-text-faint">
          登录后可写作 · 收藏 · 评论；游客仅可浏览。
        </p>
      </footer>
    </aside>
  )
}

function NoteStackCard({ note, index }: { note: Note; index: number }) {
  const cat = getCategory(note.category)
  const pos = STACK_POSITIONS[index] ?? STACK_POSITIONS[1]
  const Icon = cat.icon
  const cardStyle = {
    '--card-x': pos.x,
    '--card-y': pos.y,
    '--card-rot': pos.rot,
    zIndex: index + 1,
    animationDelay: `${index * 120}ms`,
  } as CSSProperties

  return (
    <article
      className="note-stack-card absolute left-1/2 top-0 w-[420px] rounded-lg border border-border bg-bg p-5 shadow-card"
      style={cardStyle}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11.5px] font-medium"
          style={{
            backgroundColor: `var(${cat.tagBgVar})`,
            color: `var(${cat.colorVar})`,
          }}
        >
          <Icon size={12} strokeWidth={2} aria-hidden />
          {cat.label}
        </span>
        <span className="text-[12px] text-text-faint">{note.author.name}</span>
      </div>
      <h3 className="mt-2.5 font-serif text-[17px] font-semibold leading-[1.35] text-text">
        {note.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.55] text-text-muted">
        {note.summary}
      </p>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-text-faint">
        <span className="inline-flex items-center gap-1">
          <Heart size={12} strokeWidth={1.75} aria-hidden />
          {note.likes}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} strokeWidth={1.75} aria-hidden />
          {note.comments}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={12} strokeWidth={1.75} aria-hidden />
          {note.readMinutes} min
        </span>
      </div>
    </article>
  )
}
