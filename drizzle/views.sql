-- Idempotent SQL applied after every migration by scripts/migrate.ts.
-- Spec 27.3: the single read path for analytics, scoring, streaks and reviews.

-- A day exists here if anything happened on it: a log was written, or a focus
-- session was recorded. Anchoring on daily_logs alone made a timed session
-- invisible to the dashboard, the score and every streak until the day also
-- had something typed into it.
DROP VIEW IF EXISTS v_daily_effective;
CREATE VIEW v_daily_effective AS
WITH fs AS (
  SELECT
    user_id,
    session_date,
    SUM(minutes) FILTER (WHERE kind = 'learning')                  AS learning_minutes,
    SUM(minutes) FILTER (WHERE kind IN ('deep_work', 'project'))   AS execution_minutes,
    COUNT(*)                                                       AS session_count,
    COUNT(*) FILTER (WHERE kind = 'learning')                      AS learning_session_count,
    COUNT(*) FILTER (WHERE kind IN ('deep_work', 'project'))       AS execution_session_count
  FROM focus_sessions
  GROUP BY user_id, session_date
),
days AS (
  SELECT user_id, log_date FROM daily_logs
  UNION
  SELECT user_id, session_date FROM fs
)
SELECT
  k.user_id,
  k.log_date,
  d.id,
  d.energy,
  d.mood,
  d.sleep_hours,
  d.bedtime,
  d.wake_time,
  d.technical_study_minutes,
  d.deep_work_minutes,
  d.exercise_minutes,
  d.exercise_type,
  d.reading_minutes,
  d.reading_pages,
  d.entertainment_minutes,
  d.english_minutes,
  d.daily_win,
  d.daily_problem,
  d.tomorrow_priority,
  d.note,
  d.source,
  d.created_at,
  d.updated_at,
  COALESCE(fs.learning_minutes,  d.technical_study_minutes) AS effective_study_minutes,
  COALESCE(fs.execution_minutes, d.deep_work_minutes)       AS effective_deep_work_minutes,
  COALESCE(fs.session_count, 0)                             AS session_count,
  COALESCE(fs.learning_session_count, 0)                    AS learning_session_count,
  COALESCE(fs.execution_session_count, 0)                   AS execution_session_count
FROM days k
LEFT JOIN daily_logs d ON d.user_id = k.user_id AND d.log_date = k.log_date
LEFT JOIN fs          ON fs.user_id = k.user_id AND fs.session_date = k.log_date;

-- updated_at maintenance (spec 27 conventions)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- Spec 29: the single owner row exists after every migration, with a fixed id,
-- so `getCurrentUserId()` needs no runtime bootstrap and adding real auth later
-- requires no data migration.
INSERT INTO users (id, display_name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Me')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_settings (user_id)
VALUES ('00000000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

-- Full-text search (spec 22.4). Vietnamese needs diacritic folding, so the
-- vector is built from an IMMUTABLE unaccent wrapper and maintained by a
-- trigger — a generated column would need the function to exist before the
-- migration that creates the table.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE OR REPLACE FUNCTION notes_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', f_unaccent(coalesce(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce(NEW.body_md, ''))), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION journal_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', f_unaccent(coalesce(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce(NEW.body_md, ''))), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notes_search ON notes;
CREATE TRIGGER trg_notes_search BEFORE INSERT OR UPDATE OF title, body_md ON notes
FOR EACH ROW EXECUTE FUNCTION notes_search_tsv();

DROP TRIGGER IF EXISTS trg_journal_search ON journal_entries;
CREATE TRIGGER trg_journal_search BEFORE INSERT OR UPDATE OF title, body_md ON journal_entries
FOR EACH ROW EXECUTE FUNCTION journal_search_tsv();

-- Backfill anything written before the triggers existed.
UPDATE notes SET title = title WHERE search_tsv IS NULL;
UPDATE journal_entries SET body_md = body_md WHERE search_tsv IS NULL;

-- Account balances: opening balance plus everything that moved through it,
-- including the receiving side of transfers (spec 12).
CREATE OR REPLACE VIEW v_account_balances AS
SELECT
  a.id                AS account_id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.opening_balance
    + COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'income'   AND t.account_id = a.id), 0)
    - COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'expense'  AND t.account_id = a.id), 0)
    - COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'transfer' AND t.account_id = a.id), 0)
    + COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'transfer' AND t.counter_account_id = a.id), 0)
                      AS balance
FROM accounts a
LEFT JOIN transactions t
  ON t.user_id = a.user_id AND (t.account_id = a.id OR t.counter_account_id = a.id)
GROUP BY a.id, a.user_id, a.name, a.type, a.currency, a.opening_balance;
