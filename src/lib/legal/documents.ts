import { env } from '@/lib/env'
import type { Locale } from '@/i18n/config'

/**
 * The terms and the privacy notice, as whole documents rather than a hundred
 * keys in `messages/*.json`.
 *
 * This is the one deliberate exception to "every user-facing string lives in
 * messages". A privacy notice is read, reviewed and signed off as a document:
 * a lawyer has to read it end to end, and a paragraph split across ninety
 * numbered keys cannot be read that way. What the messages files buy — both
 * locales staying in step — is bought here instead by
 * `tests/unit/legal-documents.test.ts`, which fails on a missing document, a
 * missing locale or an empty body.
 *
 * **These are a starting draft, not legal advice.** They describe what the
 * code actually does today, which is the part worth getting right before a
 * lawyer looks at them; the promises, the governing law and the company
 * details are theirs to set.
 */
export type LegalDocument = 'terms' | 'privacy'

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = ['terms', 'privacy'] as const

/** Shown beside the title so a reader knows which version they are reading. */
export const LEGAL_UPDATED_ON = '2026-10-01'

type Document = { title: string; body: string }

const PRIVACY_EN = `
## What this is

Personal OS keeps a journal, a health log, a ledger and a contact book for one
person: you. Everything below is about the account you sign in to, and with one
exception nothing in it is shown to other people who use the app.

The exception is chat. A room you join is shared on purpose: the people in it
see your name, your picture and everything you write there. Nothing else
crosses over — your journal, your ledger, your health log and your contacts
stay yours, and being in a room with somebody gives them no way to see any of
it.

## What is collected

**From your Google account, when you sign in:** your email address, your
display name and your profile picture. Nothing else — no contacts, no calendar,
no files.

**What you type in:** daily logs, journal entries, habits, goals, projects,
health measurements, learning notes, career records, and a ledger of accounts,
transactions and budgets. If you use the contact book, whatever you record
about the people in it, which can include phone numbers, email addresses,
birthdays and bank account details.

**Pictures you upload**, if you add any.

**What you write in a chat room**, if you use one. The message itself, when it
was sent, and which room it was in. It is kept in the **MongoDB** database —
the same one as the record below, not the main one — and unlike that record it
does **not** expire: a conversation that quietly deleted itself would be a bug,
not a policy.

Everyone in the room can read it for as long as the room exists. Taking
somebody out of a room does not unsend what they already read. You can recall
one of your own messages, which removes the text for everyone; that the message
was there stays visible.

**Nothing you write is sent to Google.** Rooms update by themselves through a
Firebase service, but what travels there is a counter and a clock, addressed by
a key that is not the room's name — enough to say "this room changed", and
nothing more. That key is replaced whenever somebody is removed from a room.

**A record of what changed**, if this deployment keeps one: the moment, what
kind of change it was — a transaction deleted, a person added — which row it
was about, and, for the fields it follows, what they held before and after.
Each time you signed in or out is in there too, with the browser and system
you used — "Chrome · Windows", read from what your browser tells every site it
visits and kept only in that shortened form — and roughly where from, as a city
and a country. That place is worked out from your IP address while the request
is arriving, and **the address itself is never stored**: what stays is "Hà Nội,
VN" and nothing narrower. Both are there so that a sign-in you did not make is
something you can spot, which needs the device and the place to be nameable.
The rest is kept so you can see what happened to your own data, which is the
point of showing an amount going from one figure to another.

What it follows is a fixed list per kind of record: amounts, dates, names,
categories, and the like. It never holds the text of a journal entry, a note
or your daily log, and a bank account number appears only as its last four
digits. This record lives in a **MongoDB** database rather than the main one,
it expires on its own after 90 days, and deleting your account erases it
first.

**How the pages are used**, if this deployment has measurement switched on.
Two things measure, and they are not alike.

**Google Analytics for Firebase** records which pages were opened, and it does
so under an identifier it stores in your browser. That identifier is what lets
it tell one visit from the next, so unlike a plain page counter it **does build
a profile across visits** — which pages, how often, from roughly where (worked
out from your IP address), on what kind of device. Google is the one holding
it, under their own terms. It cannot see anything you typed: a page address,
never the contents of a journal entry or a transaction.

**Vercel Speed Insights** records how quickly pages loaded. It uses no
identifier, builds no profile and sees nothing you typed.

Where measurement is off, nothing is sent and no script is loaded.

**What you write in**, if you use the contact form. The note, the page you
were on, and either your account name or the address you gave for an answer,
are passed to a **Telegram** chat read by whoever runs this. Nothing is stored
here: the note is forwarded and no record of it is kept in the database. Don't
put a password in it — nothing ever needs one.

**Nothing else.** There is no advertising, nothing sold to anyone, and no
third-party script reading what you write.

## Where it is kept

- The database is hosted by **Neon**, in the United States.
- The record of what changed, where it is kept, is held by **MongoDB Atlas**.
- The app runs on **Vercel**.
- Pictures are stored by **Cloudinary**.
- Page measurements, where they are on, go to **Google**.
- Speed measurements, where they are on, go to **Vercel**.
- Notes sent through the contact form go to **Telegram**.
- Sign-in is handled by **Google Firebase**, which verifies who you are. Your
  password, if you have one with Google, is never seen by this app.

**What you write in a chat room is locked before it reaches that database.**
It is encrypted with a key the app holds, so a copy of the database on its own
— a backup, an export, or whoever runs the machines it sits on — reads as
nothing.

Because the app holds the key, this is **not** end-to-end encryption: whoever
runs this app can read what you write in a room. If that matters for something
you were about to say, do not say it here.

Data therefore leaves Vietnam and is processed in the United States.

## The AI features

When you use the capture box, the review chat or the assistant, the text you
wrote is sent to a separate service run alongside this app, which passes it to
a language model to be read and turned into entries. Only the text you typed
for that request is sent — not your ledger, not your health log, not your
journal.

If the AI features are switched off for this deployment, nothing is ever sent
anywhere for this purpose and every screen still works by hand.

## How long it is kept

Until you delete it. There is no automatic expiry and no archive: a deleted
transaction is gone from the database, and a deleted account takes everything
with it.

**Chat is the one exception, and it is worth reading twice.** What you wrote in
a room stays in that room after you delete your account, because it is part of
somebody else's conversation and taking it out would leave holes in a record
that was never only yours. Your name comes off it — nothing points back at you
any more, and it can no longer be found by looking for you — but the words
remain. If that is not what you want, recall those messages before you delete
the account; recalling removes the text for everyone.

## What you can do

- **Take it with you.** Settings → Data exports everything as JSON or CSV, at
  any time, without asking anyone.
- **Delete it.** Settings → Delete this account removes the account and every
  record under it, including the pictures held by Cloudinary, and takes your
  name off anything you wrote in a chat room. It is immediate and it cannot be
  undone. See above for what chat keeps.
- **Correct it.** Every record in the app can be edited in the app.

## Getting in touch

Exporting your data and deleting your account are both in Settings and need
nobody's permission, so most of what this page grants you is already a button.
For anything else — a question about the above, or a request you cannot carry
out yourself — {contact}
`

const PRIVACY_VI = `
## Đây là gì

Personal OS giữ nhật ký, theo dõi sức khoẻ, sổ chi tiêu và danh bạ cho một
người: bạn. Mọi thứ dưới đây nói về tài khoản bạn đăng nhập, và trừ đúng một
chỗ thì không có gì trong đó hiện ra cho người khác đang dùng app.

Chỗ đó là phần nhắn tin. Phòng bạn tham gia là để chia sẻ: những người trong đó
thấy tên bạn, ảnh bạn và mọi thứ bạn viết ở đấy. Ngoài ra không gì khác đi qua —
nhật ký, sổ chi tiêu, chỉ số sức khoẻ và danh bạ vẫn là của riêng bạn, và ở
chung phòng với ai đó không cho họ đường nào nhìn vào những thứ ấy.

## Những gì được thu thập

**Từ tài khoản Google khi bạn đăng nhập:** địa chỉ email, tên hiển thị và ảnh
đại diện. Không gì khác — không danh bạ, không lịch, không tệp.

**Những gì bạn tự nhập:** nhật ký ngày, ghi chép, thói quen, mục tiêu, dự án,
chỉ số sức khoẻ, ghi chú học tập, hồ sơ nghề nghiệp, cùng sổ tài khoản, giao
dịch và ngân sách. Nếu bạn dùng danh bạ thì gồm cả những gì bạn ghi về người
trong đó, có thể có số điện thoại, email, ngày sinh và số tài khoản ngân hàng.

**Ảnh bạn tải lên**, nếu có.

**Những gì bạn viết trong phòng chat**, nếu bạn dùng. Nội dung tin nhắn, lúc
gửi, và nó thuộc phòng nào. Chỗ lưu là cơ sở dữ liệu **MongoDB** — cùng chỗ với
bản ghi bên dưới, không phải cơ sở dữ liệu chính — và khác với bản ghi đó, nó
**không** tự hết hạn: một cuộc trò chuyện tự lặng lẽ xoá mình đi thì là lỗi,
không phải chính sách.

Mọi người trong phòng đọc được, chừng nào phòng còn. Mời ai đó ra khỏi phòng
không lấy lại được những gì họ đã đọc. Bạn thu hồi được tin của chính mình,
lúc đó nội dung mất với tất cả mọi người; còn dấu vết là đã từng có một tin ở
đó thì vẫn còn.

**Không chữ nào bạn viết đi tới Google.** Phòng tự cập nhật qua một dịch vụ của
Firebase, nhưng thứ đi qua đó chỉ là một bộ đếm và một mốc giờ, gửi dưới một
khoá không phải tên phòng — đủ để nói "phòng này có thay đổi", không hơn. Khoá
đó được thay mới mỗi khi có người bị mời ra khỏi phòng.

**Bản ghi những gì đã đổi**, nếu bản cài này có giữ: thời điểm, việc đã làm là
gì — xoá một giao dịch, thêm một người — dòng nào, và với những trường được
theo dõi thì cả giá trị trước lẫn sau. Mỗi lần bạn đăng nhập, đăng xuất cũng
nằm trong đó, kèm trình duyệt và hệ điều hành bạn dùng — "Chrome · Windows",
đọc từ thứ trình duyệt tự khai với mọi trang web và chỉ giữ lại ở dạng rút gọn
đó — cùng nơi truy cập ở mức thành phố và quốc gia. Nơi đó được suy ra từ địa
chỉ IP ngay lúc request đi vào, và **bản thân địa chỉ IP không được lưu**: thứ
nằm lại chỉ là "Hà Nội, VN", không chi tiết hơn. Cả hai có ở đó để một lần đăng
nhập không phải của bạn thì nhìn ra được, mà muốn vậy thì phải gọi tên được
thiết bị và nơi truy cập. Phần còn lại giữ để bạn tự xem lại dữ
liệu của mình đã qua những gì — chính vì vậy mà số tiền đổi từ bao nhiêu sang
bao nhiêu được ghi lại.

Những trường được theo dõi là một danh sách cố định cho từng loại bản ghi: số
tiền, ngày, tên, danh mục và tương tự. Nó không bao giờ chứa nội dung một ghi
chép, một ghi chú hay bản ghi ngày, còn số tài khoản ngân hàng chỉ hiện bốn số
cuối. Riêng bản ghi này nằm trong một cơ sở dữ liệu **MongoDB** chứ không phải
cơ sở dữ liệu chính, tự hết hạn sau 90 ngày, và khi bạn xoá tài khoản thì nó bị
xoá trước tiên.

**Cách các trang được dùng**, nếu bản cài này có bật đo đạc. Có hai thứ đo, và
chúng khác nhau.

**Google Analytics for Firebase** ghi lại trang nào được mở, và nó ghi kèm một
mã nhận dạng lưu trong trình duyệt của bạn. Chính mã đó cho phép nó phân biệt
lần vào này với lần vào sau, nên khác với một bộ đếm trang thuần túy, nó **có
dựng hồ sơ về bạn qua nhiều lần truy cập** — vào trang nào, bao nhiêu lần, từ
đâu (suy ra từ địa chỉ IP), bằng thiết bị gì. Google là bên giữ số liệu đó,
theo điều khoản của họ. Nó không thấy được thứ bạn gõ vào: chỉ là địa chỉ
trang, không bao giờ là nội dung một ghi chép hay một giao dịch.

**Vercel Speed Insights** ghi lại trang tải nhanh chậm ra sao. Nó không dùng mã
nhận dạng nào, không dựng hồ sơ, và không thấy thứ bạn gõ.

Chỗ nào tắt đo đạc thì không gửi gì và cũng không nạp script nào.

**Những gì bạn viết vào form liên hệ**, nếu bạn dùng nó. Nội dung, trang bạn
đang mở, cùng tên tài khoản hoặc địa chỉ bạn để lại, được chuyển tới một đoạn
chat **Telegram** do người vận hành đọc. Ở đây không lưu gì cả: tin được
chuyển đi và không bản ghi nào nằm lại trong cơ sở dữ liệu. Đừng viết mật khẩu
vào đó — không bao giờ cần tới.

**Không gì khác nữa.** Không quảng cáo, không bán cho ai, không script của bên
thứ ba nào đọc những gì bạn viết.

## Dữ liệu nằm ở đâu

- Cơ sở dữ liệu đặt tại **Neon**, ở Mỹ.
- Bản ghi những gì đã đổi, chỗ nào có giữ, nằm ở **MongoDB Atlas**.
- App chạy trên **Vercel**.
- Ảnh lưu ở **Cloudinary**.
- Số liệu trang, chỗ nào bật, gửi về **Google**.
- Số liệu tốc độ, chỗ nào bật, gửi về **Vercel**.
- Tin gửi qua form liên hệ đi tới **Telegram**.
- Đăng nhập do **Google Firebase** xử lý để xác minh bạn là ai. Mật khẩu
  Google của bạn không bao giờ đi qua app này.

**Những gì bạn viết trong phòng chat được khoá lại trước khi xuống cơ sở dữ
liệu đó.** Nó được mã hoá bằng một chiếc khoá do app giữ, nên ai cầm được bản
sao của cơ sở dữ liệu — bản backup, bản export, hay người vận hành máy chủ
chứa nó — cũng chỉ thấy một mớ không đọc được.

Nhưng vì khoá nằm ở app, đây **không phải** mã hoá đầu cuối: người vận hành
app này đọc được những gì bạn viết trong phòng. Nếu điều đó có ảnh hưởng tới
chuyện bạn định nói, thì đừng nói ở đây.

Nghĩa là dữ liệu ra khỏi Việt Nam và được xử lý tại Mỹ.

## Phần AI

Khi bạn dùng ô ghi nhanh, chat tổng kết hay trợ lý, đoạn chữ bạn viết được gửi
sang một dịch vụ riêng chạy cạnh app, rồi chuyển tiếp cho mô hình ngôn ngữ đọc
và tách thành các mục. Chỉ đoạn chữ của lần đó được gửi — không gửi sổ chi
tiêu, không gửi theo dõi sức khoẻ, không gửi nhật ký.

Nếu bản cài này tắt phần AI thì không có gì được gửi đi đâu cả, và mọi màn hình
vẫn dùng tay được như thường.

## Giữ trong bao lâu

Đến khi bạn xoá. Không có hạn tự hết và không có kho lưu: một giao dịch đã xoá
là mất khỏi cơ sở dữ liệu, và xoá tài khoản thì mang theo tất cả.

**Phần nhắn tin là ngoại lệ duy nhất, và nên đọc kỹ.** Những gì bạn viết trong
một phòng sẽ ở lại đó sau khi bạn xoá tài khoản, vì nó là một phần cuộc trò
chuyện của người khác, lấy đi sẽ để lại lỗ hổng trong một bản ghi vốn không chỉ
của riêng bạn. Tên bạn được gỡ khỏi nó — không còn gì trỏ ngược về bạn, và cũng
không tìm ra được bằng cách tìm theo bạn — nhưng chữ thì còn. Nếu không muốn
vậy, hãy thu hồi những tin đó trước khi xoá tài khoản; thu hồi thì nội dung mất
với tất cả mọi người.

## Bạn làm được gì

- **Mang dữ liệu đi.** Cài đặt → Dữ liệu cho tải toàn bộ dưới dạng JSON hoặc
  CSV, bất cứ lúc nào, không phải xin ai.
- **Xoá đi.** Cài đặt → Xoá tài khoản này xoá tài khoản và mọi bản ghi thuộc
  về nó, gồm cả ảnh đang giữ ở Cloudinary, và gỡ tên bạn khỏi những gì bạn đã
  viết trong phòng chat. Có hiệu lực ngay và không hoàn tác được. Phần nhắn tin
  giữ lại gì thì xem ở trên.
- **Sửa lại.** Mọi bản ghi trong app đều sửa được ngay trong app.

## Liên hệ

Tải dữ liệu về và xoá tài khoản đều nằm trong Cài đặt và không phải xin phép
ai, nên phần lớn những gì trang này cho bạn đã là một nút bấm. Còn lại — thắc
mắc về những điều trên, hoặc yêu cầu bạn không tự làm được — {contact}
`

const TERMS_EN = `
## Using this app

Personal OS is a place to keep track of your own life. You may use it for that.
Do not use it to store other people's records without their knowledge, and do
not use it for anything against the law where you live.

## Your account

One account belongs to one person. Keep your Google sign-in to yourself:
anything done through your account is treated as done by you.

## Your data is yours

Everything you put in stays yours. It is not sold, not shared with advertisers,
and not used to train anybody's model. You can export all of it or delete all
of it at any time, from Settings.

## What this app does not promise

It is offered as it is. There is no guarantee that it will be available at any
particular moment, that it will never lose data, or that it will keep working
the way it does today.

**Keep your own backups.** The export in Settings exists for this. A personal
record you cannot afford to lose should exist somewhere besides one service.

## What it is not

Not a doctor, not an accountant and not a financial adviser. The health log is
a notebook, and the numbers the app works out from it — scores, streaks,
correlations — are arithmetic on what you typed, not a finding about your
health or your money. Decisions that matter belong with someone qualified.

## Stopping

You can delete the account whenever you want, from Settings, and it goes
immediately. The account can also be closed from this side if it is being used
to break these terms.

## Changes

These terms can change. Meaningful changes will be shown in the app before they
take effect, and the date at the top of this page says when it was last
rewritten.
`

const TERMS_VI = `
## Dùng app này

Personal OS là chỗ để bạn theo dõi cuộc sống của chính mình. Bạn được dùng nó
cho việc đó. Đừng dùng để lưu hồ sơ của người khác mà họ không biết, và đừng
dùng cho việc trái pháp luật nơi bạn sống.

## Tài khoản của bạn

Một tài khoản thuộc về một người. Giữ tài khoản Google của bạn cho riêng bạn:
mọi việc làm qua tài khoản đó được xem là bạn làm.

## Dữ liệu là của bạn

Những gì bạn nhập vào vẫn là của bạn. Không bán, không chia cho bên quảng cáo,
không dùng để huấn luyện mô hình của ai cả. Bạn tải hết về hoặc xoá hết đi lúc
nào cũng được, trong Cài đặt.

## App này không hứa gì

App được cung cấp như nó đang có. Không bảo đảm lúc nào cũng truy cập được,
không bảo đảm không bao giờ mất dữ liệu, cũng không bảo đảm sẽ mãi chạy như
hôm nay.

**Hãy tự giữ bản sao.** Nút tải dữ liệu trong Cài đặt sinh ra để làm việc đó.
Thứ gì mất thì tiếc thì nên tồn tại ở đâu đó ngoài một dịch vụ duy nhất.

## App này không phải là gì

Không phải bác sĩ, không phải kế toán, không phải tư vấn tài chính. Phần theo
dõi sức khoẻ là một cuốn sổ, và những con số app tính ra từ đó — điểm số, chuỗi
ngày, tương quan — chỉ là phép tính trên những gì bạn gõ vào, không phải kết
luận về sức khoẻ hay tiền bạc của bạn. Quyết định quan trọng thì hỏi người có
chuyên môn.

## Ngừng dùng

Bạn xoá tài khoản lúc nào cũng được, trong Cài đặt, và nó mất ngay. Tài khoản
cũng có thể bị đóng từ phía này nếu bị dùng để vi phạm các điều khoản trên.

## Thay đổi

Các điều khoản này có thể đổi. Thay đổi đáng kể sẽ được báo trong app trước khi
có hiệu lực, và ngày ở đầu trang cho biết lần viết lại gần nhất.
`

const DOCUMENTS: Record<Locale, Record<LegalDocument, Document>> = {
  en: {
    privacy: { title: 'Privacy', body: PRIVACY_EN.trim() },
    terms: { title: 'Terms', body: TERMS_EN.trim() },
  },
  vi: {
    privacy: { title: 'Quyền riêng tư', body: PRIVACY_VI.trim() },
    terms: { title: 'Điều khoản', body: TERMS_VI.trim() },
  },
}

/**
 * `LEGAL_CONTACT_EMAIL` is the one blank in these documents. Unset, the page
 * says so in place of an address rather than printing `{contactEmail}` at a
 * reader — a privacy notice that cannot be replied to is the one promise here
 * that has to be visibly missing rather than quietly broken.
 */
/**
 * Whether the in-app contact form is offered. Passed in rather than read here,
 * because knowing it means asking a server service, and these documents are
 * plain text that a unit test should be able to render without a database.
 */
export type LegalChannels = { supportForm?: boolean }

export function legalDocument(
  locale: Locale,
  document: LegalDocument,
  channels: LegalChannels = {},
): Document {
  const { title, body } = DOCUMENTS[locale][document]

  return { title, body: body.replace(/\{contact\}/g, contactSentence(locale, channels)) }
}

/**
 * How to reach anyone, written from what is actually configured.
 *
 * A notice that names a channel nobody set up is a promise that breaks the
 * first time somebody tries it — and the person most likely to try is the one
 * who cannot sign in or has already deleted their account. So each route is
 * named only where it exists, and where none does the page says so rather than
 * implying one.
 *
 * `env` collects a bad value rather than throwing, and the fallback it hands
 * back on a parse failure is the raw string — so the address is shape-checked
 * again here. Publishing "hello@" as the only way to reach anyone is worse
 * than admitting there is no way.
 */
function contactSentence(locale: Locale, { supportForm = false }: LegalChannels): string {
  const email = env.LEGAL_CONTACT_EMAIL?.trim()
  const address = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null

  const routes = CONTACT_COPY[locale]
  if (supportForm && address) return routes.both(address)
  if (supportForm) return routes.form
  if (address) return routes.email(address)
  return routes.none
}

const CONTACT_COPY: Record<
  Locale,
  { both: (email: string) => string; form: string; email: (email: string) => string; none: string }
> = {
  en: {
    both: (email) =>
      `use the contact form, which is on the front page and needs no account, or write to **${email}**.`,
    form: 'use the contact form. It is on the front page and needs no account, so it still works after an account is gone.',
    email: (email) => `write to **${email}**.`,
    none: 'there is no channel set up on this deployment yet. Whoever runs it has to add one.',
  },
  vi: {
    both: (email) =>
      `dùng form liên hệ ở trang đầu, không cần tài khoản, hoặc gửi thư tới **${email}**.`,
    form: 'dùng form liên hệ ở trang đầu. Nó không cần tài khoản, nên xoá tài khoản rồi vẫn gửi được.',
    email: (email) => `gửi thư tới **${email}**.`,
    none: 'bản cài này chưa mở kênh nào cả. Người vận hành phải thêm vào.',
  },
}
