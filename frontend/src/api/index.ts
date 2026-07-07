/**
 * 数据层公共出口。importing this file (or anything from `@/api`) loads the
 * mock dispatch table in dev. Prod builds tree-shake the dev branch via
 * `import.meta.env.DEV`.
 *
 * R3 末尾 contracts step 冻结：暴露 schemas + endpoint stubs + TanStack
 * Query hooks。R4 不允许改这些 hook 签名 / endpoint 入参。
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import * as notesApi from './endpoints/notes'
import * as interactionsApi from './endpoints/interactions'
import * as aiApi from './endpoints/ai'
import * as draftsApi from './endpoints/drafts'
import * as authApi from './endpoints/auth'
import * as collectionsApi from './endpoints/collections'
import * as reportsApi from './endpoints/reports'
import * as blocksApi from './endpoints/blocks'
import type { Note, ListNotesQuery, PaginatedNotes } from './schemas/note'
import type { Comment, CommentIn, PaginatedComments } from './schemas/interaction'
import type { AIComposeRequest, AIComposeResponse } from './schemas/ai'
import type { CheckIn, XpEvent } from './schemas/growth'
import type {
  Collection,
  CollectionDetail,
  CollectionCreateIn,
  CollectionUpdateIn,
} from './schemas/collection'
import type { Block, Report, ReportCreateIn, ReportResolveIn } from './schemas/report'
import type { Draft } from './endpoints/drafts'

if (import.meta.env.DEV && !import.meta.env['VITE_API_BASE']) {
  // Side-effect import; handlers register on module load. Skipped when
  // VITE_API_BASE is set so the bundle doesn't pull mock fixtures into the
  // graph when wired to a real backend.
  await import('./mock/handlers')
}

// ------ re-exports ------

export { request, registerMock, ApiError } from './client'
export type { HttpMethod, MockHandler, MockReq } from './client'

export * as authApi from './endpoints/auth'
export * as notesApi from './endpoints/notes'
export * as interactionsApi from './endpoints/interactions'
export * as aiApi from './endpoints/ai'
export * as draftsApi from './endpoints/drafts'
export { DraftSchema, type Draft, type DraftIn } from './endpoints/drafts'

export {
  UserSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  type User,
  type LoginRequest,
  type LoginResponse,
} from './schemas/user'
export {
  NoteSchema,
  NoteListSchema,
  NoteAuthorSchema,
  CategoryIdSchema,
  ListNotesQuerySchema,
  PaginatedNotesSchema,
  type Note,
  type NoteAuthor,
  type ListNotesQuery,
  type PaginatedNotes,
} from './schemas/note'
export {
  CommentSchema,
  PaginatedCommentsSchema,
  type Comment,
  type CommentIn,
  type PaginatedComments,
} from './schemas/interaction'
export {
  CheckInSchema,
  XpEventSchema,
  XpEventListSchema,
  type CheckIn,
  type XpEvent,
} from './schemas/growth'
export * as collectionsApi from './endpoints/collections'
export {
  CollectionSchema,
  CollectionDetailSchema,
  CollectionNoteSchema,
  NoteCollectionContextSchema,
  type Collection,
  type CollectionDetail,
  type CollectionNote,
  type NoteCollectionContext,
  type CollectionCreateIn,
  type CollectionUpdateIn,
} from './schemas/collection'
export * as reportsApi from './endpoints/reports'
export * as blocksApi from './endpoints/blocks'
export {
  ReportSchema,
  BlockSchema,
  ReportReasonSchema,
  REPORT_REASONS,
  reasonLabel,
  type Report,
  type Block,
  type ReportReason,
  type ReportCreateIn,
  type ReportResolveIn,
} from './schemas/report'
export {
  AIComposeRequestSchema,
  AIComposeResponseSchema,
  AIComposeModeSchema,
  DiffSegmentSchema,
  type AIComposeRequest,
  type AIComposeResponse,
  type AIComposeMode,
  type DiffSegment,
} from './schemas/ai'

// ------ TanStack Query hooks ------
//
// 全部走 src/api/endpoints/* + src/api/client.ts，不直读 mock。
// R4 home-agent 替换 endpoints/notes.ts 的 body 后这些 hooks 自动通。
//
// 注意：当前 R3 endpoints 全 throw NotImplemented，所以 hooks 在 R3 调用
// 一律会进入 error 状态 —— 这是预期；R4 验收时会变 success。

export function useNotes(
  query?: ListNotesQuery,
): UseInfiniteQueryResult<{ pages: PaginatedNotes[]; pageParams: (string | undefined)[] }> {
  return useInfiniteQuery({
    queryKey: ['notes', query],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const q: ListNotesQuery = { ...(query ?? {}) }
      if (typeof pageParam === 'string') q.cursor = pageParam
      return notesApi.listNotes(q)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PaginatedNotes) => last.nextCursor ?? undefined,
  })
}

const SIX_HOURS = 6 * 60 * 60 * 1000

export function useHotNotes(): UseQueryResult<Note[]> {
  return useQuery({
    queryKey: ['notes', 'hot'],
    queryFn: notesApi.getHotThisWeek,
    staleTime: SIX_HOURS,
    refetchInterval: SIX_HOURS,
  })
}

export function useLatestNotes(): UseQueryResult<Note[]> {
  return useQuery({
    queryKey: ['notes', 'latest'],
    queryFn: notesApi.getLatest,
    staleTime: SIX_HOURS,
    refetchInterval: SIX_HOURS,
  })
}

export function useMostLikedNotes(): UseQueryResult<Note[]> {
  return useQuery({
    queryKey: ['notes', 'liked'],
    queryFn: notesApi.getMostLiked,
    staleTime: SIX_HOURS,
    refetchInterval: SIX_HOURS,
  })
}

export function useNote(id: string): UseQueryResult<Note> {
  return useQuery({
    queryKey: ['note', id],
    queryFn: () => notesApi.getNote(id),
    enabled: id.length > 0,
  })
}

export function useAICompose(): UseMutationResult<AIComposeResponse, Error, AIComposeRequest> {
  return useMutation({
    mutationFn: (req: AIComposeRequest) => aiApi.compose(req),
  })
}

type ToggleLikeVars = { id: string; liked: boolean }

type LikeSnapshot = {
  prevNote: Note | undefined
  notesQueries: Array<[readonly unknown[], unknown]>
}

function applyLikeDelta(note: Note, currentlyLiked: boolean): Note {
  return {
    ...note,
    likedByMe: !currentlyLiked,
    likes: Math.max(0, note.likes + (currentlyLiked ? -1 : 1)),
  }
}

/**
 * Toggle the current viewer's like on a note. Optimistic + rollback on
 * error. Touches both ['note', id] (single) and ['notes', ...] (lists +
 * infinite queries).
 *
 * Pass `liked` = note.likedByMe at click time; mutationFn picks
 * like vs unlike based on that.
 */
export function useToggleLike(): UseMutationResult<void, Error, ToggleLikeVars, LikeSnapshot> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, liked }: ToggleLikeVars) =>
      liked ? interactionsApi.unlikeNote(id) : interactionsApi.likeNote(id),
    onMutate: async ({ id, liked }: ToggleLikeVars): Promise<LikeSnapshot> => {
      await qc.cancelQueries({ queryKey: ['note', id] })
      await qc.cancelQueries({ queryKey: ['notes'] })

      const prevNote = qc.getQueryData<Note>(['note', id])
      const notesQueries = qc.getQueriesData<unknown>({ queryKey: ['notes'] })

      if (prevNote) {
        qc.setQueryData<Note>(['note', id], applyLikeDelta(prevNote, liked))
      }

      for (const [key, data] of notesQueries) {
        if (!data) continue
        // Infinite query (useNotes): { pages: PaginatedNotes[], pageParams }
        if (
          typeof data === 'object' &&
          'pages' in (data as object) &&
          Array.isArray((data as { pages: unknown }).pages)
        ) {
          const inf = data as { pages: PaginatedNotes[]; pageParams: unknown[] }
          qc.setQueryData(key, {
            ...inf,
            pages: inf.pages.map((page) => ({
              ...page,
              items: page.items.map((n) => (n.id === id ? applyLikeDelta(n, liked) : n)),
            })),
          })
        } else if (Array.isArray(data)) {
          // Flat Note[] (useHotNotes / useLatestNotes / useMostLikedNotes)
          qc.setQueryData(
            key,
            (data as Note[]).map((n) => (n.id === id ? applyLikeDelta(n, liked) : n)),
          )
        }
      }

      return { prevNote, notesQueries }
    },
    onError: (_err: Error, vars: ToggleLikeVars, ctx?: LikeSnapshot) => {
      if (!ctx) return
      if (ctx.prevNote) qc.setQueryData(['note', vars.id], ctx.prevNote)
      for (const [key, data] of ctx.notesQueries) {
        qc.setQueryData(key, data)
      }
    },
    onSettled: (_d, _e, { id }: ToggleLikeVars) => {
      void qc.invalidateQueries({ queryKey: ['note', id] })
      void qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// ------ Favorite / Dislike (note) ------
//
// Same optimistic dance as useToggleLike (patch ['note',id] + every ['notes']
// list, snapshot + rollback on error, refetch on settle). Factored into a
// private hook so the 3 note toggles don't diverge. `active` = the current
// state before the toggle (mirrors useToggleLike's `liked`).

type NoteToggleVars = { id: string; active: boolean }
type NoteToggleSnapshot = {
  prevNote: Note | undefined
  notesQueries: Array<[readonly unknown[], unknown]>
}

function useNoteToggle(
  fn: (id: string, active: boolean) => Promise<void>,
  apply: (note: Note, active: boolean) => Note,
): UseMutationResult<void, Error, NoteToggleVars, NoteToggleSnapshot> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: NoteToggleVars) => fn(id, active),
    onMutate: async ({ id, active }: NoteToggleVars): Promise<NoteToggleSnapshot> => {
      await qc.cancelQueries({ queryKey: ['note', id] })
      await qc.cancelQueries({ queryKey: ['notes'] })
      const prevNote = qc.getQueryData<Note>(['note', id])
      const notesQueries = qc.getQueriesData<unknown>({ queryKey: ['notes'] })
      if (prevNote) qc.setQueryData<Note>(['note', id], apply(prevNote, active))
      for (const [key, data] of notesQueries) {
        if (!data) continue
        if (
          typeof data === 'object' &&
          'pages' in (data as object) &&
          Array.isArray((data as { pages: unknown }).pages)
        ) {
          const inf = data as { pages: PaginatedNotes[]; pageParams: unknown[] }
          qc.setQueryData(key, {
            ...inf,
            pages: inf.pages.map((page) => ({
              ...page,
              items: page.items.map((n) => (n.id === id ? apply(n, active) : n)),
            })),
          })
        } else if (Array.isArray(data)) {
          qc.setQueryData(key, (data as Note[]).map((n) => (n.id === id ? apply(n, active) : n)))
        }
      }
      return { prevNote, notesQueries }
    },
    onError: (_err: Error, vars: NoteToggleVars, ctx?: NoteToggleSnapshot) => {
      if (!ctx) return
      if (ctx.prevNote) qc.setQueryData(['note', vars.id], ctx.prevNote)
      for (const [key, data] of ctx.notesQueries) qc.setQueryData(key, data)
    },
    onSettled: (_d, _e, { id }: NoteToggleVars) => {
      void qc.invalidateQueries({ queryKey: ['note', id] })
      void qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

function applyFavoriteDelta(note: Note, active: boolean): Note {
  return { ...note, favoritedByMe: !active }
}

function applyDislikeDelta(note: Note, active: boolean): Note {
  const on = !active
  return {
    ...note,
    dislikedByMe: on,
    // 点赞点踩互斥：点踩时若原本点过赞，前端也乐观撤掉（与后端一致）。
    likedByMe: on ? false : note.likedByMe,
    likes: on && note.likedByMe ? Math.max(0, note.likes - 1) : note.likes,
  }
}

export function useToggleFavorite(): UseMutationResult<void, Error, NoteToggleVars, NoteToggleSnapshot> {
  return useNoteToggle(
    (id, active) => (active ? interactionsApi.unfavoriteNote(id) : interactionsApi.favoriteNote(id)),
    applyFavoriteDelta,
  )
}

export function useToggleDislike(): UseMutationResult<void, Error, NoteToggleVars, NoteToggleSnapshot> {
  return useNoteToggle(
    (id, active) => (active ? interactionsApi.undislikeNote(id) : interactionsApi.dislikeNote(id)),
    applyDislikeDelta,
  )
}

// ------ Comments ------

const COMMENT_PAGE_SIZE = 20

type CommentsInfiniteData = {
  pages: PaginatedComments[]
  pageParams: (string | undefined)[]
}

export function useComments(noteId: string): UseInfiniteQueryResult<CommentsInfiniteData> {
  return useInfiniteQuery({
    queryKey: ['note', noteId, 'comments'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      interactionsApi.listComments(noteId, {
        limit: COMMENT_PAGE_SIZE,
        // exactOptionalPropertyTypes: omit the key entirely when undefined.
        ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PaginatedComments) => last.nextCursor ?? undefined,
    enabled: noteId.length > 0,
  })
}

type CreateCommentSnapshot = {
  prevData: CommentsInfiniteData | undefined
  tempId: string
}

export function useCreateComment(
  noteId: string,
): UseMutationResult<Comment, Error, CommentIn, CreateCommentSnapshot> {
  const qc = useQueryClient()
  const key = ['note', noteId, 'comments'] as const
  return useMutation({
    mutationFn: (body: CommentIn) => interactionsApi.createComment(noteId, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key })
      const prevData = qc.getQueryData<CommentsInfiniteData>(key)
      const tempId = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2)}`
      // Best-effort optimistic insert — we don't know the author shape from
      // here, so insert a placeholder; the refetch overwrites it.
      if (prevData && prevData.pages.length > 0) {
        const firstPage = prevData.pages[0]!
        const optimistic: Comment = {
          id: tempId,
          noteId,
          author: {
            sid: '',
            nickname: '…',
            avatar: null,
            avatarThumb: null,
          },
          content: body.content,
          createdAt: new Date().toISOString(),
          parentId: body.parentId ?? null,
          replyToSid: body.replyToSid ?? null,
          replyTo: null,
          images: body.images ?? [],
          status: 'visible',
          likes: 0,
          dislikes: 0,
          likedByMe: false,
          dislikedByMe: false,
          anchorText: body.anchorText ?? null,
          anchorOffsetStart: body.anchorOffsetStart ?? null,
          anchorOffsetEnd: body.anchorOffsetEnd ?? null,
        }
        qc.setQueryData<CommentsInfiniteData>(key, {
          ...prevData,
          pages: [
            { ...firstPage, items: [optimistic, ...firstPage.items] },
            ...prevData.pages.slice(1),
          ],
        })
      }
      return { prevData, tempId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevData) qc.setQueryData(key, ctx.prevData)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
    },
  })
}

type DeleteCommentSnapshot = {
  prevData: CommentsInfiniteData | undefined
}

export function useDeleteComment(
  noteId: string,
): UseMutationResult<void, Error, string, DeleteCommentSnapshot> {
  const qc = useQueryClient()
  const key = ['note', noteId, 'comments'] as const
  return useMutation({
    mutationFn: (commentId: string) => interactionsApi.deleteComment(noteId, commentId),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: key })
      const prevData = qc.getQueryData<CommentsInfiniteData>(key)
      if (prevData) {
        qc.setQueryData<CommentsInfiniteData>(key, {
          ...prevData,
          pages: prevData.pages.map((p) => ({
            ...p,
            items: p.items.filter((c) => c.id !== commentId),
          })),
        })
      }
      return { prevData }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevData) qc.setQueryData(key, ctx.prevData)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
    },
  })
}

// ------ Comment reactions (like / dislike) ------

type CommentReactionVars = { commentId: string; kind: 'like' | 'dislike'; active: boolean }
type CommentReactionSnapshot = { prevData: CommentsInfiniteData | undefined }

function applyCommentReaction(c: Comment, kind: 'like' | 'dislike', active: boolean): Comment {
  const on = !active // toggling to this new state
  if (kind === 'like') {
    return {
      ...c,
      likedByMe: on,
      likes: Math.max(0, c.likes + (on ? 1 : -1)),
      // 赞踩互斥：点赞时撤掉原有点踩
      dislikedByMe: on ? false : c.dislikedByMe,
      dislikes: on && c.dislikedByMe ? Math.max(0, c.dislikes - 1) : c.dislikes,
    }
  }
  return {
    ...c,
    dislikedByMe: on,
    dislikes: Math.max(0, c.dislikes + (on ? 1 : -1)),
    likedByMe: on ? false : c.likedByMe,
    likes: on && c.likedByMe ? Math.max(0, c.likes - 1) : c.likes,
  }
}

export function useToggleCommentReaction(
  noteId: string,
): UseMutationResult<void, Error, CommentReactionVars, CommentReactionSnapshot> {
  const qc = useQueryClient()
  const key = ['note', noteId, 'comments'] as const
  return useMutation({
    mutationFn: ({ commentId, kind, active }: CommentReactionVars) => {
      if (kind === 'like') {
        return active
          ? interactionsApi.unlikeComment(commentId)
          : interactionsApi.likeComment(commentId)
      }
      return active
        ? interactionsApi.undislikeComment(commentId)
        : interactionsApi.dislikeComment(commentId)
    },
    onMutate: async ({ commentId, kind, active }: CommentReactionVars) => {
      await qc.cancelQueries({ queryKey: key })
      const prevData = qc.getQueryData<CommentsInfiniteData>(key)
      if (prevData) {
        qc.setQueryData<CommentsInfiniteData>(key, {
          ...prevData,
          pages: prevData.pages.map((p) => ({
            ...p,
            items: p.items.map((c) =>
              c.id === commentId ? applyCommentReaction(c, kind, active) : c,
            ),
          })),
        })
      }
      return { prevData }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevData) qc.setQueryData(key, ctx.prevData)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
    },
  })
}

// ------ Growth: daily check-in + xp ledger ------

export function useCheckin(): UseMutationResult<CheckIn, Error, void> {
  return useMutation({
    mutationFn: () => authApi.checkin(),
  })
}

export function useXpEvents(enabled: boolean): UseQueryResult<XpEvent[]> {
  return useQuery({
    queryKey: ['me', 'xp-events'],
    queryFn: () => authApi.xpEvents(),
    enabled,
  })
}

// ------ Collections ------

export function useMyCollections(enabled = true): UseQueryResult<Collection[]> {
  return useQuery({
    queryKey: ['collections', 'mine'],
    queryFn: () => collectionsApi.listMine(),
    enabled,
  })
}

export function useCollectionDetail(id: string | null): UseQueryResult<CollectionDetail> {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: () => collectionsApi.getDetail(id as string),
    enabled: !!id,
  })
}

export function useCreateCollection(): UseMutationResult<Collection, Error, CollectionCreateIn> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CollectionCreateIn) => collectionsApi.create(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['collections', 'mine'] }),
  })
}

export function useUpdateCollection(): UseMutationResult<
  Collection,
  Error,
  { id: string; body: CollectionUpdateIn }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CollectionUpdateIn }) =>
      collectionsApi.update(id, body),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: ['collections', 'mine'] })
      void qc.invalidateQueries({ queryKey: ['collection', id] })
    },
  })
}

export function useDeleteCollection(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => collectionsApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['collections', 'mine'] }),
  })
}

type EntryVars = { collectionId: string; noteId: string }

export function useAddCollectionEntry(): UseMutationResult<CollectionDetail, Error, EntryVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, noteId }: EntryVars) =>
      collectionsApi.addEntry(collectionId, noteId),
    onSuccess: (detail, { collectionId }) => {
      qc.setQueryData(['collection', collectionId], detail)
      void qc.invalidateQueries({ queryKey: ['collections', 'mine'] })
    },
  })
}

export function useRemoveCollectionEntry(): UseMutationResult<void, Error, EntryVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, noteId }: EntryVars) =>
      collectionsApi.removeEntry(collectionId, noteId),
    onSuccess: (_d, { collectionId }) => {
      void qc.invalidateQueries({ queryKey: ['collection', collectionId] })
      void qc.invalidateQueries({ queryKey: ['collections', 'mine'] })
    },
  })
}

export function useReorderCollectionEntries(): UseMutationResult<
  CollectionDetail,
  Error,
  { collectionId: string; noteIds: string[] }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, noteIds }: { collectionId: string; noteIds: string[] }) =>
      collectionsApi.reorderEntries(collectionId, noteIds),
    onSuccess: (detail, { collectionId }) => {
      qc.setQueryData(['collection', collectionId], detail)
    },
  })
}

// ------ Governance: reports + blocks ------

export function useCreateReport(): UseMutationResult<Report, Error, ReportCreateIn> {
  return useMutation({ mutationFn: (body: ReportCreateIn) => reportsApi.createReport(body) })
}

export function useReports(status?: string): UseQueryResult<Report[]> {
  return useQuery({
    queryKey: ['reports', status ?? 'all'],
    queryFn: () => reportsApi.listReports(status),
  })
}

export function useResolveReport(): UseMutationResult<
  Report,
  Error,
  { id: string; body: ReportResolveIn }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReportResolveIn }) =>
      reportsApi.resolveReport(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useMyBlocks(enabled = true): UseQueryResult<Block[]> {
  return useQuery({ queryKey: ['blocks'], queryFn: () => blocksApi.listBlocks(), enabled })
}

export function useBlockUser(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sid: string) => blocksApi.blockUser(sid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['blocks'] })
      void qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useUnblockUser(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sid: string) => blocksApi.unblockUser(sid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['blocks'] })
      void qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

// ------ /me page: published notes + drafts ------

export function useMyNotes(
  enabled = true,
): UseInfiniteQueryResult<{ pages: PaginatedNotes[]; pageParams: (string | undefined)[] }> {
  return useInfiniteQuery({
    queryKey: ['me', 'notes'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const q: ListNotesQuery = { mine: true, limit: 20 }
      if (typeof pageParam === 'string') q.cursor = pageParam
      return notesApi.listNotes(q)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PaginatedNotes) => last.nextCursor ?? undefined,
    enabled,
  })
}

export function useMyDrafts(enabled = true): UseQueryResult<Draft[]> {
  return useQuery({
    queryKey: ['me', 'drafts'],
    queryFn: () => draftsApi.listDrafts(),
    enabled,
  })
}

export function useDeleteDraft(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => draftsApi.deleteDraft(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me', 'drafts'] })
    },
  })
}
