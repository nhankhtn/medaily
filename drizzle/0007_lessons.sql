ALTER TYPE "public"."note_type" ADD VALUE 'lesson';--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "learned_on" date;--> statement-breakpoint
CREATE INDEX "idx_notes_learned_on" ON "notes" USING btree ("user_id","learned_on" DESC NULLS LAST);