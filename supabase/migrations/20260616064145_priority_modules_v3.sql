CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE odin_forecast_model_kind AS ENUM (
  'lstm',
  'population_fallback',
  'blended'
);

CREATE TYPE odin_forecast_status AS ENUM (
  'queued',
  'running',
  'available',
  'failed',
  'expired'
);

CREATE TYPE odin_forecast_granularity AS ENUM (
  'daily',
  'weekly',
  'monthly',
  'custom_period'
);

CREATE TYPE odin_forecast_target AS ENUM (
  'total_spending',
  'category_spending',
  'subcategory_spending',
  'income',
  'savings_balance',
  'debt_balance'
);

CREATE TYPE odin_budget_strategy AS ENUM (
  'fifty_thirty_twenty',
  'zero_based',
  'savings_first',
  'custom'
);

CREATE TYPE odin_recommendation_status AS ENUM (
  'draft',
  'presented',
  'modified',
  'accepted',
  'rejected',
  'expired',
  'superseded'
);

CREATE TYPE odin_recommendation_action AS ENUM (
  'presented',
  'modified',
  'accepted',
  'rejected',
  'expired',
  'superseded'
);

CREATE TYPE odin_budget_constraint_type AS ENUM (
  'total_budget',
  'obligatory_minimum',
  'financial_allocation_minimum',
  'essentials_floor',
  'discretionary_cap',
  'subcategory_maximum',
  'savings_first_minimum',
  'protected_subcategory_floor',
  'non_negativity',
  'custom'
);

CREATE TYPE odin_allocation_scope AS ENUM (
  'category',
  'subcategory'
);

CREATE TYPE odin_alert_category AS ENUM (
  'budget_overspending',
  'anomaly_detection',
  'forecast_advisory',
  'savings_milestone',
  'debt_management'
);

CREATE TYPE odin_alert_source_type AS ENUM (
  'isolation_forest',
  'budget_overspending_rule',
  'forecast_advisory_rule',
  'savings_goal_rule',
  'debt_rule',
  'system'
);

CREATE TYPE odin_alert_severity AS ENUM (
  'informational',
  'warning',
  'critical'
);

CREATE TYPE odin_alert_status AS ENUM (
  'unread',
  'read',
  'acknowledged',
  'dismissed',
  'cleared',
  'expired'
);

CREATE TYPE odin_alert_event_action AS ENUM (
  'created',
  'delivered_in_app',
  'delivered_push',
  'opened',
  'acknowledged',
  'dismissed',
  'marked_expected',
  'marked_unexpected',
  'remind_later',
  'whitelist_created',
  'snoozed',
  'cleared',
  'bundled'
);

CREATE TYPE odin_anomaly_review_status AS ENUM (
  'not_alerted',
  'pending_review',
  'expected',
  'unexpected',
  'remind_later',
  'suppressed'
);

CREATE TYPE odin_anomaly_suppression_reason AS ENUM (
  'cultural_occasion',
  'recurring_payment',
  'whitelist',
  'cooldown',
  'bundle',
  'user_snooze',
  'notification_preference',
  'insufficient_history',
  'model_failure'
);

CREATE TYPE odin_anomaly_feature_key AS ENUM (
  'amount_deviation',
  'day_of_period_proportion',
  'subcategory_velocity',
  'time_since_last_same_subcategory',
  'day_of_week',
  'week_of_month',
  'holiday_proximity',
  'merchant_novelty'
);

CREATE TYPE odin_alert_preference_mode AS ENUM (
  'enabled',
  'disabled',
  'informational_only'
);

CREATE TYPE odin_suppression_rule_status AS ENUM (
  'active',
  'disabled',
  'deleted'
);

CREATE TYPE odin_user_lifecycle_status AS ENUM (
  'active',
  'pending_deletion',
  'deleted'
);

CREATE TYPE odin_metro_manila_presence AS ENUM (
  'lives_in_metro_manila',
  'works_in_metro_manila',
  'lives_and_works_in_metro_manila'
);

CREATE TYPE odin_employment_classification AS ENUM (
  'full_time_employee',
  'part_time_employee',
  'self_employed',
  'freelancer',
  'business_owner',
  'entrepreneur',
  'contractual_project_based',
  'gig_worker',
  'other'
);

CREATE TYPE odin_consent_kind AS ENUM (
  'data_collection',
  'personalization',
  'model_training',
  'research_evaluation',
  'notifications',
  'terms',
  'advisory_disclaimer'
);

CREATE TYPE odin_consent_status AS ENUM (
  'granted',
  'withdrawn'
);

CREATE TYPE odin_onboarding_status AS ENUM (
  'not_started',
  'in_progress',
  'submitted',
  'abandoned',
  'superseded'
);

CREATE TYPE odin_income_type AS ENUM (
  'stable',
  'variable'
);

CREATE TYPE odin_income_frequency AS ENUM (
  'weekly',
  'biweekly',
  'semi_monthly',
  'monthly',
  'irregular',
  'custom'
);

CREATE TYPE odin_financial_profile_label AS ENUM (
  'stable_flexible',
  'stable_obligated',
  'variable_flexible',
  'variable_obligated'
);

CREATE TYPE odin_profile_assessment_status AS ENUM (
  'queued',
  'running',
  'suggested',
  'confirmed',
  'rejected',
  'failed',
  'expired'
);

CREATE TYPE odin_profile_event_action AS ENUM (
  'assessment_requested',
  'assessment_generated',
  'change_suggested',
  'confirmed',
  'rejected',
  'manual_override',
  'activated',
  'deactivated'
);

CREATE TYPE odin_profile_assessment_method AS ENUM (
  'manual',
  'questionnaire',
  'cold_start',
  'standard'
);

CREATE TYPE odin_profile_reclassification_status AS ENUM (
  'scheduled',
  'due',
  'running',
  'completed',
  'failed',
  'paused'
);

CREATE TYPE odin_subcategory_kind AS ENUM (
  'income',
  'expense',
  'transfer_adjustment'
);

CREATE TYPE odin_restriction_level AS ENUM (
  'free',
  'protected',
  'locked'
);

CREATE TYPE odin_account_kind AS ENUM (
  'cash',
  'bank',
  'e_wallet',
  'savings',
  'credit_card',
  'loan',
  'other'
);

CREATE TYPE odin_account_status AS ENUM (
  'active',
  'archived',
  'deleted'
);

CREATE TYPE odin_transaction_type AS ENUM (
  'income',
  'expense',
  'transfer'
);

CREATE TYPE odin_transaction_status AS ENUM (
  'draft',
  'posted',
  'voided',
  'deleted'
);

CREATE TYPE odin_transaction_entry_source AS ENUM (
  'manual',
  'recurring',
  'offline_sync',
  'system_adjustment'
);

CREATE TYPE odin_transaction_event_action AS ENUM (
  'created',
  'edited',
  'posted',
  'voided',
  'deleted',
  'restored'
);

CREATE TYPE odin_transaction_draft_status AS ENUM (
  'pending',
  'synced',
  'discarded',
  'failed'
);

CREATE TYPE odin_transaction_template_status AS ENUM (
  'active',
  'archived',
  'deleted'
);

CREATE TYPE odin_recurring_frequency AS ENUM (
  'weekly',
  'biweekly',
  'semi_monthly',
  'monthly',
  'quarterly',
  'yearly',
  'custom'
);

CREATE TYPE odin_recurring_template_status AS ENUM (
  'active',
  'paused',
  'stopped',
  'deleted'
);

CREATE TYPE odin_recurring_occurrence_status AS ENUM (
  'scheduled',
  'posted',
  'skipped',
  'failed',
  'cancelled'
);

CREATE TYPE odin_budget_status AS ENUM (
  'draft',
  'active',
  'closed',
  'archived',
  'deleted'
);

CREATE TYPE odin_budget_period_kind AS ENUM (
  'weekly',
  'biweekly',
  'semi_monthly',
  'monthly',
  'custom'
);

CREATE TYPE odin_budget_source AS ENUM (
  'manual',
  'recommendation',
  'recurring_template',
  'system'
);

CREATE TYPE odin_surplus_handling AS ENUM (
  'carry_forward',
  'reallocate_to_goals',
  'reallocate_to_subcategories',
  'save_to_priority_goal',
  'no_action'
);

CREATE TYPE odin_deficit_handling AS ENUM (
  'warn_only',
  'reduce_discretionary',
  'rebalance_unprotected',
  'allow_deficit'
);

CREATE TYPE odin_budget_event_action AS ENUM (
  'created',
  'updated',
  'activated',
  'closed',
  'archived',
  'allocation_changed',
  'surplus_handling_changed',
  'deficit_warning_generated'
);

CREATE TYPE odin_obligation_status AS ENUM (
  'active',
  'paused',
  'ended',
  'deleted'
);

CREATE TYPE odin_expected_event_kind AS ENUM (
  'christmas',
  'enrollment',
  'family_support',
  'paluwagan',
  'community_contribution',
  'religious_donation',
  'government_contribution',
  'holiday',
  'payday',
  'custom'
);

CREATE TYPE odin_expected_event_status AS ENUM (
  'active',
  'inactive',
  'deleted'
);

CREATE TYPE odin_savings_goal_status AS ENUM (
  'active',
  'achieved',
  'archived',
  'deleted'
);

CREATE TYPE odin_goal_progress_state AS ENUM (
  'on_track',
  'behind',
  'achieved',
  'projection_unavailable'
);

CREATE TYPE odin_savings_allocation_strategy AS ENUM (
  'avalanche',
  'snowball'
);

CREATE TYPE odin_contribution_source AS ENUM (
  'manual',
  'transaction',
  'system_adjustment'
);

CREATE TYPE odin_debt_account_status AS ENUM (
  'active',
  'paid_off',
  'archived',
  'deleted'
);

CREATE TYPE odin_debt_strategy AS ENUM (
  'avalanche',
  'snowball',
  'custom'
);

CREATE TYPE odin_debt_payment_source AS ENUM (
  'manual',
  'transaction',
  'system_adjustment'
);

CREATE TYPE odin_debt_hardship_status AS ENUM (
  'draft',
  'active',
  'resolved',
  'cancelled',
  'archived'
);

CREATE TYPE odin_debt_hardship_action AS ENUM (
  'created',
  'activated',
  'payment_reduced',
  'payment_deferred',
  'lender_contacted',
  'resolved',
  'cancelled',
  'archived'
);

CREATE TYPE odin_report_kind AS ENUM (
  'weekly',
  'monthly',
  'custom'
);

CREATE TYPE odin_report_status AS ENUM (
  'queued',
  'running',
  'available',
  'failed',
  'expired'
);

CREATE TYPE odin_request_status AS ENUM (
  'requested',
  'processing',
  'available',
  'completed',
  'failed',
  'expired',
  'cancelled'
);

CREATE TYPE odin_support_ticket_status AS ENUM (
  'open',
  'in_review',
  'waiting_for_user',
  'resolved',
  'closed'
);

CREATE TYPE odin_support_ticket_category AS ENUM (
  'bug',
  'account',
  'transaction',
  'budget',
  'forecast',
  'anomaly',
  'privacy',
  'general'
);

CREATE TYPE odin_support_ticket_event_action AS ENUM (
  'created',
  'commented',
  'status_changed',
  'attachment_added',
  'closed',
  'reopened'
);

CREATE TYPE odin_push_device_platform AS ENUM (
  'android',
  'ios',
  'web'
);

CREATE TYPE odin_budget_health_status AS ENUM (
  'healthy',
  'watch',
  'critical'
);

CREATE TYPE odin_transaction_retention_action AS ENUM (
  'scheduled',
  'retained',
  'archived',
  'purged',
  'cancelled'
);

-- App-owned user profile. Authentication remains in Supabase Auth.
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  metro_manila_city text,
  lifecycle_status odin_user_lifecycle_status NOT NULL DEFAULT 'active',
  onboarding_completed_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT profiles_deleted_status_chk
    CHECK (lifecycle_status <> 'deleted' OR deleted_at IS NOT NULL)
);

CREATE INDEX profiles_lifecycle_status_idx
  ON profiles (lifecycle_status);

CREATE TABLE user_privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  personalization_enabled boolean NOT NULL DEFAULT true,
  model_training_opt_in boolean NOT NULL DEFAULT false,
  research_evaluation_opt_in boolean NOT NULL DEFAULT false,
  notifications_opt_in boolean NOT NULL DEFAULT false,
  data_retention_days integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_privacy_settings_retention_chk
    CHECK (data_retention_days IS NULL OR data_retention_days > 0)
);

CREATE TABLE user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  consent_kind odin_consent_kind NOT NULL,
  status odin_consent_status NOT NULL,
  version text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  effective_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  source text,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_consents_withdrawn_at_chk
    CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL)
);

CREATE INDEX user_consents_user_kind_idx
  ON user_consents (user_id, consent_kind, recorded_at DESC);

CREATE TABLE data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status odin_request_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  expires_at timestamptz,
  export_storage_path text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT data_export_requests_expiry_chk
    CHECK (expires_at IS NULL OR requested_at < expires_at)
);

CREATE INDEX data_export_requests_user_status_idx
  ON data_export_requests (user_id, status, requested_at DESC);

CREATE TABLE account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status odin_request_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  scheduled_delete_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT account_deletion_requests_schedule_chk
    CHECK (
      scheduled_delete_at IS NULL
      OR requested_at <= scheduled_delete_at
    )
);

CREATE INDEX account_deletion_requests_user_status_idx
  ON account_deletion_requests (user_id, status, requested_at DESC);

CREATE TABLE metro_manila_localities (
  code text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_city boolean NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO metro_manila_localities (code, name, is_city, sort_order) VALUES
  ('manila', 'Manila', true, 10),
  ('quezon_city', 'Quezon City', true, 20),
  ('caloocan', 'Caloocan', true, 30),
  ('las_pinas', 'Las Pinas', true, 40),
  ('makati', 'Makati', true, 50),
  ('malabon', 'Malabon', true, 60),
  ('mandaluyong', 'Mandaluyong', true, 70),
  ('marikina', 'Marikina', true, 80),
  ('muntinlupa', 'Muntinlupa', true, 90),
  ('navotas', 'Navotas', true, 100),
  ('paranaque', 'Paranaque', true, 110),
  ('pasay', 'Pasay', true, 120),
  ('pasig', 'Pasig', true, 130),
  ('pateros', 'Pateros', false, 140),
  ('san_juan', 'San Juan', true, 150),
  ('taguig', 'Taguig', true, 160),
  ('valenzuela', 'Valenzuela', true, 170)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE user_eligibility_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  date_of_birth date,
  is_filipino boolean,
  metro_manila_presence odin_metro_manila_presence,
  metro_manila_locality_code text REFERENCES metro_manila_localities(code) ON DELETE RESTRICT,
  primary_employment_classification odin_employment_classification,
  primary_employment_other text,
  eligibility_confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_eligibility_profiles_birth_date_chk
    CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE),
  CONSTRAINT user_eligibility_profiles_age_range_chk
    CHECK (
      date_of_birth IS NULL
      OR (
        date_of_birth <= (CURRENT_DATE - INTERVAL '20 years')::date
        AND date_of_birth >= (CURRENT_DATE - INTERVAL '40 years')::date
      )
    ),
  CONSTRAINT user_eligibility_profiles_other_employment_chk
    CHECK (
      primary_employment_classification <> 'other'
      OR primary_employment_other IS NOT NULL
    ),
  CONSTRAINT user_eligibility_profiles_confirmed_eligibility_chk
    CHECK (
      eligibility_confirmed_at IS NULL
      OR (
        date_of_birth IS NOT NULL
        AND is_filipino = true
        AND metro_manila_presence IS NOT NULL
        AND metro_manila_locality_code IS NOT NULL
        AND primary_employment_classification IS NOT NULL
      )
    )
);

CREATE TABLE onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status odin_onboarding_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  abandoned_at timestamptz,
  superseded_at timestamptz,
  current_step_key text,

  raw_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT onboarding_sessions_submit_chk
    CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),
  CONSTRAINT onboarding_sessions_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX onboarding_sessions_user_status_idx
  ON onboarding_sessions (user_id, status, started_at DESC);


CREATE TABLE onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_session_id uuid NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  answer jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (onboarding_session_id, question_key)
);

CREATE TABLE financial_profile_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  onboarding_session_id uuid REFERENCES onboarding_sessions(id) ON DELETE SET NULL,
  status odin_profile_assessment_status NOT NULL DEFAULT 'queued',
  assessment_method odin_profile_assessment_method NOT NULL DEFAULT 'questionnaire',
  requested_at timestamptz NOT NULL DEFAULT now(),
  assessed_at timestamptz,
  model_kind text NOT NULL DEFAULT 'random_forest',
  model_version text,
  proposed_profile_label odin_financial_profile_label,
  confidence_score numeric(5, 4),
  income_type odin_income_type,
  obligation_load_bps integer,
  explanation_summary text,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT financial_profile_assessments_confidence_chk
    CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  CONSTRAINT financial_profile_assessments_obligation_load_chk
    CHECK (obligation_load_bps IS NULL OR obligation_load_bps BETWEEN 0 AND 10000),
  CONSTRAINT financial_profile_assessments_status_label_chk
    CHECK (
      status IN ('queued', 'running', 'failed')
      OR proposed_profile_label IS NOT NULL
    ),
  CONSTRAINT financial_profile_assessments_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX financial_profile_assessments_user_idx
  ON financial_profile_assessments (user_id, requested_at DESC);


CREATE TABLE financial_profile_explanation_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES financial_profile_assessments(id) ON DELETE CASCADE,
  driver_key text NOT NULL,
  driver_label text NOT NULL,
  value_text text,
  impact_label text,
  explanation text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX financial_profile_explanation_drivers_assessment_idx
  ON financial_profile_explanation_drivers (assessment_id, sort_order);

CREATE TABLE financial_profile_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES financial_profile_assessments(id) ON DELETE SET NULL,
  profile_label odin_financial_profile_label NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  confirmation_required boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  override_reason text,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT financial_profile_assignments_period_chk
    CHECK (effective_to IS NULL OR effective_from < effective_to),
  CONSTRAINT financial_profile_assignments_decision_chk
    CHECK (confirmed_at IS NULL OR rejected_at IS NULL),
  CONSTRAINT financial_profile_assignments_id_user_uq UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX financial_profile_assignments_active_unique_idx
  ON financial_profile_assignments (user_id)
  WHERE is_active = true;

CREATE INDEX financial_profile_assignments_user_history_idx
  ON financial_profile_assignments (user_id, effective_from DESC);


CREATE TABLE financial_profile_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES financial_profile_assessments(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES financial_profile_assignments(id) ON DELETE SET NULL,
  action odin_profile_event_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX financial_profile_events_user_created_idx
  ON financial_profile_events (user_id, created_at DESC);

CREATE TABLE financial_profile_reclassification_schedules (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  status odin_profile_reclassification_status NOT NULL DEFAULT 'scheduled',
  trigger_source odin_profile_assessment_method NOT NULL DEFAULT 'standard',
  cadence_days integer NOT NULL DEFAULT 30,
  last_checked_at timestamptz,
  last_reclassified_at timestamptz,
  next_due_at timestamptz,
  last_assessment_id uuid REFERENCES financial_profile_assessments(id) ON DELETE SET NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT financial_profile_reclassification_schedules_cadence_chk
    CHECK (cadence_days > 0),
  CONSTRAINT financial_profile_reclassification_schedules_due_order_chk
    CHECK (
      next_due_at IS NULL
      OR last_reclassified_at IS NULL
      OR last_reclassified_at <= next_due_at
    )
);

CREATE INDEX financial_profile_reclassification_schedules_status_idx
  ON financial_profile_reclassification_schedules (status, next_due_at);

CREATE TABLE category_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  short_label text,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX category_groups_active_sort_idx
  ON category_groups (is_active, sort_order);

INSERT INTO category_groups (
  slug,
  label,
  short_label,
  description,
  sort_order
) VALUES
  ('essentials', 'Essentials', 'Essentials', 'Basic needs and necessary day-to-day spending.', 100),
  ('obligatory', 'Obligatory', 'Obligatory', 'Required, recurring, or culturally expected responsibilities.', 200),
  ('discretionary', 'Discretionary', 'Discretionary', 'Flexible wants and lifestyle spending.', 300),
  ('financial_allocation', 'Financial Allocation', 'Financial', 'Savings, investments, and future-focused allocations.', 400)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_group_id uuid NOT NULL REFERENCES category_groups(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  short_label text,
  description text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  is_filipino_context boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT categories_owner_chk
    CHECK (
      (is_system = true AND user_id IS NULL)
      OR (is_system = false AND user_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX categories_system_slug_unique_idx
  ON categories (slug)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX categories_user_slug_unique_idx
  ON categories (user_id, slug)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX categories_system_label_unique_idx
  ON categories (lower(label), category_group_id)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX categories_user_label_unique_idx
  ON categories (user_id, lower(label), category_group_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX categories_group_active_sort_idx
  ON categories (category_group_id, is_active, sort_order);

INSERT INTO categories (
  category_group_id,
  user_id,
  slug,
  label,
  short_label,
  description,
  is_system,
  is_filipino_context,
  sort_order
) VALUES
  ((SELECT id FROM category_groups WHERE slug = 'essentials'), NULL, 'essentials_food_household', 'Food and Household Needs', 'Food/Household', 'Core food, groceries, and household necessities.', true, false, 100),
  ((SELECT id FROM category_groups WHERE slug = 'essentials'), NULL, 'essentials_utilities', 'Utilities', 'Utilities', 'Electricity, water, internet, and mobile load for basic needs.', true, false, 110),
  ((SELECT id FROM category_groups WHERE slug = 'essentials'), NULL, 'essentials_transportation', 'Transportation', 'Transport', 'Commute, fuel, fares, and work-related transportation.', true, false, 120),
  ((SELECT id FROM category_groups WHERE slug = 'essentials'), NULL, 'essentials_healthcare', 'Healthcare and Medicine', 'Healthcare', 'Medical care, medicine, and health-related essentials.', true, false, 130),
  ((SELECT id FROM category_groups WHERE slug = 'obligatory'), NULL, 'obligatory_family_support', 'Family Support', 'Family', 'Support for parents, siblings, dependents, or household members.', true, true, 200),
  ((SELECT id FROM category_groups WHERE slug = 'obligatory'), NULL, 'obligatory_remittances', 'Remittances', 'Remittance', 'Money sent to family or dependents.', true, true, 210),
  ((SELECT id FROM category_groups WHERE slug = 'obligatory'), NULL, 'obligatory_paluwagan', 'Paluwagan', 'Paluwagan', 'Scheduled contributions to a rotating savings group.', true, true, 220),
  ((SELECT id FROM category_groups WHERE slug = 'obligatory'), NULL, 'obligatory_government_contributions', 'Government Contributions', 'Government', 'SSS, PhilHealth, Pag-IBIG, tax, and similar required contributions.', true, true, 230),
  ((SELECT id FROM category_groups WHERE slug = 'obligatory'), NULL, 'obligatory_debt_payments', 'Debt and Loan Payments', 'Debt', 'Minimum debt, loan, credit card, or installment payments.', true, false, 240),
  ((SELECT id FROM category_groups WHERE slug = 'obligatory'), NULL, 'obligatory_insurance', 'Insurance', 'Insurance', 'Insurance premiums and protection-related payments.', true, false, 250),
  ((SELECT id FROM category_groups WHERE slug = 'obligatory'), NULL, 'obligatory_housing_rent', 'Housing or Rent', 'Housing', 'Rent, housing dues, and core shelter costs.', true, false, 260),
  ((SELECT id FROM category_groups WHERE slug = 'discretionary'), NULL, 'discretionary_dining_leisure', 'Dining and Leisure', 'Dining/Leisure', 'Restaurant, cafe, and lifestyle leisure spending.', true, false, 300),
  ((SELECT id FROM category_groups WHERE slug = 'discretionary'), NULL, 'discretionary_shopping', 'Shopping', 'Shopping', 'Clothing, gadgets, home items, and non-essential purchases.', true, false, 310),
  ((SELECT id FROM category_groups WHERE slug = 'discretionary'), NULL, 'discretionary_entertainment', 'Entertainment', 'Entertainment', 'Movies, games, subscriptions, events, and hobbies.', true, false, 320),
  ((SELECT id FROM category_groups WHERE slug = 'discretionary'), NULL, 'discretionary_travel', 'Travel and Leisure', 'Travel', 'Trips, outings, and leisure travel spending.', true, false, 330),
  ((SELECT id FROM category_groups WHERE slug = 'discretionary'), NULL, 'discretionary_personal_misc', 'Personal and Miscellaneous', 'Personal', 'Personal care, donations, community collections, and misc lifestyle spending.', true, true, 340),
  ((SELECT id FROM category_groups WHERE slug = 'financial_allocation'), NULL, 'financial_emergency_fund', 'Emergency Fund', 'Emergency Fund', 'Emergency fund contributions.', true, false, 400),
  ((SELECT id FROM category_groups WHERE slug = 'financial_allocation'), NULL, 'financial_savings', 'Savings', 'Savings', 'General savings contributions.', true, false, 410),
  ((SELECT id FROM category_groups WHERE slug = 'financial_allocation'), NULL, 'financial_investments', 'Investments', 'Investments', 'Investment contributions without portfolio tracking.', true, false, 420)
ON CONFLICT DO NOTHING;

CREATE TABLE subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  slug text NOT NULL,
  kind odin_subcategory_kind NOT NULL DEFAULT 'expense',
  label text NOT NULL,
  short_label text,
  description text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  is_filipino_context boolean NOT NULL DEFAULT false,
  is_protected_default boolean NOT NULL DEFAULT false,
  is_protected boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT subcategories_owner_chk
    CHECK (
      (is_system = true AND user_id IS NULL)
      OR (is_system = false AND user_id IS NOT NULL)
    ),
  CONSTRAINT subcategories_expense_category_chk
    CHECK (
      (kind = 'expense' AND category_id IS NOT NULL)
      OR (kind <> 'expense' AND category_id IS NULL)
    ),
  CONSTRAINT subcategories_user_default_protection_chk
    CHECK (is_system = true OR is_protected_default = false)
);

CREATE UNIQUE INDEX subcategories_system_slug_unique_idx
  ON subcategories (slug)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX subcategories_user_slug_unique_idx
  ON subcategories (user_id, slug)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX subcategories_system_label_unique_idx
  ON subcategories (lower(label))
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX subcategories_user_label_unique_idx
  ON subcategories (user_id, lower(label))
  WHERE user_id IS NOT NULL;

CREATE INDEX subcategories_category_kind_idx
  ON subcategories (category_id, kind, sort_order);

CREATE INDEX subcategories_user_active_idx
  ON subcategories (user_id, is_active, sort_order);

CREATE TABLE user_subcategory_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  restriction_level odin_restriction_level NOT NULL DEFAULT 'free',
  floor_amount_centavos bigint,
  ceiling_amount_centavos bigint,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_subcategory_restrictions_money_chk
    CHECK (
      (floor_amount_centavos IS NULL OR floor_amount_centavos >= 0)
      AND (ceiling_amount_centavos IS NULL OR ceiling_amount_centavos >= 0)
      AND (
        floor_amount_centavos IS NULL
        OR ceiling_amount_centavos IS NULL
        OR floor_amount_centavos <= ceiling_amount_centavos
      )
    ),
  CONSTRAINT user_subcategory_restrictions_period_chk
    CHECK (effective_to IS NULL OR effective_from < effective_to),
  CONSTRAINT user_subcategory_restrictions_level_chk
    CHECK (
      (
        restriction_level = 'free'
        AND ceiling_amount_centavos IS NULL
      )
      OR (
        restriction_level = 'protected'
        AND floor_amount_centavos IS NOT NULL
      )
      OR (
        restriction_level = 'locked'
        AND floor_amount_centavos IS NOT NULL
        AND ceiling_amount_centavos IS NOT NULL
        AND floor_amount_centavos = ceiling_amount_centavos
      )
    )
);

CREATE UNIQUE INDEX user_subcategory_restrictions_active_unique_idx
  ON user_subcategory_restrictions (user_id, subcategory_id)
  WHERE effective_to IS NULL;

CREATE INDEX user_subcategory_restrictions_user_idx
  ON user_subcategory_restrictions (user_id, restriction_level);

CREATE TABLE user_category_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  restriction_level odin_restriction_level NOT NULL DEFAULT 'free',
  floor_amount_centavos bigint,
  ceiling_amount_centavos bigint,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_category_restrictions_money_chk
    CHECK (
      (floor_amount_centavos IS NULL OR floor_amount_centavos >= 0)
      AND (ceiling_amount_centavos IS NULL OR ceiling_amount_centavos >= 0)
      AND (
        floor_amount_centavos IS NULL
        OR ceiling_amount_centavos IS NULL
        OR floor_amount_centavos <= ceiling_amount_centavos
      )
    ),
  CONSTRAINT user_category_restrictions_period_chk
    CHECK (effective_to IS NULL OR effective_from < effective_to),
  CONSTRAINT user_category_restrictions_level_chk
    CHECK (
      (
        restriction_level = 'free'
        AND ceiling_amount_centavos IS NULL
      )
      OR (
        restriction_level = 'protected'
        AND floor_amount_centavos IS NOT NULL
      )
      OR (
        restriction_level = 'locked'
        AND floor_amount_centavos IS NOT NULL
        AND ceiling_amount_centavos IS NOT NULL
        AND floor_amount_centavos = ceiling_amount_centavos
      )
    )
);

CREATE UNIQUE INDEX user_category_restrictions_active_unique_idx
  ON user_category_restrictions (user_id, category_id)
  WHERE effective_to IS NULL;

CREATE INDEX user_category_restrictions_user_idx
  ON user_category_restrictions (user_id, restriction_level);

INSERT INTO subcategories (
  category_id,
  user_id,
  slug,
  kind,
  label,
  short_label,
  description,
  is_system,
  is_filipino_context,
  is_protected_default,
  sort_order
) VALUES
-- -------------------
-- Income: Cash inflow
-- -------------------

  (NULL, NULL, 'income_salary', 'income', 'Salary', 'Salary', 'Regular employment income.', true, false, false, 10),

  (NULL, NULL, 'income_freelance', 'income', 'Freelance or Variable Income', 'Freelance', 'Freelance, commission, business, or irregular income.', true, false, false, 20),

-- -------------------------------------------
-- Essentials: Necessary but flexible expenses
-- -------------------------------------------

  ((SELECT id FROM categories WHERE slug = 'essentials_food_household'), NULL, 'essentials_food_groceries', 'expense', 'Food and Groceries', 'Groceries', 'Food, groceries, and basic household supplies.', true, false, true, 100),

  ((SELECT id FROM categories WHERE slug = 'essentials_utilities'), NULL, 'essentials_electricity', 'expense', 'Electricity', 'Electricity', 'Electricity and power-related essentials.', true, false, true, 120),

  ((SELECT id FROM categories WHERE slug = 'essentials_utilities'), NULL, 'essentials_water', 'expense', 'Water', 'Water', 'Water utility payments.', true, false, true, 125),

  ((SELECT id FROM categories WHERE slug = 'essentials_utilities'), NULL, 'essentials_connectivity', 'expense', 'Internet and Mobile Load', 'Connectivity', 'Internet subscription and mobile load for basic communication.', true, false, true, 128),
  ((SELECT id FROM categories WHERE slug = 'essentials_transportation'), NULL, 'essentials_transportation_commute', 'expense', 'Commute and Fares', 'Commute', 'Public transport fares, jeepney, bus, train, and other commute costs.', true, false, true, 130),
  ((SELECT id FROM categories WHERE slug = 'essentials_transportation'), NULL, 'essentials_transportation_fuel', 'expense', 'Fuel and Parking', 'Fuel', 'Fuel, parking, and similar transportation costs.', true, false, true, 135),
  ((SELECT id FROM categories WHERE slug = 'essentials_healthcare'), NULL, 'essentials_healthcare_medicine', 'expense', 'Medicine', 'Medicine', 'Prescription and over-the-counter medicine.', true, false, true, 140),
  ((SELECT id FROM categories WHERE slug = 'essentials_healthcare'), NULL, 'essentials_healthcare_consultation', 'expense', 'Medical Consultation', 'Consultation', 'Doctor visits, clinic fees, and related essential care.', true, false, true, 145),

-- -----------------------------------------------------------------------------------------------------------
-- Obligatories: Inflexible necessary expenses that have a hard minimum and cannot be reduced without penalty, consequence, or significant change in lifestyle.
-- -----------------------------------------------------------------------------------------------------------

  ((SELECT id FROM categories WHERE slug = 'obligatory_family_support'), NULL, 'obligatory_family_support', 'expense', 'Family Support', 'Family', 'Support for parents, siblings, dependents, or household members.', true, true, true, 200),

  ((SELECT id FROM categories WHERE slug = 'obligatory_remittances'), NULL, 'obligatory_remittances', 'expense', 'Remittances', 'Remittance', 'Money sent to family or dependents.', true, true, true, 210),

  ((SELECT id FROM categories WHERE slug = 'obligatory_paluwagan'), NULL, 'obligatory_paluwagan', 'expense', 'Paluwagan', 'Paluwagan', 'Scheduled contributions to a rotating savings group.', true, true, true, 220),

  ((SELECT id FROM categories WHERE slug = 'obligatory_government_contributions'), NULL, 'obligatory_government_contributions', 'expense', 'Government Contributions', 'Government', 'SSS, PhilHealth, Pag-IBIG, tax, and similar required contributions.', true, true, true, 250),

  ((SELECT id FROM categories WHERE slug = 'obligatory_debt_payments'), NULL, 'obligatory_debt_payments', 'expense', 'Debt and Loan Payments', 'Debt', 'Minimum debt, loan, credit card, or installment payments.', true, false, true, 260),

  ((SELECT id FROM categories WHERE slug = 'obligatory_insurance'), NULL, 'obligatory_insurance', 'expense', 'Insurance', 'Insurance', 'Insurance premiums and protection-related payments.', true, false, true, 270),

  ((SELECT id FROM categories WHERE slug = 'obligatory_housing_rent'), NULL, 'obligatory_housing_rent', 'expense', 'Housing or Rent', 'Housing', 'Rent, housing dues, and core shelter costs.', true, false, true, 110),

-- ------------------------------------------------------------------
-- Discretionary: Non-essential expenses for lifestyle and enjoyment.
-- ------------------------------------------------------------------

  ((SELECT id FROM categories WHERE slug = 'discretionary_dining_leisure'), NULL, 'discretionary_dining_out', 'expense', 'Dining Out', 'Dining', 'Restaurant, cafe, and takeout spending.', true, false, false, 300),

  ((SELECT id FROM categories WHERE slug = 'discretionary_shopping'), NULL, 'discretionary_shopping', 'expense', 'Shopping', 'Shopping', 'Clothing, gadgets, home items, and non-essential purchases.', true, false, false, 310),

  ((SELECT id FROM categories WHERE slug = 'discretionary_entertainment'), NULL, 'discretionary_entertainment', 'expense', 'Entertainment', 'Fun', 'Movies, games, subscriptions, events, and leisure.', true, false, false, 320),

  ((SELECT id FROM categories WHERE slug = 'discretionary_travel'), NULL, 'discretionary_travel', 'expense', 'Travel and Leisure', 'Travel', 'Trips, outings, and leisure travel spending.', true, false, false, 330),

  ((SELECT id FROM categories WHERE slug = 'discretionary_personal_misc'), NULL, 'discretionary_alcohol_tobacco', 'expense', 'Alcoholic Beverages & Tobacco', 'Alcohol/Tobacco', 'Alcoholic drinks, cigarettes, vape, and related products.', true, false, true, 340),

  ((SELECT id FROM categories WHERE slug = 'discretionary_shopping'), NULL, 'discretionary_clothing_footwear', 'expense', 'Clothing and Footwear', 'Clothing', 'Clothes, shoes, accessories, and tailoring services.', true, false, true, 345),

  ((SELECT id FROM categories WHERE slug = 'discretionary_shopping'), NULL, 'discretionary_furnishings', 'expense', 'Furnishings & Equipment', 'Furnishings', 'Furniture, appliances, tools, and household textiles.', true, false, true, 350),

  ((SELECT id FROM categories WHERE slug = 'discretionary_entertainment'), NULL, 'discretionary_recreation_culture', 'expense', 'Recreation & Culture', 'Recreation', 'Movies, concerts, hobbies, sports, books, games, and cultural events.', true, false, true, 355),

  ((SELECT id FROM categories WHERE slug = 'discretionary_personal_misc'), NULL, 'discretionary_personal_care', 'expense', 'Personal Care', 'Personal Care', 'Haircuts, cosmetics, toiletries, salon services, and miscellaneous personal goods.', true, false, true, 360),

  ((SELECT id FROM categories WHERE slug = 'discretionary_travel'), NULL, 'discretionary_accommodation', 'expense', 'Accommodation', 'Hotel/Hostel', 'Hotels, resorts, and short-term lodging.', true, false, false, 365),

  ((SELECT id FROM categories WHERE slug = 'discretionary_personal_misc'), NULL, 'discretionary_religious_donations', 'expense', 'Church or Religious Donations', 'Donations', 'Church, religious, or faith community contributions.', true, true, false, 230),

  ((SELECT id FROM categories WHERE slug = 'discretionary_personal_misc'), NULL, 'discretionary_community_collections', 'expense', 'Barangay or Community Collections', 'Community', 'Barangay, neighborhood, group, or community contributions.', true, true, false, 240),

-- --------------------------------------------------------------------------------------
-- Financial Allocations: Non-essential expenses for financial goals and future planning.
-- --------------------------------------------------------------------------------------

  ((SELECT id FROM categories WHERE slug = 'financial_emergency_fund'), NULL, 'financial_emergency_fund', 'expense', 'Emergency Fund Contribution', 'Emergency Fund', 'Emergency fund contributions.', true, false, true, 400),

  ((SELECT id FROM categories WHERE slug = 'financial_savings'), NULL, 'financial_savings', 'expense', 'Savings Contribution', 'Savings', 'General savings contributions.', true, false, true, 410),

  ((SELECT id FROM categories WHERE slug = 'financial_investments'), NULL, 'financial_investments', 'expense', 'Investment Contribution', 'Investments', 'Investment contributions without portfolio tracking.', true, false, false, 420)
ON CONFLICT (slug) WHERE user_id IS NULL DO NOTHING;

CREATE TABLE income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL,
  income_type odin_income_type NOT NULL,
  frequency odin_income_frequency NOT NULL,
  expected_amount_centavos bigint,
  min_amount_centavos bigint,
  max_amount_centavos bigint,
  payday_day_of_month integer,
  payday_second_day_of_month integer,
  payday_day_of_week integer,
  next_expected_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT income_sources_amount_chk
    CHECK (
      (expected_amount_centavos IS NULL OR expected_amount_centavos >= 0)
      AND (min_amount_centavos IS NULL OR min_amount_centavos >= 0)
      AND (max_amount_centavos IS NULL OR max_amount_centavos >= 0)
    ),
  CONSTRAINT income_sources_amount_range_chk
    CHECK (
      min_amount_centavos IS NULL
      OR max_amount_centavos IS NULL
      OR min_amount_centavos <= max_amount_centavos
    ),
  CONSTRAINT income_sources_payday_chk
    CHECK (
      (payday_day_of_month IS NULL OR payday_day_of_month BETWEEN 1 AND 31)
      AND (payday_second_day_of_month IS NULL OR payday_second_day_of_month BETWEEN 1 AND 31)
      AND (payday_day_of_week IS NULL OR payday_day_of_week BETWEEN 0 AND 6)
    )
);

CREATE INDEX income_sources_user_active_idx
  ON income_sources (user_id, is_active);

CREATE TABLE financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL,
  kind odin_account_kind NOT NULL,
  status odin_account_status NOT NULL DEFAULT 'active',
  opening_balance_centavos bigint NOT NULL DEFAULT 0,
  current_balance_centavos bigint NOT NULL DEFAULT 0,
  credit_limit_centavos bigint,
  include_in_dashboard_balance boolean NOT NULL DEFAULT true,
  institution_name text,
  opened_on date,
  archived_at timestamptz,
  deleted_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT financial_accounts_credit_limit_chk
    CHECK (credit_limit_centavos IS NULL OR credit_limit_centavos >= 0),
  CONSTRAINT financial_accounts_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CONSTRAINT financial_accounts_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX financial_accounts_user_status_idx
  ON financial_accounts (user_id, status, sort_order);


CREATE TABLE transaction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_type odin_transaction_type NOT NULL,
  status odin_transaction_template_status NOT NULL DEFAULT 'active',
  name text NOT NULL,
  amount_centavos bigint,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,
  source_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  destination_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  merchant_name text,
  counterparty_name text,
  notes text,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT transaction_templates_amount_chk
    CHECK (amount_centavos IS NULL OR amount_centavos > 0),
  CONSTRAINT transaction_templates_use_count_chk
    CHECK (use_count >= 0),
  CONSTRAINT transaction_templates_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CONSTRAINT transaction_templates_shape_chk
    CHECK (
      (
        transaction_type = 'income'
        AND destination_account_id IS NOT NULL
        AND source_account_id IS NULL
        AND subcategory_id IS NOT NULL
      )
      OR (
        transaction_type = 'expense'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NULL
        AND subcategory_id IS NOT NULL
      )
      OR (
        transaction_type = 'transfer'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NOT NULL
        AND source_account_id <> destination_account_id
        AND subcategory_id IS NULL
      )
      OR (status IN ('archived', 'deleted'))
    ),
  CONSTRAINT transaction_templates_id_user_uq UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX transaction_templates_user_name_unique_idx
  ON transaction_templates (user_id, lower(name))
  WHERE status <> 'deleted';


CREATE INDEX transaction_templates_user_status_idx
  ON transaction_templates (user_id, status, last_used_at DESC);

CREATE TABLE recurring_transaction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_type odin_transaction_type NOT NULL,
  status odin_recurring_template_status NOT NULL DEFAULT 'active',
  name text NOT NULL,
  amount_centavos bigint NOT NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,
  source_account_id uuid REFERENCES financial_accounts(id) ON DELETE CASCADE,
  destination_account_id uuid REFERENCES financial_accounts(id) ON DELETE CASCADE,
  frequency odin_recurring_frequency NOT NULL,
  interval_count integer NOT NULL DEFAULT 1,
  day_of_month integer,
  second_day_of_month integer,
  day_of_week integer,
  custom_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_on date NOT NULL,
  ends_on date,
  next_occurrence_date date,
  last_generated_date date,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_days_before integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT recurring_transaction_templates_amount_chk
    CHECK (amount_centavos > 0),
  CONSTRAINT recurring_transaction_templates_period_chk
    CHECK (ends_on IS NULL OR starts_on <= ends_on),
  CONSTRAINT recurring_transaction_templates_interval_chk
    CHECK (interval_count > 0),
  CONSTRAINT recurring_transaction_templates_calendar_chk
    CHECK (
      (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31)
      AND (second_day_of_month IS NULL OR second_day_of_month BETWEEN 1 AND 31)
      AND (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6)
    ),
  CONSTRAINT recurring_transaction_templates_reminder_chk
    CHECK (reminder_days_before >= 0),
  CONSTRAINT recurring_transaction_templates_shape_chk
    CHECK (
      (
        transaction_type = 'income'
        AND destination_account_id IS NOT NULL
        AND source_account_id IS NULL
        AND subcategory_id IS NOT NULL
      )
      OR (
        transaction_type = 'expense'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NULL
        AND subcategory_id IS NOT NULL
      )
      OR (
        transaction_type = 'transfer'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NOT NULL
        AND source_account_id <> destination_account_id
        AND subcategory_id IS NULL
      )
    ),
  CONSTRAINT recurring_transaction_templates_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX recurring_transaction_templates_user_status_idx
  ON recurring_transaction_templates (user_id, status, next_occurrence_date);


CREATE TABLE financial_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  recurring_template_id uuid REFERENCES recurring_transaction_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  status odin_obligation_status NOT NULL DEFAULT 'active',
  amount_centavos bigint NOT NULL,
  frequency odin_recurring_frequency NOT NULL,
  due_day_of_month integer,
  is_family_support boolean NOT NULL DEFAULT false,
  is_dependent_support boolean NOT NULL DEFAULT false,
  protected_by_default boolean NOT NULL DEFAULT true,
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT financial_obligations_amount_chk
    CHECK (amount_centavos >= 0),
  CONSTRAINT financial_obligations_due_day_chk
    CHECK (due_day_of_month IS NULL OR due_day_of_month BETWEEN 1 AND 31),
  CONSTRAINT financial_obligations_period_chk
    CHECK (ends_on IS NULL OR starts_on IS NULL OR starts_on <= ends_on)
);

CREATE INDEX financial_obligations_user_status_idx
  ON financial_obligations (user_id, status);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_type odin_transaction_type NOT NULL,
  status odin_transaction_status NOT NULL DEFAULT 'posted',
  entry_source odin_transaction_entry_source NOT NULL DEFAULT 'manual',
  transaction_date date NOT NULL,
  posted_at timestamptz DEFAULT now(),
  amount_centavos bigint NOT NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,
  source_account_id uuid REFERENCES financial_accounts(id) ON DELETE CASCADE,
  destination_account_id uuid REFERENCES financial_accounts(id) ON DELETE CASCADE,
  recurring_template_id uuid REFERENCES recurring_transaction_templates(id) ON DELETE SET NULL,
  merchant_name text,
  counterparty_name text,
  notes text,
  client_mutation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  retain_until date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT transactions_amount_chk
    CHECK (amount_centavos > 0),
  CONSTRAINT transactions_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CONSTRAINT transactions_id_user_uq UNIQUE (id, user_id),
  CONSTRAINT transactions_posted_status_chk
    CHECK (status <> 'posted' OR posted_at IS NOT NULL),
  CONSTRAINT transactions_shape_chk
    CHECK (
      (
        transaction_type = 'income'
        AND destination_account_id IS NOT NULL
        AND source_account_id IS NULL
        AND subcategory_id IS NOT NULL
      )
      OR (
        transaction_type = 'expense'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NULL
        AND subcategory_id IS NOT NULL
      )
      OR (
        transaction_type = 'transfer'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NOT NULL
        AND source_account_id <> destination_account_id
        AND subcategory_id IS NULL
      )
    )
);

CREATE UNIQUE INDEX transactions_client_mutation_unique_idx
  ON transactions (user_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE INDEX transactions_user_date_idx
  ON transactions (user_id, transaction_date DESC, created_at DESC);

CREATE INDEX transactions_user_type_status_idx
  ON transactions (user_id, transaction_type, status, transaction_date DESC);

CREATE INDEX transactions_subcategory_date_idx
  ON transactions (subcategory_id, transaction_date DESC)
  WHERE subcategory_id IS NOT NULL;


CREATE TABLE transaction_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  item_label text NOT NULL,
  quantity numeric(12, 3),
  amount_centavos bigint NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT transaction_line_items_quantity_chk
    CHECK (quantity IS NULL OR quantity > 0),
  CONSTRAINT transaction_line_items_amount_chk
    CHECK (amount_centavos > 0)
);

CREATE INDEX transaction_line_items_transaction_idx
  ON transaction_line_items (transaction_id, sort_order);

CREATE INDEX transaction_line_items_user_subcategory_idx
  ON transaction_line_items (user_id, subcategory_id);

CREATE TABLE transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  action odin_transaction_event_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_snapshot jsonb,
  after_snapshot jsonb,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX transaction_events_transaction_idx
  ON transaction_events (transaction_id, created_at);

CREATE TABLE transaction_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  client_draft_id text NOT NULL,
  status odin_transaction_draft_status NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  captured_offline_at timestamptz,
  synced_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, client_draft_id)
);

CREATE INDEX transaction_drafts_user_status_idx
  ON transaction_drafts (user_id, status, created_at DESC);

CREATE TABLE user_transaction_retention_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  retention_days integer NOT NULL DEFAULT 2555,
  auto_archive_enabled boolean NOT NULL DEFAULT false,
  archive_after_days integer,
  purge_after_days integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_transaction_retention_settings_days_chk
    CHECK (
      retention_days > 0
      AND (archive_after_days IS NULL OR archive_after_days > 0)
      AND (purge_after_days IS NULL OR purge_after_days > 0)
      AND (
        archive_after_days IS NULL
        OR purge_after_days IS NULL
        OR archive_after_days <= purge_after_days
      )
    )
);

CREATE TABLE transaction_retention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  action odin_transaction_retention_action NOT NULL,
  actioned_at timestamptz NOT NULL DEFAULT now(),
  retain_until date,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX transaction_retention_events_user_actioned_idx
  ON transaction_retention_events (user_id, actioned_at DESC);

CREATE TABLE recurring_transaction_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_template_id uuid NOT NULL REFERENCES recurring_transaction_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  status odin_recurring_occurrence_status NOT NULL DEFAULT 'scheduled',
  generated_transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  reminder_sent_at timestamptz,
  posted_at timestamptz,
  skipped_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT recurring_transaction_occurrences_posted_chk
    CHECK (status <> 'posted' OR generated_transaction_id IS NOT NULL),
  UNIQUE (recurring_template_id, scheduled_date)
);

CREATE INDEX recurring_transaction_occurrences_user_status_idx
  ON recurring_transaction_occurrences (user_id, status, scheduled_date);

CREATE TABLE expected_spending_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  event_kind odin_expected_event_kind NOT NULL,
  status odin_expected_event_status NOT NULL DEFAULT 'active',
  title text NOT NULL,
  expected_amount_centavos bigint,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  repeats_yearly boolean NOT NULL DEFAULT false,
  affects_forecast boolean NOT NULL DEFAULT true,
  affects_anomaly_suppression boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT expected_spending_events_period_chk
    CHECK (starts_on <= ends_on),
  CONSTRAINT expected_spending_events_amount_chk
    CHECK (expected_amount_centavos IS NULL OR expected_amount_centavos >= 0)
);

CREATE INDEX expected_spending_events_user_period_idx
  ON expected_spending_events (user_id, status, starts_on, ends_on);

CREATE TABLE budget_strategy_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  strategy odin_budget_strategy NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT budget_strategy_configs_owner_chk
    CHECK (
      (is_system = true AND user_id IS NULL)
      OR (is_system = false AND user_id IS NOT NULL)
    ),
  CONSTRAINT budget_strategy_configs_id_user_uq UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX budget_strategy_configs_system_unique_idx
  ON budget_strategy_configs (strategy, lower(name))
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX budget_strategy_configs_user_unique_idx
  ON budget_strategy_configs (user_id, lower(name))
  WHERE user_id IS NOT NULL;


CREATE TABLE budget_strategy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  strategy_config_id uuid NOT NULL REFERENCES budget_strategy_configs(id) ON DELETE CASCADE,
  allocation_scope odin_allocation_scope NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,
  restriction_level odin_restriction_level NOT NULL DEFAULT 'free',
  target_percent_bps integer,
  min_percent_bps integer,
  max_percent_bps integer,
  min_amount_centavos bigint,
  max_amount_centavos bigint,
  priority_order integer NOT NULL DEFAULT 1,
  is_reducible boolean NOT NULL DEFAULT true,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT budget_strategy_rules_scope_chk
    CHECK (
      (allocation_scope = 'category' AND subcategory_id IS NULL)
      OR (allocation_scope = 'subcategory' AND subcategory_id IS NOT NULL)
    ),
  CONSTRAINT budget_strategy_rules_percent_chk
    CHECK (
      (target_percent_bps IS NULL OR target_percent_bps BETWEEN 0 AND 10000)
      AND (min_percent_bps IS NULL OR min_percent_bps BETWEEN 0 AND 10000)
      AND (max_percent_bps IS NULL OR max_percent_bps BETWEEN 0 AND 10000)
      AND (
        min_percent_bps IS NULL
        OR max_percent_bps IS NULL
        OR min_percent_bps <= max_percent_bps
      )
    ),
  CONSTRAINT budget_strategy_rules_money_chk
    CHECK (
      (min_amount_centavos IS NULL OR min_amount_centavos >= 0)
      AND (max_amount_centavos IS NULL OR max_amount_centavos >= 0)
      AND (
        min_amount_centavos IS NULL
        OR max_amount_centavos IS NULL
        OR min_amount_centavos <= max_amount_centavos
      )
    ),
  CONSTRAINT budget_strategy_rules_priority_chk
    CHECK (priority_order > 0),
  CONSTRAINT budget_strategy_rules_locked_chk
    CHECK (
      restriction_level <> 'locked'
      OR (
        (
          min_amount_centavos IS NOT NULL
          AND max_amount_centavos IS NOT NULL
          AND min_amount_centavos = max_amount_centavos
        )
        OR (
          min_percent_bps IS NOT NULL
          AND max_percent_bps IS NOT NULL
          AND min_percent_bps = max_percent_bps
        )
      )
    )
);

CREATE UNIQUE INDEX budget_strategy_rules_category_unique_idx
  ON budget_strategy_rules (strategy_config_id, category_id)
  WHERE allocation_scope = 'category';

CREATE UNIQUE INDEX budget_strategy_rules_subcategory_unique_idx
  ON budget_strategy_rules (strategy_config_id, subcategory_id)
  WHERE allocation_scope = 'subcategory';

CREATE INDEX budget_strategy_rules_config_idx
  ON budget_strategy_rules (strategy_config_id, priority_order);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status odin_budget_status NOT NULL DEFAULT 'draft',
  source odin_budget_source NOT NULL DEFAULT 'manual',
  source_recommendation_id uuid,
  forecast_run_id uuid,
  strategy odin_budget_strategy,
  period_kind odin_budget_period_kind NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  budget_period_days integer NOT NULL,
  total_amount_centavos bigint NOT NULL,
  starting_balance_centavos bigint,
  surplus_handling odin_surplus_handling NOT NULL DEFAULT 'no_action',
  deficit_handling odin_deficit_handling NOT NULL DEFAULT 'warn_only',
  allow_deficit_planning boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT budgets_period_chk
    CHECK (period_start < period_end),
  CONSTRAINT budgets_period_days_chk
    CHECK (budget_period_days > 0 AND budget_period_days = period_end - period_start),
  CONSTRAINT budgets_money_chk
    CHECK (total_amount_centavos > 0),
  CONSTRAINT budgets_active_chk
    CHECK (status <> 'active' OR activated_at IS NOT NULL),
  CONSTRAINT budgets_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CONSTRAINT budgets_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX budgets_user_period_idx
  ON budgets (user_id, period_start DESC, period_end DESC);

CREATE INDEX budgets_user_status_idx
  ON budgets (user_id, status, period_start DESC);


CREATE TABLE budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  allocation_scope odin_allocation_scope NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,
  allocated_amount_centavos bigint NOT NULL,
  rollover_amount_centavos bigint NOT NULL DEFAULT 0,
  spent_amount_snapshot_centavos bigint,
  is_protected_snapshot boolean NOT NULL DEFAULT false,
  priority_weight integer CHECK (priority_weight BETWEEN 1 AND 5),
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT budget_allocations_scope_chk
    CHECK (
      (allocation_scope = 'category' AND subcategory_id IS NULL)
      OR (allocation_scope = 'subcategory' AND subcategory_id IS NOT NULL)
    ),
  CONSTRAINT budget_allocations_money_chk
    CHECK (
      allocated_amount_centavos >= 0
      AND rollover_amount_centavos >= 0
      AND (
        spent_amount_snapshot_centavos IS NULL
        OR spent_amount_snapshot_centavos >= 0
      )
    )
);

CREATE UNIQUE INDEX budget_allocations_category_unique_idx
  ON budget_allocations (budget_id, category_id)
  WHERE allocation_scope = 'category';

CREATE UNIQUE INDEX budget_allocations_subcategory_unique_idx
  ON budget_allocations (budget_id, subcategory_id)
  WHERE allocation_scope = 'subcategory';

CREATE INDEX budget_allocations_budget_idx
  ON budget_allocations (budget_id, sort_order);

CREATE TABLE budget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  action odin_budget_event_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX budget_events_budget_created_idx
  ON budget_events (budget_id, created_at);

CREATE TABLE budget_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL DEFAULT now(),
  health_status odin_budget_health_status NOT NULL,
  allocated_amount_centavos bigint NOT NULL DEFAULT 0,
  actual_amount_centavos bigint NOT NULL DEFAULT 0,
  variance_amount_centavos bigint NOT NULL DEFAULT 0,
  adherence_bps integer,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT budget_health_snapshots_money_chk
    CHECK (
      allocated_amount_centavos >= 0
      AND actual_amount_centavos >= 0
      AND (adherence_bps IS NULL OR adherence_bps BETWEEN 0 AND 10000)
    )
);

CREATE INDEX budget_health_snapshots_budget_measured_idx
  ON budget_health_snapshots (budget_id, measured_at DESC);

CREATE TABLE savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  linked_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  linked_subcategory_id uuid NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  status odin_savings_goal_status NOT NULL DEFAULT 'active',
  progress_state odin_goal_progress_state NOT NULL DEFAULT 'projection_unavailable',
  target_amount_centavos bigint NOT NULL,
  current_amount_centavos bigint NOT NULL DEFAULT 0,
  target_date date NOT NULL,
  priority_rank integer NOT NULL DEFAULT 1,
  projected_completion_date date,
  achieved_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goals_amount_chk
    CHECK (target_amount_centavos > 0 AND current_amount_centavos >= 0),
  CONSTRAINT savings_goals_priority_chk
    CHECK (priority_rank > 0),
  CONSTRAINT savings_goals_achieved_chk
    CHECK (
      status <> 'achieved'
      OR (
        achieved_at IS NOT NULL
        AND progress_state = 'achieved'
        AND current_amount_centavos >= target_amount_centavos
      )
    ),
  CONSTRAINT savings_goals_progress_state_chk
    CHECK (
      progress_state <> 'achieved'
      OR (
        status IN ('achieved', 'archived')
        AND achieved_at IS NOT NULL
        AND current_amount_centavos >= target_amount_centavos
      )
    ),
  CONSTRAINT savings_goals_archived_status_chk
    CHECK (status <> 'archived' OR archived_at IS NOT NULL),
  CONSTRAINT savings_goals_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CONSTRAINT savings_goals_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX savings_goals_user_status_idx
  ON savings_goals (user_id, status, priority_rank);


CREATE TABLE savings_goal_allocation_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  strategy odin_savings_allocation_strategy NOT NULL DEFAULT 'avalanche',
  planned_contribution_centavos bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goal_allocation_preferences_planned_chk
    CHECK (planned_contribution_centavos >= 0)
);

CREATE TABLE savings_goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_goal_id uuid NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  source odin_contribution_source NOT NULL DEFAULT 'manual',
  source_budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL,
  contribution_date date NOT NULL,
  amount_centavos bigint NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goal_contributions_amount_chk
    CHECK (amount_centavos > 0)
);

CREATE INDEX savings_goal_contributions_goal_date_idx
  ON savings_goal_contributions (savings_goal_id, contribution_date DESC);

CREATE INDEX savings_goal_contributions_user_date_idx
  ON savings_goal_contributions (user_id, contribution_date DESC);

CREATE UNIQUE INDEX savings_goal_contributions_transaction_unique_idx
  ON savings_goal_contributions (transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE TABLE savings_goal_progress_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_goal_id uuid NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  current_amount_centavos bigint NOT NULL,
  progress_percent_bps integer,
  projected_completion_date date,
  progress_state odin_goal_progress_state NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goal_progress_snapshots_amount_chk
    CHECK (
      current_amount_centavos >= 0
      AND (progress_percent_bps IS NULL OR progress_percent_bps BETWEEN 0 AND 10000)
    ),
  UNIQUE (savings_goal_id, snapshot_date)
);

CREATE INDEX savings_goal_progress_snapshots_goal_date_idx
  ON savings_goal_progress_snapshots (savings_goal_id, snapshot_date DESC);

CREATE TABLE savings_goal_budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_allocation_id uuid NOT NULL REFERENCES budget_allocations(id) ON DELETE CASCADE,
  savings_goal_id uuid NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  allocation_strategy odin_savings_allocation_strategy NOT NULL,
  allocated_amount_centavos bigint NOT NULL,
  remaining_amount_snapshot_centavos bigint NOT NULL,
  allocation_order integer NOT NULL,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goal_budget_allocations_money_chk
    CHECK (
      allocated_amount_centavos >= 0
      AND remaining_amount_snapshot_centavos >= 0
    ),
  CONSTRAINT savings_goal_budget_allocations_order_chk
    CHECK (allocation_order > 0),
  UNIQUE (budget_allocation_id, savings_goal_id)
);

CREATE INDEX savings_goal_budget_allocations_goal_idx
  ON savings_goal_budget_allocations (savings_goal_id);

CREATE TABLE debt_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  linked_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  name text NOT NULL,
  lender_name text,
  status odin_debt_account_status NOT NULL DEFAULT 'active',
  original_balance_centavos bigint NOT NULL DEFAULT 0,
  current_balance_centavos bigint NOT NULL,
  annual_interest_rate_bps integer NOT NULL DEFAULT 0,
  minimum_payment_centavos bigint NOT NULL DEFAULT 0,
  due_day_of_month integer,
  opened_on date,
  paid_off_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT debt_accounts_money_chk
    CHECK (
      original_balance_centavos >= 0
      AND current_balance_centavos >= 0
      AND minimum_payment_centavos >= 0
    ),
  CONSTRAINT debt_accounts_interest_chk
    CHECK (annual_interest_rate_bps >= 0),
  CONSTRAINT debt_accounts_due_day_chk
    CHECK (due_day_of_month IS NULL OR due_day_of_month BETWEEN 1 AND 31),
  CONSTRAINT debt_accounts_paid_off_chk
    CHECK (status <> 'paid_off' OR paid_off_at IS NOT NULL),
  CONSTRAINT debt_accounts_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CONSTRAINT debt_accounts_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX debt_accounts_user_status_idx
  ON debt_accounts (user_id, status);


CREATE TABLE debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_account_id uuid NOT NULL REFERENCES debt_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  source odin_debt_payment_source NOT NULL DEFAULT 'manual',
  payment_date date NOT NULL,
  amount_centavos bigint NOT NULL,
  principal_centavos bigint,
  interest_centavos bigint,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT debt_payments_money_chk
    CHECK (
      amount_centavos > 0
      AND (principal_centavos IS NULL OR principal_centavos >= 0)
      AND (interest_centavos IS NULL OR interest_centavos >= 0)
    )
);

CREATE INDEX debt_payments_account_date_idx
  ON debt_payments (debt_account_id, payment_date DESC);

CREATE TABLE debt_strategy_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  strategy odin_debt_strategy NOT NULL DEFAULT 'avalanche',
  extra_payment_centavos bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT debt_strategy_preferences_extra_payment_chk
    CHECK (extra_payment_centavos >= 0)
);

CREATE TABLE user_debt_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  debt_account_id uuid NOT NULL REFERENCES debt_accounts(id) ON DELETE CASCADE,
  priority_rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_debt_priorities_rank_chk
    CHECK (priority_rank > 0),
  UNIQUE (user_id, debt_account_id),
  UNIQUE (user_id, priority_rank)
);

CREATE INDEX user_debt_priorities_user_rank_idx
  ON user_debt_priorities (user_id, priority_rank);

CREATE TABLE debt_repayment_projection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  strategy odin_debt_strategy NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  horizon_months integer NOT NULL,
  extra_payment_centavos bigint NOT NULL DEFAULT 0,
  projected_debt_free_date date,
  total_interest_centavos bigint,
  total_paid_centavos bigint,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT debt_repayment_projection_runs_horizon_chk
    CHECK (horizon_months > 0),
  CONSTRAINT debt_repayment_projection_runs_money_chk
    CHECK (
      extra_payment_centavos >= 0
      AND (total_interest_centavos IS NULL OR total_interest_centavos >= 0)
      AND (total_paid_centavos IS NULL OR total_paid_centavos >= 0)
    )
);

CREATE INDEX debt_repayment_projection_runs_user_idx
  ON debt_repayment_projection_runs (user_id, generated_at DESC);

CREATE TABLE debt_repayment_projection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_run_id uuid NOT NULL REFERENCES debt_repayment_projection_runs(id) ON DELETE CASCADE,
  debt_account_id uuid NOT NULL REFERENCES debt_accounts(id) ON DELETE CASCADE,
  payoff_order integer NOT NULL,
  projected_payoff_date date,
  projected_total_interest_centavos bigint,
  projected_total_paid_centavos bigint,
  explanation text,

  CONSTRAINT debt_repayment_projection_items_order_chk
    CHECK (payoff_order > 0),
  CONSTRAINT debt_repayment_projection_items_money_chk
    CHECK (
      (projected_total_interest_centavos IS NULL OR projected_total_interest_centavos >= 0)
      AND (projected_total_paid_centavos IS NULL OR projected_total_paid_centavos >= 0)
    ),
  UNIQUE (projection_run_id, debt_account_id)
);

CREATE TABLE debt_repayment_projection_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_item_id uuid NOT NULL REFERENCES debt_repayment_projection_items(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  projected_balance_centavos bigint NOT NULL,
  projected_payment_centavos bigint NOT NULL,
  projected_interest_centavos bigint NOT NULL DEFAULT 0,

  CONSTRAINT debt_repayment_projection_points_period_chk
    CHECK (period_start < period_end),
  CONSTRAINT debt_repayment_projection_points_money_chk
    CHECK (
      projected_balance_centavos >= 0
      AND projected_payment_centavos >= 0
      AND projected_interest_centavos >= 0
    )
);

CREATE INDEX debt_repayment_projection_points_item_period_idx
  ON debt_repayment_projection_points (projection_item_id, period_start);

-- A forecast run is one generated forecast snapshot for a user.
-- It can contain multiple targets: total spending, four expense groups,
-- income, savings trajectory, and debt remaining balance.
CREATE TABLE forecast_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  status odin_forecast_status NOT NULL DEFAULT 'available',

  model_kind odin_forecast_model_kind NOT NULL,
  model_version text,
  personalization_alpha numeric(5, 4) NOT NULL DEFAULT 0,
  history_days integer NOT NULL DEFAULT 0,
  input_window_start date,
  input_window_end date,

  granularity odin_forecast_granularity NOT NULL,
  horizon_days integer NOT NULL,
  forecast_start date NOT NULL,
  forecast_end date NOT NULL,

  disclaimer_text text NOT NULL DEFAULT
    'Forecasts are inferential and informational only, based on your past spending and current budget. Actual future spending may differ.',
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,

  CONSTRAINT forecast_runs_alpha_chk
    CHECK (personalization_alpha >= 0 AND personalization_alpha <= 1),
  CONSTRAINT forecast_runs_history_days_chk
    CHECK (history_days >= 0),
  CONSTRAINT forecast_runs_horizon_days_chk
    CHECK (horizon_days > 0),
  CONSTRAINT forecast_runs_period_chk
    CHECK (forecast_start < forecast_end),
  CONSTRAINT forecast_runs_input_window_chk
    CHECK (
      input_window_start IS NULL
      OR input_window_end IS NULL
      OR input_window_start <= input_window_end
    ),
  CONSTRAINT forecast_runs_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX forecast_runs_user_generated_idx
  ON forecast_runs (user_id, generated_at DESC);

CREATE INDEX forecast_runs_user_status_idx
  ON forecast_runs (user_id, status);


-- A series is one line or target inside a forecast run.
-- For the forecast dashboard, the four category_spending series are the
-- Essentials, Obligatory, Discretionary, and Financial Allocation lines.
-- Subcategory series support per-subcategory forecast views and reporting.
CREATE TABLE forecast_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_run_id uuid NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  target odin_forecast_target NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,

  -- Optional pointer used when target is savings_balance or debt_balance.
  related_entity_id uuid,

  label text NOT NULL,
  unit text NOT NULL DEFAULT 'centavos',
  explanation text,
  confidence_label text,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT forecast_series_category_target_chk
    CHECK (
      (
        target = 'category_spending'
        AND category_id IS NOT NULL
        AND subcategory_id IS NULL
        AND related_entity_id IS NULL
      )
      OR (
        target = 'subcategory_spending'
        AND category_id IS NOT NULL
        AND subcategory_id IS NOT NULL
        AND related_entity_id IS NULL
      )
      OR (
        target NOT IN ('category_spending', 'subcategory_spending')
        AND category_id IS NULL
        AND subcategory_id IS NULL
      )
    )
);

CREATE INDEX forecast_series_run_target_idx
  ON forecast_series (forecast_run_id, target);

CREATE UNIQUE INDEX forecast_series_run_category_unique_idx
  ON forecast_series (forecast_run_id, category_id)
  WHERE target = 'category_spending';

CREATE UNIQUE INDEX forecast_series_run_subcategory_unique_idx
  ON forecast_series (forecast_run_id, subcategory_id)
  WHERE target = 'subcategory_spending';

-- Forecast points store the actual plotted or summed values.
-- period_end is exclusive; daily points use period_end = period_start + 1.
CREATE TABLE forecast_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_series_id uuid NOT NULL REFERENCES forecast_series(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,

  predicted_amount_centavos bigint NOT NULL,
  lower_amount_centavos bigint,
  upper_amount_centavos bigint,

  -- Filled later for forecast-vs-actual reporting and model evaluation.
  actual_amount_centavos bigint,

  CONSTRAINT forecast_points_period_chk
    CHECK (period_start < period_end),
  CONSTRAINT forecast_points_amounts_nonnegative_chk
    CHECK (
      predicted_amount_centavos >= 0
      AND (lower_amount_centavos IS NULL OR lower_amount_centavos >= 0)
      AND (upper_amount_centavos IS NULL OR upper_amount_centavos >= 0)
      AND (actual_amount_centavos IS NULL OR actual_amount_centavos >= 0)
    ),
  CONSTRAINT forecast_points_range_chk
    CHECK (
      (lower_amount_centavos IS NULL OR lower_amount_centavos <= predicted_amount_centavos)
      AND (upper_amount_centavos IS NULL OR predicted_amount_centavos <= upper_amount_centavos)
    )
);

CREATE UNIQUE INDEX forecast_points_series_period_unique_idx
  ON forecast_points (forecast_series_id, period_start, period_end);

CREATE INDEX forecast_points_period_idx
  ON forecast_points (period_start, period_end);

-- Optional detailed drivers behind a forecast explanation.
CREATE TABLE forecast_explanation_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_series_id uuid NOT NULL REFERENCES forecast_series(id) ON DELETE CASCADE,
  driver_key text NOT NULL,
  driver_label text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('increased', 'decreased', 'neutral')),
  impact_amount_centavos bigint,
  explanation text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX forecast_explanation_drivers_series_idx
  ON forecast_explanation_drivers (forecast_series_id, sort_order);

-- A budget recommendation is an immutable generated proposal.
-- If the user modifies it, keep the original recommended amounts and store
-- adjusted amounts in budget_recommendation_allocations.
CREATE TABLE budget_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  forecast_run_id uuid REFERENCES forecast_runs(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  presented_at timestamptz,
  acted_at timestamptz,
  status odin_recommendation_status NOT NULL DEFAULT 'draft',

  period_start date NOT NULL,
  period_end date NOT NULL,
  budget_period_days integer NOT NULL,
  strategy odin_budget_strategy NOT NULL,

  profile_label odin_financial_profile_label NOT NULL,
  current_balance_centavos bigint NOT NULL,
  forecast_income_centavos bigint NOT NULL,
  target_savings_rate_bps integer NOT NULL DEFAULT 1000,
  target_savings_centavos bigint NOT NULL DEFAULT 0,
  recommended_total_centavos bigint NOT NULL,
  surplus_handling odin_surplus_handling NOT NULL DEFAULT 'no_action',
  deficit_handling odin_deficit_handling NOT NULL DEFAULT 'warn_only',
  deficit_warning_text text,

  solver_status text NOT NULL DEFAULT 'not_run',
  explanation_summary text NOT NULL,
  optimization_explanation text,

  -- Set when an accepted recommendation is copied into the budgets table.
  accepted_budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL,

  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  solver_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT budget_recommendations_period_chk
    CHECK (period_start < period_end),
  CONSTRAINT budget_recommendations_budget_period_days_chk
    CHECK (
      budget_period_days BETWEEN 7 AND 90
      AND budget_period_days = period_end - period_start
    ),
  CONSTRAINT budget_recommendations_money_chk
    CHECK (
      forecast_income_centavos >= 0
      AND target_savings_centavos >= 0
      AND recommended_total_centavos >= 0
    ),
  CONSTRAINT budget_recommendations_savings_rate_chk
    CHECK (target_savings_rate_bps >= 0 AND target_savings_rate_bps <= 10000),
  CONSTRAINT budget_recommendations_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX budget_recommendations_user_created_idx
  ON budget_recommendations (user_id, created_at DESC);

CREATE INDEX budget_recommendations_user_status_idx
  ON budget_recommendations (user_id, status);

CREATE INDEX budget_recommendations_forecast_run_idx
  ON budget_recommendations (forecast_run_id);


-- Allocation rows hold the money recommended for each category or
-- detailed subcategory. Subcategory rows should include subcategory_id.
CREATE TABLE budget_recommendation_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES budget_recommendations(id) ON DELETE CASCADE,

  allocation_scope odin_allocation_scope NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,

  recommended_amount_centavos bigint NOT NULL,
  adjusted_amount_centavos bigint,
  accepted_amount_centavos bigint,

  forecast_amount_centavos bigint,
  min_amount_centavos bigint,
  max_amount_centavos bigint,
  historical_p90_amount_centavos bigint,

  priority_weight integer CHECK (priority_weight BETWEEN 1 AND 5),
  is_protected boolean NOT NULL DEFAULT false,
  explanation text,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT budget_recommendation_allocations_scope_chk
    CHECK (
      (allocation_scope = 'category' AND subcategory_id IS NULL)
      OR (allocation_scope = 'subcategory' AND subcategory_id IS NOT NULL)
    ),
  CONSTRAINT budget_recommendation_allocations_money_chk
    CHECK (
      recommended_amount_centavos >= 0
      AND (adjusted_amount_centavos IS NULL OR adjusted_amount_centavos >= 0)
      AND (accepted_amount_centavos IS NULL OR accepted_amount_centavos >= 0)
      AND (forecast_amount_centavos IS NULL OR forecast_amount_centavos >= 0)
      AND (min_amount_centavos IS NULL OR min_amount_centavos >= 0)
      AND (max_amount_centavos IS NULL OR max_amount_centavos >= 0)
      AND (historical_p90_amount_centavos IS NULL OR historical_p90_amount_centavos >= 0)
    ),
  CONSTRAINT budget_recommendation_allocations_min_max_chk
    CHECK (
      min_amount_centavos IS NULL
      OR max_amount_centavos IS NULL
      OR min_amount_centavos <= max_amount_centavos
    )
);

CREATE UNIQUE INDEX budget_recommendation_allocations_category_unique_idx
  ON budget_recommendation_allocations (recommendation_id, category_id)
  WHERE allocation_scope = 'category';

CREATE UNIQUE INDEX budget_recommendation_allocations_subcategory_unique_idx
  ON budget_recommendation_allocations (recommendation_id, subcategory_id)
  WHERE allocation_scope = 'subcategory';

CREATE INDEX budget_recommendation_allocations_recommendation_idx
  ON budget_recommendation_allocations (recommendation_id, sort_order);

CREATE TABLE savings_goal_recommendation_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES budget_recommendations(id) ON DELETE CASCADE,
  recommendation_allocation_id uuid REFERENCES budget_recommendation_allocations(id) ON DELETE SET NULL,
  savings_goal_id uuid NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  allocation_strategy odin_savings_allocation_strategy NOT NULL,
  recommended_amount_centavos bigint NOT NULL,
  adjusted_amount_centavos bigint,
  accepted_amount_centavos bigint,
  remaining_amount_snapshot_centavos bigint NOT NULL,
  allocation_order integer NOT NULL,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goal_recommendation_allocations_money_chk
    CHECK (
      recommended_amount_centavos >= 0
      AND (adjusted_amount_centavos IS NULL OR adjusted_amount_centavos >= 0)
      AND (accepted_amount_centavos IS NULL OR accepted_amount_centavos >= 0)
      AND remaining_amount_snapshot_centavos >= 0
    ),
  CONSTRAINT savings_goal_recommendation_allocations_order_chk
    CHECK (allocation_order > 0),
  UNIQUE (recommendation_id, savings_goal_id)
);

CREATE INDEX savings_goal_recommendation_allocations_goal_idx
  ON savings_goal_recommendation_allocations (savings_goal_id);

CREATE INDEX savings_goal_recommendation_allocations_recommendation_idx
  ON savings_goal_recommendation_allocations (recommendation_id, allocation_order);

-- Constraints explain why the recommendation has its shape.
-- Examples: essentials floor, discretionary cap, obligatory minimum,
-- financial allocation minimum, category maximum, protected category floor.
CREATE TABLE budget_recommendation_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES budget_recommendations(id) ON DELETE CASCADE,
  constraint_type odin_budget_constraint_type NOT NULL,

  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT,

  min_amount_centavos bigint,
  max_amount_centavos bigint,
  percent_bps integer,

  is_hard boolean NOT NULL DEFAULT true,
  was_relaxed boolean NOT NULL DEFAULT false,
  relaxation_step integer,
  explanation text NOT NULL,

  CONSTRAINT budget_recommendation_constraints_money_chk
    CHECK (
      (min_amount_centavos IS NULL OR min_amount_centavos >= 0)
      AND (max_amount_centavos IS NULL OR max_amount_centavos >= 0)
      AND (percent_bps IS NULL OR percent_bps BETWEEN 0 AND 10000)
    ),
  CONSTRAINT budget_recommendation_constraints_min_max_chk
    CHECK (
      min_amount_centavos IS NULL
      OR max_amount_centavos IS NULL
      OR min_amount_centavos <= max_amount_centavos
    ),
  CONSTRAINT budget_recommendation_constraints_relaxation_step_chk
    CHECK (relaxation_step IS NULL OR relaxation_step BETWEEN 1 AND 4)
);

CREATE INDEX budget_recommendation_constraints_recommendation_idx
  ON budget_recommendation_constraints (recommendation_id);

-- Action log for accept, modify, and reject behavior.
CREATE TABLE budget_recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES budget_recommendations(id) ON DELETE CASCADE,
  action odin_recommendation_action NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX budget_recommendation_events_recommendation_idx
  ON budget_recommendation_events (recommendation_id, created_at);

-- Anomaly evaluations are stored even when no user alert is shown.
-- This lets the team evaluate Isolation Forest behavior, suppression rules,
-- and false-positive feedback without deleting or mutating transactions.
CREATE TABLE anomaly_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

  evaluated_at timestamptz NOT NULL DEFAULT now(),
  model_version text,
  profile_label odin_financial_profile_label NOT NULL,
  history_days integer NOT NULL DEFAULT 0,

  merchant_name text,
  subcategory_id uuid NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  amount_centavos bigint NOT NULL,

  raw_anomaly_score numeric(12, 8),
  threshold_score numeric(12, 8),
  score_percentile numeric(6, 3),
  is_anomaly boolean NOT NULL DEFAULT false,
  should_alert_user boolean NOT NULL DEFAULT false,
  review_status odin_anomaly_review_status NOT NULL DEFAULT 'not_alerted',

  suppression_reason odin_anomaly_suppression_reason,
  suppression_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_vector jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  top_driver_key odin_anomaly_feature_key,
  explanation text,
  failure_reason text,

  CONSTRAINT anomaly_evaluations_history_days_chk
    CHECK (history_days >= 0),
  CONSTRAINT anomaly_evaluations_amount_chk
    CHECK (amount_centavos >= 0),
  CONSTRAINT anomaly_evaluations_score_percentile_chk
    CHECK (score_percentile IS NULL OR score_percentile BETWEEN 0 AND 100),
  CONSTRAINT anomaly_evaluations_alert_review_chk
    CHECK (
      (should_alert_user = true AND review_status IN ('pending_review', 'expected', 'unexpected', 'remind_later'))
      OR (should_alert_user = false)
    ),
  CONSTRAINT anomaly_evaluations_suppression_chk
    CHECK (
      (should_alert_user = false)
      OR (suppression_reason IS NULL)
    ),
  CONSTRAINT anomaly_evaluations_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX anomaly_evaluations_user_evaluated_idx
  ON anomaly_evaluations (user_id, evaluated_at DESC);

CREATE INDEX anomaly_evaluations_transaction_idx
  ON anomaly_evaluations (transaction_id, evaluated_at DESC);

CREATE INDEX anomaly_evaluations_pending_review_idx
  ON anomaly_evaluations (user_id, review_status)
  WHERE review_status = 'pending_review';

CREATE INDEX anomaly_evaluations_anomalies_idx
  ON anomaly_evaluations (user_id, is_anomaly, should_alert_user, evaluated_at DESC);


-- Feature rows make the anomaly explanation auditable. The JSON snapshot on
-- anomaly_evaluations is convenient for replay; these rows are convenient for
-- reporting and selecting the largest standardized deviation.
CREATE TABLE anomaly_evaluation_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_evaluation_id uuid NOT NULL REFERENCES anomaly_evaluations(id) ON DELETE CASCADE,
  feature_key odin_anomaly_feature_key NOT NULL,
  raw_value numeric(18, 6),
  normalized_value numeric(18, 6),
  baseline_value numeric(18, 6),
  deviation_value numeric(18, 6),
  is_top_driver boolean NOT NULL DEFAULT false,
  explanation text,

  UNIQUE (anomaly_evaluation_id, feature_key)
);

CREATE INDEX anomaly_evaluation_features_driver_idx
  ON anomaly_evaluation_features (anomaly_evaluation_id, is_top_driver);

CREATE TABLE overspending_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL,
  budget_allocation_id uuid REFERENCES budget_allocations(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  actual_amount_centavos bigint NOT NULL,
  budgeted_amount_centavos bigint NOT NULL,
  overspent_amount_centavos bigint NOT NULL,
  overspent_percent_bps integer,
  threshold_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  should_alert_user boolean NOT NULL DEFAULT true,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT overspending_evaluations_amounts_chk
    CHECK (
      actual_amount_centavos >= 0
      AND budgeted_amount_centavos >= 0
      AND overspent_amount_centavos >= 0
      AND (overspent_percent_bps IS NULL OR overspent_percent_bps >= 0)
    ),
  CONSTRAINT overspending_evaluations_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX overspending_evaluations_user_evaluated_idx
  ON overspending_evaluations (user_id, evaluated_at DESC);


-- Central alert inbox. Anomaly alerts, budget overspending warnings,
-- forecast advisories, savings milestones, and debt alerts all land here.
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  category odin_alert_category NOT NULL,
  source_type odin_alert_source_type NOT NULL,
  severity odin_alert_severity NOT NULL,
  status odin_alert_status NOT NULL DEFAULT 'unread',

  title text NOT NULL,
  body text NOT NULL,
  explanation text,
  action_label text,
  route_name text,
  route_params jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Optional source pointers into app-owned domain tables.
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL,
  debt_account_id uuid REFERENCES debt_accounts(id) ON DELETE SET NULL,
  savings_goal_id uuid REFERENCES savings_goals(id) ON DELETE SET NULL,
  forecast_run_id uuid REFERENCES forecast_runs(id) ON DELETE SET NULL,
  budget_recommendation_id uuid REFERENCES budget_recommendations(id) ON DELETE SET NULL,
  anomaly_evaluation_id uuid REFERENCES anomaly_evaluations(id) ON DELETE CASCADE,
  overspending_evaluation_id uuid REFERENCES overspending_evaluations(id) ON DELETE CASCADE,

  duplicate_key text,
  bundle_key text,
  parent_alert_id uuid REFERENCES alerts(id) ON DELETE SET NULL,

  triggered_at timestamptz NOT NULL DEFAULT now(),
  delivered_in_app_at timestamptz,
  delivered_push_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  cleared_at timestamptz,
  expires_at timestamptz,
  remind_at timestamptz,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT alerts_category_source_chk
    CHECK (
      (category = 'anomaly_detection' AND source_type = 'isolation_forest')
      OR (category = 'budget_overspending' AND source_type = 'budget_overspending_rule')
      OR (category = 'forecast_advisory' AND source_type = 'forecast_advisory_rule')
      OR (category = 'savings_milestone' AND source_type = 'savings_goal_rule')
      OR (category = 'debt_management' AND source_type = 'debt_rule')
      OR source_type = 'system'
    ),
  CONSTRAINT alerts_anomaly_source_chk
    CHECK (
      category <> 'anomaly_detection'
      OR anomaly_evaluation_id IS NOT NULL
    ),
  CONSTRAINT alerts_budget_overspending_source_chk
    CHECK (
      category <> 'budget_overspending'
      OR overspending_evaluation_id IS NOT NULL
    ),
  CONSTRAINT alerts_status_timestamps_chk
    CHECK (
      (status <> 'read' OR read_at IS NOT NULL)
      AND (status <> 'acknowledged' OR acknowledged_at IS NOT NULL)
      AND (status <> 'dismissed' OR dismissed_at IS NOT NULL)
      AND (status <> 'cleared' OR cleared_at IS NOT NULL)
    ),
  CONSTRAINT alerts_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX alerts_user_status_idx
  ON alerts (user_id, status, triggered_at DESC);

CREATE INDEX alerts_user_category_idx
  ON alerts (user_id, category, triggered_at DESC);

CREATE INDEX alerts_duplicate_key_idx
  ON alerts (user_id, duplicate_key, triggered_at DESC)
  WHERE duplicate_key IS NOT NULL;

CREATE INDEX alerts_bundle_key_idx
  ON alerts (user_id, bundle_key, triggered_at DESC)
  WHERE bundle_key IS NOT NULL;

CREATE INDEX alerts_anomaly_evaluation_idx
  ON alerts (anomaly_evaluation_id)
  WHERE anomaly_evaluation_id IS NOT NULL;

CREATE INDEX alerts_overspending_evaluation_idx
  ON alerts (overspending_evaluation_id)
  WHERE overspending_evaluation_id IS NOT NULL;


-- A single inbox alert can point at several transactions or subcategories,
-- especially when anomalies are bundled within the two-hour bundling window.
CREATE TABLE alert_related_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (
    entity_type IN (
      'transaction',
      'subcategory',
      'budget',
      'forecast_run',
      'budget_recommendation',
      'savings_goal',
      'debt_account',
      'anomaly_evaluation',
      'overspending_evaluation'
    )
  ),
  entity_id uuid NOT NULL,
  label text,
  amount_centavos bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT alert_related_entities_amount_chk
    CHECK (amount_centavos IS NULL OR amount_centavos >= 0)
);

CREATE INDEX alert_related_entities_alert_idx
  ON alert_related_entities (alert_id, sort_order);

CREATE INDEX alert_related_entities_entity_idx
  ON alert_related_entities (entity_type, entity_id);

-- Alert event log for user actions and delivery attempts.
CREATE TABLE alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  action odin_alert_event_action NOT NULL,
  actor_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX alert_events_alert_created_idx
  ON alert_events (alert_id, created_at);

-- User notification preferences. Budget overspending remains mandatory:
-- it must be stored and shown in-app, though push can be configured.
CREATE TABLE alert_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  category odin_alert_category NOT NULL,
  mode odin_alert_preference_mode NOT NULL DEFAULT 'enabled',
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  duplicate_cooldown_hours integer NOT NULL DEFAULT 24,
  snoozed_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT alert_notification_preferences_cooldown_chk
    CHECK (duplicate_cooldown_hours BETWEEN 1 AND 24),
  CONSTRAINT alert_notification_preferences_budget_mandatory_chk
    CHECK (
      category <> 'budget_overspending'
      OR (mode <> 'disabled' AND in_app_enabled = true)
    ),
  UNIQUE (user_id, category)
);

CREATE INDEX alert_notification_preferences_user_idx
  ON alert_notification_preferences (user_id);

-- Whitelist rules suppress future anomaly alerts for expected transactions.
-- They are reversible through status changes rather than deletion.
CREATE TABLE anomaly_whitelist_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_from_alert_id uuid REFERENCES alerts(id) ON DELETE SET NULL,
  created_from_anomaly_evaluation_id uuid REFERENCES anomaly_evaluations(id) ON DELETE SET NULL,

  merchant_name text NOT NULL,
  subcategory_id uuid NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  base_amount_centavos bigint,
  tolerance_bps integer,
  allow_any_amount boolean NOT NULL DEFAULT false,

  status odin_suppression_rule_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  deleted_at timestamptz,
  notes text,

  CONSTRAINT anomaly_whitelist_rules_amount_chk
    CHECK (base_amount_centavos IS NULL OR base_amount_centavos >= 0),
  CONSTRAINT anomaly_whitelist_rules_tolerance_chk
    CHECK (
      (allow_any_amount = true AND tolerance_bps IS NULL)
      OR (
        allow_any_amount = false
        AND base_amount_centavos IS NOT NULL
        AND tolerance_bps BETWEEN 0 AND 10000
      )
    )
);

CREATE UNIQUE INDEX anomaly_whitelist_rules_active_unique_idx
  ON anomaly_whitelist_rules (user_id, lower(merchant_name), subcategory_id)
  WHERE status = 'active';

CREATE INDEX anomaly_whitelist_rules_user_status_idx
  ON anomaly_whitelist_rules (user_id, status);

-- General reversible suppression rules cover snoozes and future cases where
-- the user suppresses repeated similar alerts without creating a merchant
-- whitelist rule.
CREATE TABLE alert_suppression_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  category odin_alert_category NOT NULL,
  source_type odin_alert_source_type,
  status odin_suppression_rule_status NOT NULL DEFAULT 'active',

  created_from_alert_id uuid REFERENCES alerts(id) ON DELETE SET NULL,
  merchant_name text,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  amount_center_centavos bigint,
  amount_tolerance_bps integer,

  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  deleted_at timestamptz,

  CONSTRAINT alert_suppression_rules_amount_chk
    CHECK (
      amount_center_centavos IS NULL
      OR amount_center_centavos >= 0
    ),
  CONSTRAINT alert_suppression_rules_tolerance_chk
    CHECK (
      amount_tolerance_bps IS NULL
      OR amount_tolerance_bps BETWEEN 0 AND 10000
    ),
  CONSTRAINT alert_suppression_rules_period_chk
    CHECK (ends_at IS NULL OR starts_at < ends_at)
);

CREATE INDEX alert_suppression_rules_user_active_idx
  ON alert_suppression_rules (user_id, category, status, starts_at, ends_at);

-- ============================================================================
-- Debt Hardship
-- ============================================================================

CREATE TABLE debt_hardship_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  debt_account_id uuid NOT NULL REFERENCES debt_accounts(id) ON DELETE CASCADE,
  status odin_debt_hardship_status NOT NULL DEFAULT 'draft',
  hardship_reason text NOT NULL,
  original_payment_centavos bigint NOT NULL,
  reduced_payment_centavos bigint,
  deferred_months integer,
  deferment_end_date date,
  lender_contacted_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT debt_hardship_plans_money_chk
    CHECK (original_payment_centavos >= 0 AND (reduced_payment_centavos IS NULL OR reduced_payment_centavos >= 0)),
  CONSTRAINT debt_hardship_plans_deferred_months_chk
    CHECK (deferred_months IS NULL OR deferred_months > 0),
  CONSTRAINT debt_hardship_plans_deferment_end_chk
    CHECK (deferment_end_date IS NULL OR requested_at::date <= deferment_end_date),
  CONSTRAINT debt_hardship_plans_status_timestamps_chk
    CHECK (
      (status <> 'active' OR activated_at IS NOT NULL)
      AND (status <> 'resolved' OR resolved_at IS NOT NULL)
      AND (status <> 'cancelled' OR cancelled_at IS NOT NULL)
      AND (status <> 'archived' OR archived_at IS NOT NULL)
    ),
  CONSTRAINT debt_hardship_plans_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX debt_hardship_plans_user_status_idx
  ON debt_hardship_plans (user_id, status);


CREATE TABLE debt_hardship_plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hardship_plan_id uuid NOT NULL REFERENCES debt_hardship_plans(id) ON DELETE CASCADE,
  action odin_debt_hardship_action NOT NULL,
  actor_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX debt_hardship_plan_events_plan_idx
  ON debt_hardship_plan_events (hardship_plan_id, created_at);

-- ============================================================================
-- Push Notification Device Tokens
-- ============================================================================

CREATE TABLE push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  device_token text NOT NULL,
  platform odin_push_device_platform NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (user_id, device_token),
  CONSTRAINT push_device_tokens_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX push_device_tokens_user_active_idx
  ON push_device_tokens (user_id, is_active);


-- ============================================================================
-- Help & Problem Reporting
-- ============================================================================

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  category odin_support_ticket_category NOT NULL,
  status odin_support_ticket_status NOT NULL DEFAULT 'open',
  subject text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT support_tickets_resolved_chk
    CHECK (status <> 'resolved' OR resolved_at IS NOT NULL),
  CONSTRAINT support_tickets_closed_chk
    CHECK (status <> 'closed' OR closed_at IS NOT NULL),
  CONSTRAINT support_tickets_id_user_uq UNIQUE (id, user_id)
);

CREATE INDEX support_tickets_user_status_idx
  ON support_tickets (user_id, status, created_at DESC);


CREATE TABLE support_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  action odin_support_ticket_event_action NOT NULL,
  actor_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX support_ticket_events_ticket_idx
  ON support_ticket_events (ticket_id, created_at);

CREATE TABLE support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  content_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT support_ticket_attachments_size_chk
    CHECK (size_bytes IS NULL OR size_bytes >= 0),
  UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX support_ticket_attachments_ticket_idx
  ON support_ticket_attachments (ticket_id, created_at);

ALTER TABLE budgets
  ADD CONSTRAINT budgets_source_recommendation_fk
  FOREIGN KEY (source_recommendation_id, user_id)
  REFERENCES budget_recommendations(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_forecast_run_fk
  FOREIGN KEY (forecast_run_id, user_id)
  REFERENCES forecast_runs(id, user_id)
  ON DELETE SET NULL;

CREATE TABLE report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  kind odin_report_kind NOT NULL,
  status odin_report_status NOT NULL DEFAULT 'queued',
  period_start date NOT NULL,
  period_end date NOT NULL,
  generated_at timestamptz,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_runs_period_chk
    CHECK (period_start < period_end),
  CONSTRAINT report_runs_available_chk
    CHECK (status <> 'available' OR generated_at IS NOT NULL)
);

CREATE INDEX report_runs_user_period_idx
  ON report_runs (user_id, period_start DESC, period_end DESC);

CREATE TABLE report_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  metric_label text NOT NULL,
  amount_centavos bigint,
  numeric_value numeric(18, 6),
  unit text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_metrics_value_chk
    CHECK (amount_centavos IS NOT NULL OR numeric_value IS NOT NULL),
  UNIQUE (report_run_id, metric_key)
);

CREATE TABLE report_category_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  actual_amount_centavos bigint NOT NULL DEFAULT 0,
  budgeted_amount_centavos bigint,
  forecasted_amount_centavos bigint,
  transaction_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_category_breakdowns_money_chk
    CHECK (
      actual_amount_centavos >= 0
      AND (budgeted_amount_centavos IS NULL OR budgeted_amount_centavos >= 0)
      AND (forecasted_amount_centavos IS NULL OR forecasted_amount_centavos >= 0)
      AND transaction_count >= 0
    )
);

CREATE INDEX report_category_breakdowns_report_idx
  ON report_category_breakdowns (report_run_id, category_id, subcategory_id);

CREATE TABLE report_budget_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL,
  budget_allocation_id uuid REFERENCES budget_allocations(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  allocated_amount_centavos bigint NOT NULL DEFAULT 0,
  actual_amount_centavos bigint NOT NULL DEFAULT 0,
  variance_amount_centavos bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_budget_comparisons_money_chk
    CHECK (allocated_amount_centavos >= 0 AND actual_amount_centavos >= 0)
);

CREATE INDEX report_budget_comparisons_report_idx
  ON report_budget_comparisons (report_run_id, budget_id);

CREATE TABLE report_forecast_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  forecast_run_id uuid REFERENCES forecast_runs(id) ON DELETE SET NULL,
  forecast_series_id uuid REFERENCES forecast_series(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  predicted_amount_centavos bigint NOT NULL DEFAULT 0,
  actual_amount_centavos bigint NOT NULL DEFAULT 0,
  absolute_error_centavos bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_forecast_comparisons_money_chk
    CHECK (
      predicted_amount_centavos >= 0
      AND actual_amount_centavos >= 0
      AND absolute_error_centavos >= 0
    )
);

CREATE INDEX report_forecast_comparisons_report_idx
  ON report_forecast_comparisons (report_run_id, forecast_run_id);

CREATE TABLE report_savings_goal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  savings_goal_id uuid REFERENCES savings_goals(id) ON DELETE SET NULL,
  target_amount_centavos bigint NOT NULL,
  current_amount_centavos bigint NOT NULL,
  progress_state odin_goal_progress_state NOT NULL,
  projected_completion_date date,

  CONSTRAINT report_savings_goal_snapshots_money_chk
    CHECK (target_amount_centavos >= 0 AND current_amount_centavos >= 0)
);

CREATE TABLE report_debt_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  debt_account_id uuid REFERENCES debt_accounts(id) ON DELETE SET NULL,
  current_balance_centavos bigint NOT NULL,
  minimum_payment_centavos bigint NOT NULL,
  projected_payoff_date date,
  strategy odin_debt_strategy,

  CONSTRAINT report_debt_account_snapshots_money_chk
    CHECK (current_balance_centavos >= 0 AND minimum_payment_centavos >= 0)
);

-- Ownership-preserving foreign keys. These constraints prevent a user-owned row
-- from pointing at another user's account, transaction, forecast, alert, or
-- other owned record while keeping the single-column FKs useful for simple joins.
ALTER TABLE financial_profile_assessments
  ADD CONSTRAINT financial_profile_assessments_onboarding_owner_fk
  FOREIGN KEY (onboarding_session_id, user_id)
  REFERENCES onboarding_sessions(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE financial_profile_assignments
  ADD CONSTRAINT financial_profile_assignments_assessment_owner_fk
  FOREIGN KEY (assessment_id, user_id)
  REFERENCES financial_profile_assessments(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE financial_profile_events
  ADD CONSTRAINT financial_profile_events_assessment_owner_fk
  FOREIGN KEY (assessment_id, user_id)
  REFERENCES financial_profile_assessments(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE financial_profile_events
  ADD CONSTRAINT financial_profile_events_assignment_owner_fk
  FOREIGN KEY (assignment_id, user_id)
  REFERENCES financial_profile_assignments(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE recurring_transaction_templates
  ADD CONSTRAINT recurring_transaction_templates_source_account_owner_fk
  FOREIGN KEY (source_account_id, user_id)
  REFERENCES financial_accounts(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE recurring_transaction_templates
  ADD CONSTRAINT recurring_transaction_templates_destination_account_owner_fk
  FOREIGN KEY (destination_account_id, user_id)
  REFERENCES financial_accounts(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE financial_obligations
  ADD CONSTRAINT financial_obligations_template_owner_fk
  FOREIGN KEY (recurring_template_id, user_id)
  REFERENCES recurring_transaction_templates(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_account_owner_fk
  FOREIGN KEY (source_account_id, user_id)
  REFERENCES financial_accounts(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_destination_account_owner_fk
  FOREIGN KEY (destination_account_id, user_id)
  REFERENCES financial_accounts(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_recurring_template_owner_fk
  FOREIGN KEY (recurring_template_id, user_id)
  REFERENCES recurring_transaction_templates(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE transaction_events
  ADD CONSTRAINT transaction_events_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE transaction_drafts
  ADD CONSTRAINT transaction_drafts_synced_transaction_owner_fk
  FOREIGN KEY (synced_transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE recurring_transaction_occurrences
  ADD CONSTRAINT recurring_transaction_occurrences_template_owner_fk
  FOREIGN KEY (recurring_template_id, user_id)
  REFERENCES recurring_transaction_templates(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE recurring_transaction_occurrences
  ADD CONSTRAINT recurring_transaction_occurrences_generated_tx_owner_fk
  FOREIGN KEY (generated_transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE savings_goals
  ADD CONSTRAINT savings_goals_linked_account_owner_fk
  FOREIGN KEY (linked_account_id, user_id)
  REFERENCES financial_accounts(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE savings_goal_contributions
  ADD CONSTRAINT savings_goal_contributions_goal_owner_fk
  FOREIGN KEY (savings_goal_id, user_id)
  REFERENCES savings_goals(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE savings_goal_contributions
  ADD CONSTRAINT savings_goal_contributions_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE debt_accounts
  ADD CONSTRAINT debt_accounts_linked_account_owner_fk
  FOREIGN KEY (linked_account_id, user_id)
  REFERENCES financial_accounts(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE debt_payments
  ADD CONSTRAINT debt_payments_account_owner_fk
  FOREIGN KEY (debt_account_id, user_id)
  REFERENCES debt_accounts(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE debt_payments
  ADD CONSTRAINT debt_payments_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE budget_recommendations
  ADD CONSTRAINT budget_recommendations_forecast_run_owner_fk
  FOREIGN KEY (forecast_run_id, user_id)
  REFERENCES forecast_runs(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE anomaly_evaluations
  ADD CONSTRAINT anomaly_evaluations_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_budget_owner_fk
  FOREIGN KEY (budget_id, user_id)
  REFERENCES budgets(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_debt_account_owner_fk
  FOREIGN KEY (debt_account_id, user_id)
  REFERENCES debt_accounts(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_savings_goal_owner_fk
  FOREIGN KEY (savings_goal_id, user_id)
  REFERENCES savings_goals(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_forecast_run_owner_fk
  FOREIGN KEY (forecast_run_id, user_id)
  REFERENCES forecast_runs(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_budget_recommendation_owner_fk
  FOREIGN KEY (budget_recommendation_id, user_id)
  REFERENCES budget_recommendations(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_anomaly_evaluation_owner_fk
  FOREIGN KEY (anomaly_evaluation_id, user_id)
  REFERENCES anomaly_evaluations(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_parent_owner_fk
  FOREIGN KEY (parent_alert_id, user_id)
  REFERENCES alerts(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE anomaly_whitelist_rules
  ADD CONSTRAINT anomaly_whitelist_rules_alert_owner_fk
  FOREIGN KEY (created_from_alert_id, user_id)
  REFERENCES alerts(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE anomaly_whitelist_rules
  ADD CONSTRAINT anomaly_whitelist_rules_evaluation_owner_fk
  FOREIGN KEY (created_from_anomaly_evaluation_id, user_id)
  REFERENCES anomaly_evaluations(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alert_suppression_rules
  ADD CONSTRAINT alert_suppression_rules_alert_owner_fk
  FOREIGN KEY (created_from_alert_id, user_id)
  REFERENCES alerts(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE debt_hardship_plans
  ADD CONSTRAINT debt_hardship_plans_account_owner_fk
  FOREIGN KEY (debt_account_id, user_id)
  REFERENCES debt_accounts(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE budget_strategy_rules
  ADD CONSTRAINT budget_strategy_rules_config_owner_fk
  FOREIGN KEY (strategy_config_id, user_id)
  REFERENCES budget_strategy_configs(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE savings_goal_contributions
  ADD CONSTRAINT savings_goal_contributions_budget_owner_fk
  FOREIGN KEY (source_budget_id, user_id)
  REFERENCES budgets(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE financial_profile_reclassification_schedules
  ADD CONSTRAINT financial_profile_reclassification_schedules_assessment_owner_fk
  FOREIGN KEY (last_assessment_id, user_id)
  REFERENCES financial_profile_assessments(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE transaction_retention_events
  ADD CONSTRAINT transaction_retention_events_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES transactions(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE budget_health_snapshots
  ADD CONSTRAINT budget_health_snapshots_budget_owner_fk
  FOREIGN KEY (budget_id, user_id)
  REFERENCES budgets(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE savings_goal_progress_snapshots
  ADD CONSTRAINT savings_goal_progress_snapshots_goal_owner_fk
  FOREIGN KEY (savings_goal_id, user_id)
  REFERENCES savings_goals(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE user_debt_priorities
  ADD CONSTRAINT user_debt_priorities_account_owner_fk
  FOREIGN KEY (debt_account_id, user_id)
  REFERENCES debt_accounts(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE overspending_evaluations
  ADD CONSTRAINT overspending_evaluations_budget_owner_fk
  FOREIGN KEY (budget_id, user_id)
  REFERENCES budgets(id, user_id)
  ON DELETE SET NULL;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_overspending_evaluation_owner_fk
  FOREIGN KEY (overspending_evaluation_id, user_id)
  REFERENCES overspending_evaluations(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE support_ticket_attachments
  ADD CONSTRAINT support_ticket_attachments_ticket_owner_fk
  FOREIGN KEY (ticket_id, user_id)
  REFERENCES support_tickets(id, user_id)
  ON DELETE CASCADE;

-- Row-level security. Authenticated clients can only access rows owned by
-- auth.uid(). System lookup tables are readable, but writes are left to service
-- role migrations/admin jobs.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_owner_access
  ON profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_privacy_settings_owner_access
  ON user_privacy_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_consents_owner_access
  ON user_consents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_export_requests_owner_access
  ON data_export_requests
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_deletion_requests_owner_access
  ON account_deletion_requests
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_sessions_owner_access
  ON onboarding_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_responses_owner_access
  ON onboarding_responses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM onboarding_sessions
      WHERE onboarding_sessions.id = onboarding_responses.onboarding_session_id
        AND onboarding_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM onboarding_sessions
      WHERE onboarding_sessions.id = onboarding_responses.onboarding_session_id
        AND onboarding_sessions.user_id = auth.uid()
    )
  );

ALTER TABLE financial_profile_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_profile_assessments_owner_access
  ON financial_profile_assessments
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE financial_profile_explanation_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_profile_explanation_drivers_owner_access
  ON financial_profile_explanation_drivers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM financial_profile_assessments
      WHERE financial_profile_assessments.id = financial_profile_explanation_drivers.assessment_id
        AND financial_profile_assessments.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM financial_profile_assessments
      WHERE financial_profile_assessments.id = financial_profile_explanation_drivers.assessment_id
        AND financial_profile_assessments.user_id = auth.uid()
    )
  );

ALTER TABLE financial_profile_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_profile_assignments_owner_access
  ON financial_profile_assignments
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE financial_profile_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_profile_events_owner_access
  ON financial_profile_events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE financial_profile_reclassification_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_profile_reclassification_schedules_owner_access
  ON financial_profile_reclassification_schedules
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE category_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_groups_read_authenticated
  ON category_groups
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_read_available
  ON categories
  FOR SELECT
  TO authenticated
  USING (is_system = true OR user_id = auth.uid());

CREATE POLICY categories_user_insert
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (is_system = false AND user_id = auth.uid());

CREATE POLICY categories_user_update
  ON categories
  FOR UPDATE
  TO authenticated
  USING (is_system = false AND user_id = auth.uid())
  WITH CHECK (is_system = false AND user_id = auth.uid());

CREATE POLICY categories_user_delete
  ON categories
  FOR DELETE
  TO authenticated
  USING (is_system = false AND user_id = auth.uid());

ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY subcategories_read_available
  ON subcategories
  FOR SELECT
  TO authenticated
  USING (is_system = true OR user_id = auth.uid());

CREATE POLICY subcategories_user_insert
  ON subcategories
  FOR INSERT
  TO authenticated
  WITH CHECK (is_system = false AND user_id = auth.uid());

CREATE POLICY subcategories_user_update
  ON subcategories
  FOR UPDATE
  TO authenticated
  USING (is_system = false AND user_id = auth.uid())
  WITH CHECK (is_system = false AND user_id = auth.uid());

CREATE POLICY subcategories_user_delete
  ON subcategories
  FOR DELETE
  TO authenticated
  USING (is_system = false AND user_id = auth.uid());

ALTER TABLE user_category_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_category_restrictions_owner_access
  ON user_category_restrictions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY income_sources_owner_access
  ON income_sources
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_accounts_owner_access
  ON financial_accounts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE recurring_transaction_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY recurring_transaction_templates_owner_access
  ON recurring_transaction_templates
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE financial_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_obligations_owner_access
  ON financial_obligations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_owner_access
  ON transactions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE transaction_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_events_owner_access
  ON transaction_events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE transaction_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_drafts_owner_access
  ON transaction_drafts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE user_transaction_retention_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_transaction_retention_settings_owner_access
  ON user_transaction_retention_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE transaction_retention_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_retention_events_owner_access
  ON transaction_retention_events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE recurring_transaction_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY recurring_transaction_occurrences_owner_access
  ON recurring_transaction_occurrences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE expected_spending_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY expected_spending_events_owner_access
  ON expected_spending_events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY budgets_owner_access
  ON budgets
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_allocations_owner_access
  ON budget_allocations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budgets
      WHERE budgets.id = budget_allocations.budget_id
        AND budgets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budgets
      WHERE budgets.id = budget_allocations.budget_id
        AND budgets.user_id = auth.uid()
    )
  );

ALTER TABLE budget_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_events_owner_access
  ON budget_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budgets
      WHERE budgets.id = budget_events.budget_id
        AND budgets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budgets
      WHERE budgets.id = budget_events.budget_id
        AND budgets.user_id = auth.uid()
    )
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
  );

ALTER TABLE budget_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_health_snapshots_owner_access
  ON budget_health_snapshots
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_goals_owner_access
  ON savings_goals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE savings_goal_allocation_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_goal_allocation_preferences_owner_access
  ON savings_goal_allocation_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE savings_goal_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_goal_contributions_owner_access
  ON savings_goal_contributions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE savings_goal_progress_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_goal_progress_snapshots_owner_access
  ON savings_goal_progress_snapshots
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE savings_goal_budget_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_goal_budget_allocations_owner_access
  ON savings_goal_budget_allocations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budget_allocations
      JOIN budgets ON budgets.id = budget_allocations.budget_id
      WHERE budget_allocations.id = savings_goal_budget_allocations.budget_allocation_id
        AND budgets.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM savings_goals
      WHERE savings_goals.id = savings_goal_budget_allocations.savings_goal_id
        AND savings_goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budget_allocations
      JOIN budgets ON budgets.id = budget_allocations.budget_id
      WHERE budget_allocations.id = savings_goal_budget_allocations.budget_allocation_id
        AND budgets.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM savings_goals
      WHERE savings_goals.id = savings_goal_budget_allocations.savings_goal_id
        AND savings_goals.user_id = auth.uid()
    )
  );

ALTER TABLE debt_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_accounts_owner_access
  ON debt_accounts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_payments_owner_access
  ON debt_payments
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE debt_strategy_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_strategy_preferences_owner_access
  ON debt_strategy_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE user_debt_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_debt_priorities_owner_access
  ON user_debt_priorities
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE debt_repayment_projection_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_repayment_projection_runs_owner_access
  ON debt_repayment_projection_runs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE debt_repayment_projection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_repayment_projection_items_owner_access
  ON debt_repayment_projection_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM debt_repayment_projection_runs
      WHERE debt_repayment_projection_runs.id = debt_repayment_projection_items.projection_run_id
        AND debt_repayment_projection_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM debt_repayment_projection_runs
      WHERE debt_repayment_projection_runs.id = debt_repayment_projection_items.projection_run_id
        AND debt_repayment_projection_runs.user_id = auth.uid()
    )
  );

ALTER TABLE debt_repayment_projection_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_repayment_projection_points_owner_access
  ON debt_repayment_projection_points
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM debt_repayment_projection_items
      JOIN debt_repayment_projection_runs
        ON debt_repayment_projection_runs.id = debt_repayment_projection_items.projection_run_id
      WHERE debt_repayment_projection_items.id = debt_repayment_projection_points.projection_item_id
        AND debt_repayment_projection_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM debt_repayment_projection_items
      JOIN debt_repayment_projection_runs
        ON debt_repayment_projection_runs.id = debt_repayment_projection_items.projection_run_id
      WHERE debt_repayment_projection_items.id = debt_repayment_projection_points.projection_item_id
        AND debt_repayment_projection_runs.user_id = auth.uid()
    )
  );

ALTER TABLE forecast_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY forecast_runs_owner_access
  ON forecast_runs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE forecast_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY forecast_series_owner_access
  ON forecast_series
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM forecast_runs
      WHERE forecast_runs.id = forecast_series.forecast_run_id
        AND forecast_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM forecast_runs
      WHERE forecast_runs.id = forecast_series.forecast_run_id
        AND forecast_runs.user_id = auth.uid()
    )
  );

ALTER TABLE forecast_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY forecast_points_owner_access
  ON forecast_points
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM forecast_series
      JOIN forecast_runs
        ON forecast_runs.id = forecast_series.forecast_run_id
      WHERE forecast_series.id = forecast_points.forecast_series_id
        AND forecast_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM forecast_series
      JOIN forecast_runs
        ON forecast_runs.id = forecast_series.forecast_run_id
      WHERE forecast_series.id = forecast_points.forecast_series_id
        AND forecast_runs.user_id = auth.uid()
    )
  );

ALTER TABLE forecast_explanation_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY forecast_explanation_drivers_owner_access
  ON forecast_explanation_drivers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM forecast_series
      JOIN forecast_runs
        ON forecast_runs.id = forecast_series.forecast_run_id
      WHERE forecast_series.id = forecast_explanation_drivers.forecast_series_id
        AND forecast_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM forecast_series
      JOIN forecast_runs
        ON forecast_runs.id = forecast_series.forecast_run_id
      WHERE forecast_series.id = forecast_explanation_drivers.forecast_series_id
        AND forecast_runs.user_id = auth.uid()
    )
  );

ALTER TABLE budget_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_recommendations_owner_access
  ON budget_recommendations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE budget_recommendation_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_recommendation_allocations_owner_access
  ON budget_recommendation_allocations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = budget_recommendation_allocations.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = budget_recommendation_allocations.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
  );

ALTER TABLE savings_goal_recommendation_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_goal_recommendation_allocations_owner_access
  ON savings_goal_recommendation_allocations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = savings_goal_recommendation_allocations.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM savings_goals
      WHERE savings_goals.id = savings_goal_recommendation_allocations.savings_goal_id
        AND savings_goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = savings_goal_recommendation_allocations.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM savings_goals
      WHERE savings_goals.id = savings_goal_recommendation_allocations.savings_goal_id
        AND savings_goals.user_id = auth.uid()
    )
  );

ALTER TABLE budget_recommendation_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_recommendation_constraints_owner_access
  ON budget_recommendation_constraints
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = budget_recommendation_constraints.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = budget_recommendation_constraints.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
  );

ALTER TABLE budget_recommendation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_recommendation_events_owner_access
  ON budget_recommendation_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = budget_recommendation_events.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budget_recommendations
      WHERE budget_recommendations.id = budget_recommendation_events.recommendation_id
        AND budget_recommendations.user_id = auth.uid()
    )
    AND actor_user_id = auth.uid()
  );

ALTER TABLE anomaly_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY anomaly_evaluations_owner_access
  ON anomaly_evaluations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE anomaly_evaluation_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY anomaly_evaluation_features_owner_access
  ON anomaly_evaluation_features
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM anomaly_evaluations
      WHERE anomaly_evaluations.id = anomaly_evaluation_features.anomaly_evaluation_id
        AND anomaly_evaluations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM anomaly_evaluations
      WHERE anomaly_evaluations.id = anomaly_evaluation_features.anomaly_evaluation_id
        AND anomaly_evaluations.user_id = auth.uid()
    )
  );

ALTER TABLE overspending_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY overspending_evaluations_owner_access
  ON overspending_evaluations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_owner_access
  ON alerts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE alert_related_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_related_entities_owner_access
  ON alert_related_entities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM alerts
      WHERE alerts.id = alert_related_entities.alert_id
        AND alerts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM alerts
      WHERE alerts.id = alert_related_entities.alert_id
        AND alerts.user_id = auth.uid()
    )
  );

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_events_owner_access
  ON alert_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM alerts
      WHERE alerts.id = alert_events.alert_id
        AND alerts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM alerts
      WHERE alerts.id = alert_events.alert_id
        AND alerts.user_id = auth.uid()
    )
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
  );

ALTER TABLE alert_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_notification_preferences_owner_access
  ON alert_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE anomaly_whitelist_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY anomaly_whitelist_rules_owner_access
  ON anomaly_whitelist_rules
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE alert_suppression_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_suppression_rules_owner_access
  ON alert_suppression_rules
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_runs_owner_access
  ON report_runs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE report_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_metrics_owner_access
  ON report_metrics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_metrics.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_metrics.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  );

ALTER TABLE report_category_breakdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_category_breakdowns_owner_access
  ON report_category_breakdowns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_category_breakdowns.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_category_breakdowns.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  );

ALTER TABLE report_budget_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_budget_comparisons_owner_access
  ON report_budget_comparisons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_budget_comparisons.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_budget_comparisons.report_run_id
        AND report_runs.user_id = auth.uid()
    )
    AND (
      budget_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM budgets
        WHERE budgets.id = report_budget_comparisons.budget_id
          AND budgets.user_id = auth.uid()
      )
    )
    AND (
      budget_allocation_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM budget_allocations
        JOIN budgets
          ON budgets.id = budget_allocations.budget_id
        WHERE budget_allocations.id = report_budget_comparisons.budget_allocation_id
          AND budgets.user_id = auth.uid()
      )
    )
  );

ALTER TABLE report_forecast_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_forecast_comparisons_owner_access
  ON report_forecast_comparisons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_forecast_comparisons.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_forecast_comparisons.report_run_id
        AND report_runs.user_id = auth.uid()
    )
    AND (
      forecast_run_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM forecast_runs
        WHERE forecast_runs.id = report_forecast_comparisons.forecast_run_id
          AND forecast_runs.user_id = auth.uid()
      )
    )
    AND (
      forecast_series_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM forecast_series
        JOIN forecast_runs
          ON forecast_runs.id = forecast_series.forecast_run_id
        WHERE forecast_series.id = report_forecast_comparisons.forecast_series_id
          AND forecast_runs.user_id = auth.uid()
      )
    )
  );

ALTER TABLE report_savings_goal_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_savings_goal_snapshots_owner_access
  ON report_savings_goal_snapshots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_savings_goal_snapshots.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_savings_goal_snapshots.report_run_id
        AND report_runs.user_id = auth.uid()
    )
    AND (
      savings_goal_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM savings_goals
        WHERE savings_goals.id = report_savings_goal_snapshots.savings_goal_id
          AND savings_goals.user_id = auth.uid()
      )
    )
  );

ALTER TABLE report_debt_account_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_debt_account_snapshots_owner_access
  ON report_debt_account_snapshots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_debt_account_snapshots.report_run_id
        AND report_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM report_runs
      WHERE report_runs.id = report_debt_account_snapshots.report_run_id
        AND report_runs.user_id = auth.uid()
    )
    AND (
      debt_account_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM debt_accounts
        WHERE debt_accounts.id = report_debt_account_snapshots.debt_account_id
          AND debt_accounts.user_id = auth.uid()
      )
    )
  );

ALTER TABLE user_eligibility_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_eligibility_profiles_owner_access
  ON user_eligibility_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE user_subcategory_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_subcategory_restrictions_owner_access
  ON user_subcategory_restrictions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE transaction_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_templates_owner_access
  ON transaction_templates
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE transaction_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_line_items_owner_access
  ON transaction_line_items
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE budget_strategy_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_strategy_configs_read
  ON budget_strategy_configs
  FOR SELECT
  TO authenticated
  USING (is_system = true OR user_id = auth.uid());

CREATE POLICY budget_strategy_configs_user_insert
  ON budget_strategy_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_system = false AND user_id = auth.uid());

CREATE POLICY budget_strategy_configs_user_update
  ON budget_strategy_configs
  FOR UPDATE
  TO authenticated
  USING (is_system = false AND user_id = auth.uid())
  WITH CHECK (is_system = false AND user_id = auth.uid());

CREATE POLICY budget_strategy_configs_user_delete
  ON budget_strategy_configs
  FOR DELETE
  TO authenticated
  USING (is_system = false AND user_id = auth.uid());

ALTER TABLE budget_strategy_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_strategy_rules_owner_access
  ON budget_strategy_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM budget_strategy_configs
      WHERE budget_strategy_configs.id = budget_strategy_rules.strategy_config_id
        AND (budget_strategy_configs.is_system = true OR budget_strategy_configs.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM budget_strategy_configs
      WHERE budget_strategy_configs.id = budget_strategy_rules.strategy_config_id
        AND budget_strategy_configs.is_system = false
        AND budget_strategy_configs.user_id = auth.uid()
    )
  );

ALTER TABLE debt_hardship_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_hardship_plans_owner_access
  ON debt_hardship_plans
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE debt_hardship_plan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY debt_hardship_plan_events_owner_access
  ON debt_hardship_plan_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM debt_hardship_plans
      WHERE debt_hardship_plans.id = debt_hardship_plan_events.hardship_plan_id
        AND debt_hardship_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM debt_hardship_plans
      WHERE debt_hardship_plans.id = debt_hardship_plan_events.hardship_plan_id
        AND debt_hardship_plans.user_id = auth.uid()
    )
  );

ALTER TABLE push_device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_device_tokens_owner_access
  ON push_device_tokens
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_tickets_owner_access
  ON support_tickets
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE support_ticket_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_ticket_events_owner_access
  ON support_ticket_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM support_tickets
      WHERE support_tickets.id = support_ticket_events.ticket_id
        AND support_tickets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM support_tickets
      WHERE support_tickets.id = support_ticket_events.ticket_id
        AND support_tickets.user_id = auth.uid()
    )
  );

ALTER TABLE support_ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_ticket_attachments_owner_access
  ON support_ticket_attachments
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE metro_manila_localities ENABLE ROW LEVEL SECURITY;
CREATE POLICY metro_manila_localities_read_authenticated
  ON metro_manila_localities
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-ticket-attachments', 'support-ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY support_ticket_attachments_storage_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY support_ticket_attachments_storage_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY support_ticket_attachments_storage_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'support-ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'support-ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY support_ticket_attachments_storage_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'support-ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
