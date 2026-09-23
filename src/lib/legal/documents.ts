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
export const LEGAL_UPDATED_ON = '2026-09-24'

type Document = { title: string; body: string }

const PRIVACY_EN = `
## What this is

Personal OS keeps a journal, a health log, a ledger and a contact book for one
person: you. Everything below is about the account you sign in to, and nothing
in it is shown to other people who use the app.

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

**Nothing else.** There is no analytics, no advertising, no tracking pixel and
no third-party script watching what you do.

## Where it is kept

- The database is hosted by **Neon**, in the United States.
- The app runs on **Vercel**.
- Pictures are stored by **Cloudinary**.
- Sign-in is handled by **Google Firebase**, which verifies who you are. Your
  password, if you have one with Google, is never seen by this app.

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

## What you can do

- **Take it with you.** Settings → Data exports everything as JSON or CSV, at
  any time, without asking anyone.
- **Delete it.** Settings → Delete this account removes the account and every
  record under it, including the pictures held by Cloudinary. It is immediate
  and it cannot be undone.
- **Correct it.** Every record in the app can be edited in the app.

## Getting in touch

Questions about any of this, or a request you cannot carry out from inside the
app, go to **{contactEmail}**.
`

const PRIVACY_VI = `
## Đây là gì

Personal OS giữ nhật ký, theo dõi sức khoẻ, sổ chi tiêu và danh bạ cho một
người: bạn. Mọi thứ dưới đây nói về tài khoản bạn đăng nhập, và không có gì
trong đó hiện ra cho người khác đang dùng app.

## Những gì được thu thập

**Từ tài khoản Google khi bạn đăng nhập:** địa chỉ email, tên hiển thị và ảnh
đại diện. Không gì khác — không danh bạ, không lịch, không tệp.

**Những gì bạn tự nhập:** nhật ký ngày, ghi chép, thói quen, mục tiêu, dự án,
chỉ số sức khoẻ, ghi chú học tập, hồ sơ nghề nghiệp, cùng sổ tài khoản, giao
dịch và ngân sách. Nếu bạn dùng danh bạ thì gồm cả những gì bạn ghi về người
trong đó, có thể có số điện thoại, email, ngày sinh và số tài khoản ngân hàng.

**Ảnh bạn tải lên**, nếu có.

**Không gì khác nữa.** Không có đo đạc hành vi, không quảng cáo, không pixel
theo dõi, không script của bên thứ ba nào quan sát bạn.

## Dữ liệu nằm ở đâu

- Cơ sở dữ liệu đặt tại **Neon**, ở Mỹ.
- App chạy trên **Vercel**.
- Ảnh lưu ở **Cloudinary**.
- Đăng nhập do **Google Firebase** xử lý để xác minh bạn là ai. Mật khẩu
  Google của bạn không bao giờ đi qua app này.

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

## Bạn làm được gì

- **Mang dữ liệu đi.** Cài đặt → Dữ liệu cho tải toàn bộ dưới dạng JSON hoặc
  CSV, bất cứ lúc nào, không phải xin ai.
- **Xoá đi.** Cài đặt → Xoá tài khoản này xoá tài khoản và mọi bản ghi thuộc
  về nó, gồm cả ảnh đang giữ ở Cloudinary. Có hiệu lực ngay và không hoàn tác
  được.
- **Sửa lại.** Mọi bản ghi trong app đều sửa được ngay trong app.

## Liên hệ

Thắc mắc về bất cứ điều gì ở trên, hoặc yêu cầu mà bạn không tự làm được trong
app, xin gửi tới **{contactEmail}**.
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
export function legalDocument(locale: Locale, document: LegalDocument): Document {
  const { title, body } = DOCUMENTS[locale][document]
  const contact = process.env.LEGAL_CONTACT_EMAIL?.trim()

  return {
    title,
    body: body.replace(
      /\{contactEmail\}/g,
      contact && contact.length > 0 ? contact : MISSING_CONTACT[locale],
    ),
  }
}

const MISSING_CONTACT: Record<Locale, string> = {
  en: 'an address that has not been set yet',
  vi: 'một địa chỉ chưa được điền',
}
