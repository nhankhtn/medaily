ALTER TABLE "transactions" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transactions_person" ON "transactions" USING btree ("person_id","occurred_on" DESC NULLS LAST);