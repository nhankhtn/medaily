-- Quick transfer: who a transaction's money is handed to, and whether that
-- hand-off has happened.
--
-- Hand-trimmed. `drizzle-kit generate` also emitted timer_filings,
-- finance_categories.note and the user_settings.theme default, because the
-- meta snapshot had fallen behind the hand-written 0018-0020 that already
-- applied all three. Re-applying them would fail against a database that has
-- them. The snapshot this run wrote is the whole schema, so the next generate
-- starts clean.
ALTER TABLE "transactions" ADD COLUMN "payee_person_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transferred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "bank_bin" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "momo_phone" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payee_person_id_people_id_fk" FOREIGN KEY ("payee_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
