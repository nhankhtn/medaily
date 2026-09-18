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

# Committing

Do not commit. Write the code, run the checks, say what changed — and stop
there. `git commit` happens when I ask for it in that turn, and not because a
piece of work looks finished.

The same goes for `git push`, with the deploy rule above on top of it.

# How big a control is

Phone first, and on a phone everything is one size smaller. A phone screen is
mostly chrome; the four pixels a desktop button spends on comfort are pixels
the thing you actually came for gets pushed down by. `Button`, `Input`,
`Select` and `Textarea` already carry this — use them and you get it for free:

| | phone | `sm:` and up |
| --- | --- | --- |
| `Button` md | 40px | 44px |
| `Button` sm | 32px | 36px |
| `Button` lg | 44px | 48px |
| `Input` / `Select` | 40px | 44px |

Three button sizes, and which one to reach for is the button's job, not its
looks. Mixing them within one row is the only thing that reads as an accident:

- **`lg`** — the one thing a screen is for. Save the day, start the timer, sign
  in. At most one per screen.
- **`md`** (the default) — an action inside a form or a dialog. Save, Cancel,
  Add. Never pass `size` for these; the default is already right.
- **`sm`** — a button that opens something rather than doing something: the
  trigger in a page header or a card header, a toolbar. Also the actions inside
  a panel too small for anything larger, which today means the capture box.

Do not hand a control a bare `h-*`. If a dense row needs something shorter,
write `h-9 sm:h-10` so the phone still gets the smaller of the two, and never
go under 32px for anything a finger has to hit.

**Never give `<input type="date">` a fixed width on a phone.** Safari draws its
own text at its own size — in Vietnamese that is `ngày 18 thg 9, 2026`, far
wider than the box a desktop layout would hand it, and the date spills out of
its own border. Write `w-full sm:w-36`, and on a phone give it a row of its own
rather than a share of one.

**Anything typed into keeps 16px type on a phone.** Safari on iOS zooms the
whole page when a field smaller than that takes focus, and the zoom is what
sends a floating panel skidding out from under a thumb. So `text-sm` on an
input is `text-base sm:text-sm`, never `text-sm` alone. Buttons, badges and
labels are not typed into and have no such floor.

Two things are deliberately larger on a phone than on a desktop, and both are
the same reason — a finger has to *find* them, not just read them: the drag
handle on a goal (`size-11 sm:size-7`) and the delete on a row. When you add
another of those, size it the same way round and say why.

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
