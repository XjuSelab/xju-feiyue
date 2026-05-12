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
import type { Note, ListNotesQuery, PaginatedNotes } from './schemas/note'
import type { AIComposeRequest, AIComposeResponse } from './schemas/ai'

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

export function useHotNotes(): UseQueryResult<Note[]> {
  return useQuery({
    queryKey: ['notes', 'hot'],
    queryFn: notesApi.getHotThisWeek,
  })
}

export function useLatestNotes(): UseQueryResult<Note[]> {
  return useQuery({
    queryKey: ['notes', 'latest'],
    queryFn: notesApi.getLatest,
  })
}

export function useMostLikedNotes(): UseQueryResult<Note[]> {
  return useQuery({
    queryKey: ['notes', 'liked'],
    queryFn: notesApi.getMostLiked,
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
