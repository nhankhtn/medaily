CREATE TABLE IF NOT EXISTS "timer_filings" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_timer_filings_user" ON "timer_filings" ("user_id");
