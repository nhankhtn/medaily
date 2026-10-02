---
title: People
description: A personal CRM — who matters, how often to stay in touch, what you last talked about, reminders, birthdays and how to pay them.
sidebar_position: 13
---

# People

People is a personal CRM. You record who matters, how often you mean to be in touch, and what you last talked about — and the point is being told when it has been too long. It also holds birthdays, reminders, photos, and the payment details Finance uses to send someone money.

| | |
| --- | --- |
| **Where** | `/people` · sidebar → Life · phone → **More** |
| **Works offline** | No |
| **Needs** | Nothing extra. Photos need Cloudinary — see [Configuration](../operations/configuration.md) |

## Rules

- A relationship is one of partner, family, friend, colleague, mentor or other.
- Anyone past their stay-in-touch interval appears under **Time to reach out**, by how many days.
- **Birthdays coming up** covers the next 30 days.
- An interaction is one of in person, call, message, email or other.
- A reminder is a thing to do by a date, optionally about someone. **Done** clears it.
- A reminder that has come due also shows on the Calendar's day.
- One payment detail is enough to be paid: a bank account (bank and account number), a MoMo number or receive link, or a picture of their QR code.
- A QR picture with no code in it is refused.
- Removing someone asks once more, then offers **Undo**.
- People's names are never sent to the AI service.

## Add a person

1. Open **People** and press **New person**.
2. Enter a name and the relationship — partner, family, friend, colleague, mentor or other.
3. Add whatever else helps: company, role, birthday, phone, email.
4. Set how often you mean to stay in touch — **Stay in touch every** so many days.
5. Write notes in Markdown in the [editor](./editor.md).
6. Add payment details if you will send them money (see below).
7. Save.

To change a person's notes later, press the pencil beside them.

## Log an interaction

1. Press **Log interaction**.
2. Enter when you were in touch, how — in person, call, message, email or other — and what it was about.
3. Save. **Recent interactions** lists the latest, and **Time to reach out** shows it as when you last spoke.

## See who to reach out to

- **Time to reach out** lists everyone past their interval, by how many days, with when you last spoke.
- **Birthdays coming up** covers the next 30 days.

## Set a reminder

1. Press **New reminder** and enter what to do and by when, optionally about someone.
2. When it comes due it also shows on the [Calendar](./calendar.md)'s day.
3. Press **Done** to clear it.

## Add payment details

1. Edit the person.
2. Fill one of:
   - a bank and account number with the holder's name,
   - a MoMo number or receive link,
   - a picture of the QR code they gave you.
3. Save. They can now be picked under **Send money** in [Finance](./finance/sending-money.md).

## Add photos

With Cloudinary configured, each person has a gallery.

1. Open the person's gallery and upload straight from the browser. Each photo must be under 15 MB.
2. Click a thumbnail for the full-size image.

## Remove a person

1. Choose to remove them.
2. Confirm once more — **Remove for good?**
3. The toast offers **Undo** if it was a mistake.

## How it works

**Being told, not remembering.** The stay-in-touch interval is the desired cadence; anyone past it appears under **Time to reach out**, with when you last spoke, so the list does the remembering.

**Payment details and Send money.** Payment details are what **Send money** in Finance uses. A bank account is enough for a QR made for each transfer; a MoMo number opens MoMo; a picture of their own code still works. The picture is read when you choose it: if it holds a bank account the app knows, the account number is taken from it and every transfer to them gets its amount filled in; otherwise it still scans, and the amount is typed by hand. A picture with no code in it is refused. The holder's name is shown before a transfer so a wrong row is caught by eye, not by the bank.

**Debts follow people too.** A transaction in Finance can name someone from your contacts, and that is what makes it a debt; the balance per person is shown on Finance's Accounts tab.

**Photos.** The grid pulls small, cheap images and the full view pulls a good one, from one stored original on Cloudinary. Without Cloudinary the galleries are hidden.

**What changed.** Adding, changing and deleting people is recorded in the activity trail under **Settings → What changed**.

## Limits

- Without Cloudinary there are no photo galleries.

## Related

- [Finance: sending money](./finance/sending-money.md) — uses a person's payment details for the QR, MoMo and bank-app transfer
- [Finance: accounts and debts](./finance/accounts-and-debts.md) — a transaction naming a person is a debt, summed per person
- [Calendar](./calendar.md) — reminders that have come due show on the day view
- [Editor](./editor.md) — the editor a person's notes are written in
- [Navigation](../get-started/navigation.md) — search finds people
- [Assistant](./assistant.md) — other people's names are not sent to the AI service
- [Settings](./settings.md) — **What changed** records changes to people; **Delete this account** removes people and their photos
- [Configuration](../operations/configuration.md) — `CLOUDINARY_*` for galleries
- [Data model: people](../reference/data-model/people.md) — `people`, its payment columns, `interactions`, `person_photos`
- [Data model: work and time](../reference/data-model/work-and-time.md) — `reminders`
