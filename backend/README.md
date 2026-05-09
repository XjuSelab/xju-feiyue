# LabNotes — Backend

FastAPI + SQLAlchemy 2 (async) + Postgres. Mirrors the API contract in
`../BACKEND_SPEC.md` so the frontend can switch from its mock dispatch table
to a real server with one env-variable change.

This file documents the **Phase 1 scaffold**. Routes return stubs (empty
arrays / 501) until Phases 2-7 fill in the implementation.

---

## Quick start (local)

```bash
# 1. Python 3.11 + uv
uv sync

# 2. .env.local — copy from .env.example and fill in secrets
cp .env.example .env.local
# edit DATABASE_URL, JWT_SECRET, DEEPSEEK_API_KEY

# 3. (Once DB schema is added in Phase 2)
uv run alembic upgrade head
uv run python scripts/seed.py

# 4. Boot
uv run uvicorn app.main:app --reload
# → http://localhost:8000   /openapi.json /health
```

For a quick zero-DB smoke test:

```bash
DATABASE_URL='sqlite+aiosqlite:///./labnotes.db' uv run uvicorn app.main:app --reload
curl localhost:8000/health           # {"status":"ok"}
curl localhost:8000/openapi.json | jq '.paths | keys'
```

## Tests

```bash
uv run pytest -v
```

Tests use an in-memory SQLite DB — no Postgres required.

## Lint

```bash
uv run ruff check .
uv run ruff format --check .
```

## Layout

```
backend/
├── pyproject.toml
├── alembic.ini
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/             # generated migrations land here
├── app/
│   ├── main.py               # FastAPI + CORS + router registration
│   ├── settings.py           # pydantic-settings → .env.local
│   ├── deps.py               # get_db / get_current_user
│   ├── db/                   # Base + engine + ORM models
│   ├── schemas/              # pydantic v2, camelCase JSON
│   ├── routes/               # auth · notes · drafts · interactions · ai
│   ├── services/             # auth(JWT) · diff · ai_compose
│   └── tests/                # pytest-asyncio + httpx ASGI
└── scripts/
    ├── seed.py               # 14 notes + 5 users from frontend/mock
    └── reset_db.py           # drop + create all tables (dev only)
```

## Phase status

- [x] **Phase 1** — scaffold (this commit): pydantic schemas, route stubs,
  alembic config, smoke tests
- [ ] **Phase 2** — DB models + initial migration + seed
- [ ] **Phase 3** — auth (login / logout / me) wired to DB + JWT
- [ ] **Phase 4** — notes (list / hot / latest / liked / get) with SQL
- [ ] **Phase 5** — drafts CRUD + publish
- [ ] **Phase 6** — likes + comments
- [ ] **Phase 7** — AI compose via DeepSeek V4 Flash
- [ ] **Phase 8** — frontend wiring (`.env`, drop dev mock toggle)

See `/home/winbeau/.claude/plans/5-docs-5-review-agent-approval-commit-humming-bachman.md`
for the full plan.

## Environment variables

| name | default | purpose |
|---|---|---|
| `DATABASE_URL` | sqlite memory | `postgresql+asyncpg://user:pw@host/db` for prod |
| `JWT_SECRET` | dev placeholder | HS256 signing key (`openssl rand -hex 32`) |
| `JWT_EXPIRE_MINUTES` | 10080 | 7 days |
| `DEEPSEEK_API_KEY` | empty | OpenAI-compatible key from api.deepseek.com |
| `DEEPSEEK_BASE_URL` | https://api.deepseek.com | override only for proxy/staging |
| `DEEPSEEK_MODEL` | deepseek-v4-flash | `deepseek-v4-flash` or `deepseek-v4-pro` |
| `DEEPSEEK_DRY_RUN` | 0 | when `1`, `/ai/compose` echoes input (tests) |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated list |
