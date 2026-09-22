-- Drops the table the Safari sign-in handoff used.
--
-- The migration that created it is not in this repo: the feature was reverted
-- whole, and production had never applied it. So `IF EXISTS` is load-bearing
-- rather than defensive — on a fresh database this is a no-op, and on the one
-- that ran the create before the revert it is the cleanup.
DROP TABLE IF EXISTS "auth_handoffs";
