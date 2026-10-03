-- Accounts that existed before a username was chosen get one from the mailbox
-- name. Dots and plus-tags are dropped, the same way the app does it. When two
-- addresses clean down to the same handle, the older account keeps it and the
-- next ones take a short numeric suffix.
DO $$
DECLARE
  rec record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR rec IN
    SELECT id, email
    FROM users
    WHERE username IS NULL
      AND email IS NOT NULL
    ORDER BY created_at, id
  LOOP
    base := left(regexp_replace(lower(split_part(rec.email, '@', 1)), '[^a-z0-9_]', '', 'g'), 20);
    IF base !~ '^[a-z][a-z0-9_]{2,19}$' THEN
      CONTINUE;
    END IF;

    candidate := base;
    n := 2;
    WHILE EXISTS (SELECT 1 FROM users WHERE lower(username) = candidate) LOOP
      IF n > 20 THEN
        candidate := NULL;
        EXIT;
      END IF;
      candidate := left(base, 20 - length(n::text)) || n::text;
      IF candidate !~ '^[a-z][a-z0-9_]{2,19}$' THEN
        candidate := NULL;
        EXIT;
      END IF;
      n := n + 1;
    END LOOP;

    IF candidate IS NOT NULL THEN
      UPDATE users SET username = candidate, updated_at = now() WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
