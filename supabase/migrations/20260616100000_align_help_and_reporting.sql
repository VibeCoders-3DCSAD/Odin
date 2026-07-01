-- ============================================================================
-- Align Help & Problem Reporting with Specification.md Article XXXVII §4
-- ============================================================================
--
-- The modified spec mandates email dispatch only and explicitly forbids
-- a full ticketing system. This migration:
--   1. Drops the old support_tickets infrastructure (tables, bucket, policies)
--   2. Replaces it with a minimal problem_reports submission log
--
-- See Specification.md Article XXXVII Section 4.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Tear down the old ticketing-style support_ticket system
-- --------------------------------------------------------------------------

DROP TABLE IF EXISTS support_ticket_attachments CASCADE;

DROP TABLE IF EXISTS support_ticket_events CASCADE;

DROP TABLE IF EXISTS support_tickets CASCADE;

-- --------------------------------------------------------------------------
-- 2. Problem Reports — email dispatch only, no ticketing system
-- --------------------------------------------------------------------------
--
-- This table is a submission log that supports retry on failure and
-- user-facing history. It is intentionally NOT a ticketing system:
-- no status workflow, no agent assignment, no escalation, no admin
-- dashboard. The development team manages incoming reports via their
-- email inbox per Specification.md Article XXXVII §4 §3.3.

CREATE TABLE problem_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subject text NOT NULL,
  message_body text NOT NULL,
  sent_at timestamptz,
  failed_at timestamptz,
  failure_error text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT problem_reports_retry_count_chk
    CHECK (retry_count >= 0),
  CONSTRAINT problem_reports_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX problem_reports_user_created_idx
  ON problem_reports (user_id, created_at DESC);

-- --------------------------------------------------------------------------
-- 3. Row-Level Security
-- --------------------------------------------------------------------------

ALTER TABLE problem_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY problem_reports_owner_access
  ON problem_reports
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
