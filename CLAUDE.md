@AGENTS.md

# Deploying

A push to `main` deploys. Code reaches production in about a minute; a
migration never runs itself. So a schema change that is pushed before it is
migrated takes the affected pages down until someone notices.

**Before every push, check whether the commits touch `drizzle/`. If they do,
run the migration on production first:**

```bash
DATABASE_URL="<production connection string>" pnpm db:migrate
```

`pnpm db:migrate` prints the host and database before it touches anything, and
says how many migrations it applied — read that line and confirm it is
production, not the local database. If the production URL is not to hand, ask
for it and wait; do not push the migration and leave it unapplied.

Order matters in one direction only: the migration goes first. Every migration
in this repo must therefore be safe against the version of the code already
running — add columns and tables, and leave the drops for a later pass.

# Text a person reads

Every user-facing string lives in `messages/en.json` and `messages/vi.json`,
never inline in a component. The one exception is `app/global-error.tsx`,
which renders when the root layout itself has failed and therefore cannot
reach i18n.

**Vietnamese is written, not translated.** Write the sentence a Vietnamese
speaker would say, then check it still means what the English means — not the
other way round. Word-for-word order produces sentences no one says:

> ✗ "Viết như bạn nói. Phần điền vào biểu mẫu để hệ thống lo."
> ✓ "Cứ viết như bạn đang nói, app tự điền vào các ô."

Keep out of both locales:

- **Administrative vocabulary.** `biểu mẫu`, `thao tác`, `thực hiện`,
  `tiến hành`, `vui lòng`, `quý khách`. This is a personal app, not a form at
  a government office.
- **The system as a character.** Not "hệ thống sẽ xử lý" or "the system will
  process" — say what happens: "app tự điền", "đã lưu".
- **Internal words.** Table names, `null`, error codes, HTTP status numbers.
  A digest or a status code goes to `console.error`, where whoever is fixing
  it will look.

An error message says what happened and what the person can do next, in that
order. "Không đọc được ghi chú này" beats "Lỗi phân tích dữ liệu đầu vào".

Both files hold the same keys: `tests/unit/i18n.test.ts` fails on a missing
key, an empty string, or placeholders that differ between locales.
