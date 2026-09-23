-- The note is folded into the merchant before the column goes, so a row that
-- said "bánh mì" / "sáng ăn" keeps both halves as "bánh mì — sáng ăn" instead
-- of losing the half that says what the money was for. Capped at the 200 the
-- merchant input accepts.
UPDATE "transactions"
SET "merchant" = left(
      concat_ws(
        ' — ',
        nullif(btrim(coalesce("merchant", '')), ''),
        nullif(btrim(coalesce("note", '')), '')
      ),
      200
    )
WHERE "note" IS NOT NULL AND btrim("note") <> '';
--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "note";
