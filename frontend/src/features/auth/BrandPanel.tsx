import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Heart, MessageSquare, NotebookPen } from 'lucide-react'
import { CATEGORIES, getCategory } from '@/lib/categories'
import type { Note } from '@/api/schemas/note'
import notesJson from '@/api/mock/notes.json'

const NOTES = notesJson as readonly Note[]

/**
 * Hero stack on the login page. Pick 3 notes with diverse vibes (container
 * config / driver install / git cheatsheet). Match by title rather than
 * numeric id because the seed pipeline renumbers notes when the source set
 * changes. Falls back to the first three notes so login never crashes on a
 * miss.
 */
const HERO_TITLES = ['Docker 容器配置', 'CUDA 安装', 'WSL Git(SSH) 操作速查表'] as const

const HERO_NOTES: readonly Note[] = (() => {
  const picked = HERO_TITLES.map((title) => NOTES.find((n) => n.title === title)).filter(
    (n): n is Note => Boolean(n),
  )
  if (picked.length === HERO_TITLES.length) return picked
  return NOTES.slice(0, 3)
})()

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
      className="relative hidden select-none overflow-hidden lg:col-span-7 lg:flex lg:flex-col lg:justify-center lg:px-24 lg:py-20 xl:px-32"
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

      <div aria-hidden className="relative mx-auto mt-8 h-[240px] w-full max-w-[640px]">
        {HERO_NOTES.map((note, i) => (
          <NoteStackCard key={note.id} note={note} index={i} />
        ))}
      </div>

      <footer className="relative mt-8">
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <li
              key={c.id}
              data-cat={c.id}
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[12.5px] font-medium"
              style={{
                backgroundColor: `var(${c.tagBgVar})`,
                color: `var(${c.colorVar})`,
              }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: `var(${c.colorVar})` }}
              />
              {c.label}
            </li>
          ))}
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
