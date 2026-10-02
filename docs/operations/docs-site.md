---
title: Docs site
description: How the owner-only /docs site is built from docs/ with Docusaurus, kept in step with the sources, and how to add a page.
sidebar_position: 3
---

# Docs site

These documents are served by the app itself at `/docs`, as a Docusaurus site
built from the Markdown in `docs/`. The same files read normally on GitHub and
in the editor; the site only renders them. The built site is committed, and a
test fails when it falls behind the sources.

| | |
| --- | --- |
| **Where** | `/docs` on the app · sources in `docs/` · renderer in `docs/site/` · build output in `public/docs/` |
| **Who can open it** | Only the account signed in with `AUTH_USERNAME` and `AUTH_PASSWORD` |
| **Commands** | `bun run docs:dev` (preview) · `bun run docs:build` (build and stamp) |

## Rules

- Only the password account configured by `AUTH_USERNAME` and `AUTH_PASSWORD` can open `/docs`. Anyone else who is signed in gets the same 404 as a page that does not exist.
- The documents live in `docs/`. `docs/site/` only renders them — edit the `.md` files, never copies.
- The built site in `public/docs/` is committed; deploys do not build it.
- After changing any document, run `bun run docs:build` and commit `public/docs`. Otherwise `tests/unit/docs-built.test.ts` fails.
- Pages are plain CommonMark + GFM, not MDX: no JSX, no imports, no `{}` expressions.
- A broken link or a broken Markdown link fails the build.
- The site is never indexed by search engines.

## Preview the docs while writing

1. Run `bun run docs:dev`. It starts the Docusaurus dev server from `docs/site` on port 3001.
2. Open `http://localhost:3001/docs/`.
3. Edit any `.md` file under `docs/`; the page reloads.

The first run needs the site's own dependencies: `bun install --cwd docs/site`.

## Build and publish the docs

1. Run `bun run docs:build`. It:
   1. installs `docs/site`'s dependencies from its lockfile (`bun install --cwd docs/site --frozen-lockfile`);
   2. builds the site into `public/docs/` (`docusaurus build --out-dir ../../public/docs`);
   3. runs `scripts/docs-stamp.ts`, which records a hash of every source document in `public/docs/.sources.json`.
2. Run the unit tests. `tests/unit/docs-built.test.ts` should pass.
3. Commit the changed documents together with `public/docs`.

## Add a page

1. Create a `.md` file in the folder it belongs to — `docs/get-started/`, `docs/features/`, `docs/operations/` or `docs/reference/…`.
2. Start it with front matter:

   ```md
   ---
   title: Habits
   description: One sentence saying what the page is for.
   sidebar_position: 4
   ---

   # Habits
   ```

   The `#` heading matches `title`; `sidebar_position` orders the page within its folder.
3. Link to other pages by relative path to the `.md` file, for example `../features/timer.md` or `./budgets.md`.
4. For a new folder, add a `_category_.json` that names it and places it, for example `{ "label": "Finance", "position": 9, "link": { "type": "doc", "id": "features/finance/overview" } }`. `link` makes the folder's label open one of its pages.
5. Preview with `bun run docs:dev`, then build and commit as above.

## How it works

**Why only the owner.** The documentation describes the schema and the
reasoning behind the Firestore rules, which is the owner's business, not every
account's. The check in `src/proxy.ts` lets a session through to `/docs` only
when it is a password sign-in whose subject is the configured `AUTH_USERNAME`;
the subject is checked as well as the provider, so changing `AUTH_USERNAME`
shuts out a session issued to the old one. Anyone else signed in gets the same
404 as a page that does not exist, so the gate does not announce itself.
Someone not signed in meets the sign-in page, as on every other page.

**How the pages are served.** Docusaurus writes one `.html` file per page, with
`baseUrl: '/docs/'` and no trailing slash. A page's address has no extension, so
`next.config.ts` rewrites `/docs` to `/docs/index.html` and `/docs/<page>` to
`/docs/<page>.html`; assets keep their extension and are served as they are. The
session check runs on the address asked for, before the rewrite.

**What the renderer is configured to do** (`docs/site/docusaurus.config.ts`):

- reads the documents from `docs/` (`path: '..'`), excluding `site/**`, and serves them from the site root;
- builds the sidebar from the folders, their `sidebar_position` and `_category_.json` files;
- parses `.md` as plain CommonMark (`markdown.format: 'detect'`), so a stray `<` or `{` in the prose cannot break the build the way MDX would;
- draws Mermaid diagrams (`mermaid: true`, light and dark themes);
- adds a local full-text search (`@easyops-cn/docusaurus-search-local`), with no outside service;
- throws on broken links and broken Markdown links;
- sets `noIndex`, follows the system's light or dark preference, and highlights `bash`, `sql`, `json` and `typescript`.

**Why the build is committed.** Building on every deploy would take a second
dependency tree and a second bundler onto every push, to publish pages nobody
changed. The price is that editing a document no longer publishes it — somebody
has to remember to run the build — and a stale page is the one failure that
looks exactly like a working one.

**The stamp.** So the sources are stamped: `scripts/docs-stamp.ts` walks every
`.md` file under `docs/`, recursively and leaving out `docs/site/`, and writes
the first 16 hex characters of each file's SHA-256 to `public/docs/.sources.json`.
`tests/unit/docs-built.test.ts` recomputes the same hashes from the files on
disk and compares. Forgetting the rebuild turns a silent drift into a red test —
the same bargain `.env.example` makes with its own test. If the stamp file is
missing, the test says to run `bun run docs:build`.

## Limits

- Editing a document does not update the live site until someone rebuilds and commits.
- No MDX features: no components, tabs or admonitions. Notes are written as `> **Note:**` blockquotes, which render both here and on GitHub.

## Related

- [Configuration](./configuration.md) — `AUTH_USERNAME` and `AUTH_PASSWORD`, which decide who can open `/docs`
- [Sign in](../get-started/sign-in.md) — the password sign-in that is the only way into `/docs`
- [Scheduled jobs](./scheduled-jobs.md) — the other operations page for the person running the app
- [Data model overview](../reference/data-model/overview.md) — the schema documentation that makes these pages owner-only
- [Live updates setup](../reference/realtime/setup.md) — the Firestore rules reasoning the gate protects
