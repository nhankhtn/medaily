---
title: Sending money
description: Pay a contact from the add form — record the expense and get a QR code, their account number, MoMo or your bank app in one step.
sidebar_position: 5
---

# Sending money

Paying someone usually means recording the expense in one place and typing
their account number into your bank app in another. **Send money** does both
from the finance add form: it saves the expense against the person and opens a
sheet with everything your bank needs, including a QR code to scan.

| | |
| --- | --- |
| **Where** | `/finance` → **Overview** → add form → **Send money** |
| **Works offline** | No |
| **Needs** | A contact under [People](../people.md) with payment details: a bank account, a MoMo number, or a picture of their QR code |

## Rules

- Only someone under People with payment details — a bank account, a MoMo number, or a picture of their QR code — can be paid.
- Pressing **Send money** saves the expense against that person straight away. Being the payee does not make it a debt; only the **Debt** field does.
- The app cannot see whether the money moved, so you confirm it with **Sent**.
- **Later** leaves the payment unconfirmed, and the row keeps a send button lit in the ledger until you confirm.
- Where their bank account is known, the QR code is made for this transfer, with the amount and reference filled in.
- Where only their own QR picture is known, the amount is typed when you scan.
- **Copy account number** and **Open MoMo** work on any device.
- **Open** *your bank's app* appears only on a phone, only for banks that registered a link, and only once both the paying and the receiving account are known.

## Add payment details to a contact

1. Open the person under **People**.
2. Add their bank and account number with the holder's name, a MoMo number or receive link, or a picture of the QR code they gave you. One is enough.
3. Save. They can now be picked under **Send money**.

See [People](../people.md) for the contact page itself.

## Pay someone

1. Open **Finance**. On the **Overview** tab, type the amount in the add form.
2. Pick the account you are paying from.
3. Press **Send money** and pick who. If nobody has payment details yet, the picker says to add an account number on a contact under People.
4. The expense is saved against them, and a sheet opens with the amount, their name, bank and account holder, the reference, and a QR code.
5. Pay, using whichever fits:
   - scan the QR code with your bank app;
   - press **Copy account number** and paste it into your bank app;
   - press **Open MoMo** — the number is copied, so paste it in MoMo;
   - on a phone, press **Open** *your bank's app*.
6. Come back and press **Sent** to mark the transfer as done, or **Later** to close the sheet.

## Confirm a payment later

1. On the **Overview** tab, find the row with its send button lit — or filter the ledger with **Still to transfer**.
2. Press the send button to reopen the sheet.
3. Press **Sent** once the money has gone.

## How it works

**The QR code.** A QR picture saved on a contact is read when it is chosen: if
it holds a bank account the app knows, the account number is taken from it, so
it counts as a known bank account. Where their bank account is known, the QR is made for this
transfer (VietQR), so scanning it fills in the account, the amount and the
reference. Otherwise it is their own code, and the amount is typed when you
scan.

**Opening your bank's app.** The **Open** button appears only on a phone, only
for the banks that registered a link, and only once the account you are paying
from and the one you are paying to are both known — your bank is the app that
opens, theirs is where the money lands. Some bank apps open with the transfer
filled in; the rest open on their home screen, and the sheet says so: the
account and amount still get typed in, and scanning the code is quicker.

**Why it asks.** The app cannot see whether the money moved, so it asks.
**Sent** marks the transfer as done. **Later** closes the sheet, and the row
keeps a send button lit in the ledger until you come back and confirm. The
expense itself is already recorded either way.

## Limits

- No connection to any bank: the app never sees the transfer, and never sends money itself.
- Pre-filled transfers depend on the bank app; some open only on their home screen.

## Related

- [People](../people.md) — where a contact's bank account, MoMo number or QR picture is kept
- [Transactions](./transactions.md) — the expense this records, and the **Still to transfer** filter
- [Accounts and debts](./accounts-and-debts.md) — the account you pay from; the payee is kept apart from the **Debt** field, so a payment is a debt only if that field names someone too
- [Budgets](./budgets.md) — the expense counts against its category's budget
- [Finance overview](./overview.md) — the add form and the ledger
- [Data model: finance](../../reference/data-model/finance.md) — tables behind this page
