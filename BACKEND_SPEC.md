# LabNotes — Backend Spec (v1)

This document is the authoritative API contract that the frontend
(`frontend/src/api/`) expects. The frontend currently runs on an in-process
mock dispatch table; switching to a real backend requires only `.env`
changes plus commenting one import (see §6).

The backend implementation plan lives in
`/home/winbeau/.claude/plans/5-docs-5-review-agent-approval-commit-humming-bachman.md`.

---

## 1 · Wire-format conventions

| Aspect | Rule |
|---|---|
| baseURL | `VITE_API_BASE` env, default `/api` |
| Content-Type | `application/json` on every request and response |
| Response body | Bare JSON, **no envelope** |
| Errors | HTTP status + `{"detail": "<msg>"}` (FastAPI default) |
| Auth | `Authorization: Bearer <token>` header, only on routes marked **Auth** below |
| Token format | Opaque to frontend; min length 1. Implementation: HS256 JWT, 7-day expiry |
| Pagination | Cursor-based; cursor = id of the last item from the prior page; `nextCursor: null` means no more pages |
| Default `limit` | 6 for `/notes`, clamped to `[1, 50]` |
| Date format | ISO 8601 UTC strings ending in `Z` |
| Field naming | **camelCase** in JSON (e.g. `createdAt`, `readMinutes`, `nextCursor`) |
| Codes used | 200 OK · 201 Created · 204 No Content · 401 Unauthorized · 403 Forbidden · 404 Not Found · 502/504 (AI upstream) |

CORS: real backend must allow `http://localhost:5173` (dev) and the eventual
production frontend origin. `allow_credentials=false`, methods/headers `*`.

---

## 2 · Endpoint table

19 routes total. Routes marked **Auth** require a valid Bearer token.

### Auth (3)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/auth/login` | — | `LoginIn` | `LoginOut` | 401 if sid/password wrong |
| POST | `/auth/logout` | — | empty | 204 | Stateless JWT — server no-op |
| GET | `/auth/me` | ✓ | — | `UserOut \| null` | Returns null only if mock semantics needed; real impl 401 if invalid |

### Notes (5)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/notes` | — | query: `cat?, q?, sort?, tags?, cursor?, limit?` | `PaginatedNotes` | Filtering + sorting server-side |
| GET | `/notes/hot` | — | — | `NoteOut[]` (≤6) | Sort by likes+comments desc |
| GET | `/notes/latest` | — | — | `NoteOut[]` (≤8) | Sort by createdAt desc |
| GET | `/notes/liked` | — | — | `NoteOut[]` (≤6) | Sort by likes desc |
| GET | `/notes/get` | — | query: `id` | `NoteOut` | 404 if not found |

### Drafts (5, all Auth)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/notes/drafts` | ✓ | `DraftIn` | 201 + `DraftOut` | |
| GET | `/notes/drafts` | ✓ | — | `DraftOut[]` | Current user only, sorted updatedAt desc |
| GET | `/notes/drafts/{id}` | ✓ | — | `DraftOut` | 404 for not-owner or missing |
| PATCH | `/notes/drafts/{id}` | ✓ | partial `DraftIn` | `DraftOut` | |
| DELETE | `/notes/drafts/{id}` | ✓ | — | 204 | |
| POST | `/notes/drafts/{id}/publish` | ✓ | — | `NoteOut` | Validates required fields, deletes draft on success |

### Likes (2, all Auth)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/notes/{id}/like` | ✓ | — | 200 | Idempotent |
| DELETE | `/notes/{id}/like` | ✓ | — | 204 | Idempotent |

### Comments (3)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/notes/{id}/comments` | — | query: `cursor?, limit?` | `PaginatedComments` | createdAt desc |
| POST | `/notes/{id}/comments` | ✓ | `{content: string}` | 201 + `CommentOut` | |
| DELETE | `/notes/{id}/comments/{cid}` | ✓ | — | 204 | Allowed for comment author or note author; else 403 |

### AI (1, no auth in v1)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/ai/compose` | — | `AIComposeIn` | `AIComposeOut` | 502/504 if DeepSeek upstream fails |

---

## 3 · Schema reference

These are the canonical shapes. Backend (pydantic v2) and frontend
(zod, `frontend/src/api/schemas/`) must agree byte-for-byte.

### User / Auth

```ts
interface UserOut {
  id: string             // uuid
  sid: string            // 11 digits
  name: string
  avatar?: string        // URL
  bio?: string
}

interface LoginIn {
  sid: string            // /^\d{11}$/
  password: string       // min length 1
}

interface LoginOut {
  user: UserOut
  token: string          // min length 1
}
```

### Notes

```ts
type CategoryId =
  | 'research' | 'course' | 'recommend' | 'competition'
  | 'kaggle'   | 'tools'  | 'life'

interface NoteAuthor {
  id: string
  name: string
  avatar?: string        // URL
}

interface NoteOut {
  id: string             // e.g. 'note_research_001' for seeded; uuid for new
  title: string
  summary: string
  cover?: string         // URL, optional
  category: CategoryId
  tags: string[]
  author: NoteAuthor
  createdAt: string      // ISO 8601 Z
  likes: number          // non-negative int (computed: COUNT likes)
  comments: number       // non-negative int (computed: COUNT comments)
  readMinutes: number    // positive int (derived from content length)
}

interface ListNotesQuery {
  cat?: CategoryId
  q?: string
  sort?: 'latest' | 'hot' | 'liked'
  tags?: string[]        // wire as comma-separated string in query
  cursor?: string
  limit?: number         // 1-50
}

interface PaginatedNotes {
  items: NoteOut[]
  nextCursor: string | null
}
```

### Drafts

```ts
interface DraftIn {                  // POST/PATCH body
  title?: string
  content?: string
  category?: CategoryId
  tags?: string[]
}

interface DraftOut {
  id: string                         // uuid
  title: string                      // may be empty for newly created
  content: string
  category: CategoryId | null
  tags: string[]
  updatedAt: string                  // ISO 8601 Z
}
```

### Likes / Comments

```ts
interface CommentOut {
  id: string                         // uuid
  noteId: string
  author: NoteAuthor
  content: string
  createdAt: string                  // ISO 8601 Z
}

interface PaginatedComments {
  items: CommentOut[]
  nextCursor: string | null
}
```

### AI compose

```ts
type AIComposeMode =
  | 'polish' | 'shorten' | 'expand' | 'tone' | 'translate' | 'custom'

interface AIComposeIn {
  mode: AIComposeMode
  text: string                       // min length 1
  options?: Record<string, unknown>  // mode-specific
  // tone:      { target: 'formal' | 'casual' }
  // translate: { target: 'en' | 'zh' }
  // custom:    { prompt: string }
}

interface DiffSegment {
  type: 'equal' | 'add' | 'del'
  text: string
}

interface AIComposeOut {
  segments: DiffSegment[]
  before: string
  after: string
  elapsedMs: number                  // server processing time, non-negative
}
```

---

## 4 · Persistence surface

| Frontend store | Persisted via | Backend takes over? | Notes |
|---|---|---|---|
| `authStore` (`stores/authStore.ts`) | Zustand `persist` → `localStorage:labnotes.auth` | **Token validation** moves server-side. `mode` flag (authed/guest/anon) stays local | Frontend continues to keep `token + user` in localStorage for offline UI |
| `draftStore` (`stores/draftStore.ts`) | Zustand `persist` → `localStorage:labnotes.drafts` | **Yes — Phase 5 endpoints exist server-side**, but in v1 frontend keeps localStorage as the source of truth. v2 will mirror to backend on save | Migration strategy in plan §Phase 5.2 |
| TanStack Query cache | runtime only | n/a | Standard query cache, no persistence |

---

## 5 · Open questions / v2

These are explicitly **not** in v1:

1. **Streaming AI** — DeepSeek supports SSE (`stream=true`); v1 is sync. `AIComposeOut` schema unchanged when v2 streams (frontend hook will absorb chunks into the same shape).
2. **Refresh tokens** — v1 issues a 7-day JWT and asks user to re-login. No refresh endpoint.
3. **File uploads** — `NoteOut.cover` exists in schema but no upload endpoint. Add `/notes/{id}/cover` (multipart) when needed.
4. **Rate limiting** — no `X-RateLimit-*` headers in v1.
5. **Drafts → backend sync** — endpoint exists; UI integration deferred (see Persistence table).
6. **Likes/Comments UI** — backend ready; frontend has no like button or comment list yet.

---

## 6 · "Switch to real backend" checklist

For the frontend to talk to the real backend:

```bash
# 1. Set the base URL
echo 'VITE_API_BASE=http://localhost:8000' > frontend/.env.local

# 2. (Optional) keep dev mock as fallback by leaving the comment in place,
#    or delete it when you no longer need the mock dispatch:
#    src/api/index.ts
#    // if (import.meta.env.DEV) {
#    //   await import('./mock/handlers')
#    // }
```

That is the entire delta. Business code in `components/`, `features/`,
`pages/`, `hooks/`, `stores/` does not change. The contract above is what
the backend must satisfy for that to remain true.

---

## Cross-references

- Frontend architecture: `docs/architecture.md`
- Frontend design decisions: `docs/design-decisions.md`
- Frontend delivery report: `frontend/INTEGRATION_REPORT.md`
- Backend implementation plan: `/home/winbeau/.claude/plans/5-docs-5-review-agent-approval-commit-humming-bachman.md`
