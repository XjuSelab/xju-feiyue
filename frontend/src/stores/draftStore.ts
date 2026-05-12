import { create, type StateCreator } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CategoryId } from '@/lib/categories'

export type Draft = {
  id: string
  title: string
  summary: string
  content: string
  category: CategoryId
  tags: string[]
  updatedAt: string
}

export type DraftState = {
  drafts: Record<string, Draft>
  currentId: string | null
  /** Returns the currently editing draft, creating a new one if none. */
  ensureCurrent: () => Draft
  loadDraft: (id: string) => Draft | null
  createDraft: () => Draft
  updateDraft: (patch: Partial<Omit<Draft, 'id' | 'updatedAt'>>) => void
  /** Persist current draft into drafts map (called by autosave). */
  saveDraft: () => void
  deleteDraft: (id: string) => void
}

const newId = () => `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const blankDraft = (): Draft => ({
  id: newId(),
  title: '',
  summary: '',
  content: '',
  category: 'research',
  tags: [],
  updatedAt: new Date().toISOString(),
})

const creator: StateCreator<DraftState, [['zustand/persist', unknown]]> = (set, get) => ({
  drafts: {},
  currentId: null,
  ensureCurrent: () => {
    const { drafts, currentId } = get()
    if (currentId && drafts[currentId]) return drafts[currentId]
    const fresh = blankDraft()
    set((s) => ({
      drafts: { ...s.drafts, [fresh.id]: fresh },
      currentId: fresh.id,
    }))
    return fresh
  },
  loadDraft: (id) => {
    const draft = get().drafts[id]
    if (!draft) return null
    set({ currentId: id })
    return draft
  },
  createDraft: () => {
    const fresh = blankDraft()
    set((s) => ({
      drafts: { ...s.drafts, [fresh.id]: fresh },
      currentId: fresh.id,
    }))
    return fresh
  },
  updateDraft: (patch) => {
    const { currentId, drafts } = get()
    if (!currentId) return
    const cur = drafts[currentId]
    if (!cur) return
    const next: Draft = {
      ...cur,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({ drafts: { ...s.drafts, [next.id]: next } }))
  },
  saveDraft: () => {
    // updateDraft already updates timestamp; saveDraft is here for explicit
    // flush points (e.g. Ctrl+S) — currently same effect.
    const { currentId, drafts } = get()
    if (!currentId) return
    const cur = drafts[currentId]
    if (!cur) return
    set((s) => ({
      drafts: {
        ...s.drafts,
        [cur.id]: { ...cur, updatedAt: new Date().toISOString() },
      },
    }))
  },
  deleteDraft: (id) => {
    set((s) => {
      const { [id]: _removed, ...rest } = s.drafts
      void _removed
      return {
        drafts: rest,
        currentId: s.currentId === id ? null : s.currentId,
      }
    })
  },
})

export const useDraftStore = create<DraftState>()(
  persist(creator, {
    name: 'labnotes.drafts',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ drafts: s.drafts, currentId: s.currentId }),
    version: 1,
    migrate: (persisted, _version) => {
      const s = persisted as {
        drafts?: Record<string, Partial<Draft>>
        currentId?: string | null
      } | null
      if (!s?.drafts) return s as never
      const upgraded: Record<string, Draft> = {}
      for (const [id, d] of Object.entries(s.drafts)) {
        const cur = d as Partial<Draft>
        upgraded[id] = { ...(cur as Draft), summary: cur.summary ?? '' }
      }
      return { ...s, drafts: upgraded } as never
    },
  }),
)
