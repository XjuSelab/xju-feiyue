# LabNotes — Design References Archive

This directory holds the original HTML/CSS/JSX design prototypes that informed
the LabNotes frontend. **All visual rules and component behaviors have been
migrated to `frontend/src/{components,features,styles}`** — these files are
kept for historical reference and visual diffing only, and are not imported
by any code.

| Folder | Origin | Migrated to |
|---|---|---|
| `pages/` | 6 standalone HTML mocks (home / browse / write / login / app shell / design-system) | `frontend/src/pages/` + `frontend/src/features/*/sections/` + `frontend/src/pages/_dev/DesignSystemPage.tsx` |
| `components/` | 3 JSX mocks (ai-drawer / icons / mega-menu) | `frontend/src/features/editor/ai/` + `frontend/src/lib/categories.ts` + `frontend/src/components/layout/MegaMenu.tsx` |
| `stylesheets/` | `styles.css` — single-file design language baseline | `frontend/src/styles/{tokens.css,globals.css,prose-claude.css}` + `frontend/tailwind.config.ts` |

If you want to compare the production component against its original mock,
open the HTML directly in a browser (e.g. `open archive/design-refs/pages/login.html`).
The CSS/JSX files reference `stylesheets/styles.css` via relative paths so
they render standalone.

These files are excluded from `frontend/` lint, typecheck, and bundle —
moving them here ensures they cannot accidentally be imported.
