---
title: People
description: People, interactions and photos, and the flat payment columns that decide who can be paid by VietQR or MoMo.
sidebar_position: 9
---

# People

The people tables hold the people you keep in touch with, what happened when you did, their photos, and where money sent to them lands. Shared columns are described in [Data model](./overview.md).

## Tables

| Table | Columns worth knowing |
| --- | --- |
| `people` | `name`, `relationship` (`family`, `friend`, `colleague`, `mentor`, `partner`, `other`; default `friend`), `company`, `role`, `birthday`, `phone`, `email`, `socials`, `contact_interval_days` (the desired cadence — anyone past it appears in "reach out"), plus the [payment columns](#payment-columns) below |
| `interactions` | `person_id` (`ON DELETE CASCADE`), `occurred_on`, `channel` (`in_person`, `call`, `message`, `email`, `other`), `summary` |
| `person_photos` | `public_id` (the Cloudinary handle, unique per user), `format`, `width`, `height`, `bytes`, `caption`, `taken_on`. The file lives on Cloudinary; only what is needed to build a URL is stored |

Other tables point at `people`: `transactions.person_id` (a debt) and `transactions.payee_person_id` (who to hand money to), both `SET NULL` — see [Finance](./finance.md) — and `reminders.person_id`, `ON DELETE CASCADE` — see [Work and time](./work-and-time.md).

## Payment columns

Where money sent to a person lands — flat columns on `people` rather than a table, because one account each covers everyone this is for:

| Column | Type | Notes |
| --- | --- | --- |
| `bank_bin` | text | The Napas code the VietQR payload is built from — the six digits a bank app shows beside its name, not the SWIFT code (`0022`) |
| `bank_account_number` | text | `0022` |
| `bank_account_name` | text | Shown before the transfer so a wrong row is caught by eye, not by the bank (`0022`) |
| `momo_phone` | text | `0022` |
| `payment_qr` | text | A QR the person sent, kept as the string it decodes to (`0024`) |

Only someone payable reaches the transfer picker: `bank_bin` **and** `bank_account_number` both set, or `momo_phone`, or `payment_qr`.

## Related

- [Data model](./overview.md) — conventions shared by every table
- [People](../../features/people.md) — reads and writes `people`, `interactions` and `person_photos`
- [Sending money](../../features/finance/sending-money.md) — the payment columns and the transfer picker
- [Accounts and debts](../../features/finance/accounts-and-debts.md) — debts linked to a person
- [Calendar](../../features/calendar.md) — reminders about a person
- [Finance](./finance.md) — `transactions.person_id` and `payee_person_id`
- [Work and time](./work-and-time.md) — `reminders.person_id`
- [Activity trail](./activity-trail.md) — person changes are recorded there
