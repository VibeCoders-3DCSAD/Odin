CREATE TABLE profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  birth_year integer,
  metro_manila_city text,
  occupation text,
  lifecycle_status odin_user_lifecycle_status NOT NULL DEFAULT 'active',
  onboarding_completed_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT profiles_birth_year_chk
    CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100),
  CONSTRAINT profiles_deleted_status_chk
    CHECK (lifecycle_status <> 'deleted' OR deleted_at IS NOT NULL),

  CONSTRAINT pk_profiles PRIMARY KEY (id),
  CONSTRAINT fk_profiles_user_id FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE user_privacy_settings (
  user_id uuid NOT NULL,
  personalization_enabled boolean NOT NULL DEFAULT true,
  model_training_opt_in boolean NOT NULL DEFAULT false,
  research_evaluation_opt_in boolean NOT NULL DEFAULT false,
  notifications_opt_in boolean NOT NULL DEFAULT false,
  data_retention_days integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT user_privacy_settings_retention_chk
    CHECK (data_retention_days IS NULL OR data_retention_days > 0),

  CONSTRAINT pk_user_privacy_settings PRIMARY KEY (user_id),
  CONSTRAINT fk_user_privacy_settings_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE user_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
    CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL),

  CONSTRAINT pk_user_consents PRIMARY KEY (id),
  CONSTRAINT fk_user_consents_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE data_export_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status odin_request_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  expires_at timestamptz,
  export_storage_path text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT data_export_requests_expiry_chk
    CHECK (expires_at IS NULL OR requested_at < expires_at),

  CONSTRAINT pk_data_export_requests PRIMARY KEY (id),
  CONSTRAINT fk_data_export_requests_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE account_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
    ),

  CONSTRAINT pk_account_deletion_requests PRIMARY KEY (id),
  CONSTRAINT fk_account_deletion_requests_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE onboarding_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status odin_onboarding_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  abandoned_at timestamptz,
  superseded_at timestamptz,
  current_step_key text,

  income_type odin_income_type,
  income_frequency odin_income_frequency,
  declared_monthly_income_centavos bigint,
  income_min_centavos bigint,
  income_max_centavos bigint,
  fixed_obligations_centavos bigint,
  has_dependents boolean,
  dependent_count integer,
  family_support_centavos bigint,
  obligation_load_bps integer,
  selected_budget_period_kind odin_budget_period_kind,

  raw_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT onboarding_sessions_money_chk
    CHECK (
      (declared_monthly_income_centavos IS NULL OR declared_monthly_income_centavos >= 0)
      AND (income_min_centavos IS NULL OR income_min_centavos >= 0)
      AND (income_max_centavos IS NULL OR income_max_centavos >= 0)
      AND (fixed_obligations_centavos IS NULL OR fixed_obligations_centavos >= 0)
      AND (family_support_centavos IS NULL OR family_support_centavos >= 0)
    ),
  CONSTRAINT onboarding_sessions_income_range_chk
    CHECK (
      income_min_centavos IS NULL
      OR income_max_centavos IS NULL
      OR income_min_centavos <= income_max_centavos
    ),
  CONSTRAINT onboarding_sessions_dependents_chk
    CHECK (dependent_count IS NULL OR dependent_count >= 0),
  CONSTRAINT onboarding_sessions_obligation_load_chk
    CHECK (obligation_load_bps IS NULL OR obligation_load_bps BETWEEN 0 AND 10000),
  CONSTRAINT onboarding_sessions_submit_chk
    CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),

  CONSTRAINT pk_onboarding_sessions PRIMARY KEY (id),
  CONSTRAINT fk_onboarding_sessions_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE onboarding_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  onboarding_session_id uuid NOT NULL,
  question_key text NOT NULL,
  answer jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (onboarding_session_id, question_key),

  CONSTRAINT pk_onboarding_responses PRIMARY KEY (id),
  CONSTRAINT fk_onboarding_responses_onboarding_session_id FOREIGN KEY (onboarding_session_id) REFERENCES onboarding_sessions (id) ON DELETE CASCADE
);

CREATE TABLE financial_profile_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  onboarding_session_id uuid,
  status odin_profile_assessment_status NOT NULL DEFAULT 'queued',
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

  CONSTRAINT pk_financial_profile_assessments PRIMARY KEY (id),
  CONSTRAINT fk_financial_profile_assessments_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_financial_profile_assessments_onboarding_session_id FOREIGN KEY (onboarding_session_id) REFERENCES onboarding_sessions (id) ON DELETE SET NULL
);

CREATE TABLE financial_profile_explanation_drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  driver_key text NOT NULL,
  driver_label text NOT NULL,
  value_text text,
  impact_label text,
  explanation text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT pk_financial_profile_explanation_drivers PRIMARY KEY (id),
  CONSTRAINT fk_financial_profile_explanation_drivers_assessment_id FOREIGN KEY (assessment_id) REFERENCES financial_profile_assessments (id) ON DELETE CASCADE
);

CREATE TABLE financial_profile_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_id uuid,
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

  CONSTRAINT pk_financial_profile_assignments PRIMARY KEY (id),
  CONSTRAINT fk_financial_profile_assignments_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_financial_profile_assignments_assessment_id FOREIGN KEY (assessment_id) REFERENCES financial_profile_assessments (id) ON DELETE SET NULL
);

CREATE TABLE financial_profile_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_id uuid,
  assignment_id uuid,
  action odin_profile_event_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT pk_financial_profile_events PRIMARY KEY (id),
  CONSTRAINT fk_financial_profile_events_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_financial_profile_events_assessment_id FOREIGN KEY (assessment_id) REFERENCES financial_profile_assessments (id) ON DELETE SET NULL,
  CONSTRAINT fk_financial_profile_events_assignment_id FOREIGN KEY (assignment_id) REFERENCES financial_profile_assignments (id) ON DELETE SET NULL
);

CREATE TABLE categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_category_id uuid,
  slug text NOT NULL UNIQUE,
  kind odin_category_kind NOT NULL DEFAULT 'expense',
  broad_group odin_broad_group,
  default_label text NOT NULL,
  short_label text,
  description text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  is_filipino_context boolean NOT NULL DEFAULT false,
  is_protected_default boolean NOT NULL DEFAULT false,
  allows_custom_label boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT categories_expense_group_chk
    CHECK (
      (kind = 'expense' AND broad_group IS NOT NULL)
      OR (kind <> 'expense' AND broad_group IS NULL)
    ),

  CONSTRAINT pk_categories PRIMARY KEY (id),
  CONSTRAINT fk_categories_parent_category_id FOREIGN KEY (parent_category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE category_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  alias text NOT NULL,
  locale text NOT NULL DEFAULT 'en-PH',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pk_category_aliases PRIMARY KEY (id),
  CONSTRAINT fk_category_aliases_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

CREATE TABLE user_category_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  custom_label text,
  is_protected boolean NOT NULL DEFAULT false,
  protection_source odin_category_protection_source NOT NULL DEFAULT 'user_selected',
  is_hidden boolean NOT NULL DEFAULT false,
  sort_order integer,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (user_id, category_id),

  CONSTRAINT pk_user_category_settings PRIMARY KEY (id),
  CONSTRAINT fk_user_category_settings_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_category_settings_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

CREATE TABLE income_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
    ),

  CONSTRAINT pk_income_sources PRIMARY KEY (id),
  CONSTRAINT fk_income_sources_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE financial_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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

  CONSTRAINT pk_financial_accounts PRIMARY KEY (id),
  CONSTRAINT fk_financial_accounts_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE recurring_transaction_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_type odin_transaction_type NOT NULL,
  status odin_recurring_template_status NOT NULL DEFAULT 'active',
  name text NOT NULL,
  amount_centavos bigint NOT NULL,
  category_id uuid,
  source_account_id uuid,
  destination_account_id uuid,
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
        AND category_id IS NOT NULL
      )
      OR (
        transaction_type = 'expense'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NULL
        AND category_id IS NOT NULL
      )
      OR (
        transaction_type = 'transfer'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NOT NULL
        AND source_account_id <> destination_account_id
        AND category_id IS NULL
      )
    ),

  CONSTRAINT pk_recurring_transaction_templates PRIMARY KEY (id),
  CONSTRAINT fk_recurring_transaction_templates_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_transaction_templates_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_recurring_transaction_templates_source_account_id FOREIGN KEY (source_account_id) REFERENCES financial_accounts (id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_transaction_templates_destination_account_id FOREIGN KEY (destination_account_id) REFERENCES financial_accounts (id) ON DELETE CASCADE
);

CREATE TABLE financial_obligations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  recurring_template_id uuid,
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
    CHECK (ends_on IS NULL OR starts_on IS NULL OR starts_on <= ends_on),

  CONSTRAINT pk_financial_obligations PRIMARY KEY (id),
  CONSTRAINT fk_financial_obligations_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_financial_obligations_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_financial_obligations_recurring_template_id FOREIGN KEY (recurring_template_id) REFERENCES recurring_transaction_templates (id) ON DELETE SET NULL
);

CREATE TABLE transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_type odin_transaction_type NOT NULL,
  status odin_transaction_status NOT NULL DEFAULT 'posted',
  entry_source odin_transaction_entry_source NOT NULL DEFAULT 'manual',
  transaction_date date NOT NULL,
  posted_at timestamptz DEFAULT now(),
  amount_centavos bigint NOT NULL,
  category_id uuid,
  source_account_id uuid,
  destination_account_id uuid,
  recurring_template_id uuid,
  merchant_name text,
  counterparty_name text,
  notes text,
  client_mutation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT transactions_amount_chk
    CHECK (amount_centavos > 0),
  CONSTRAINT transactions_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CONSTRAINT transactions_posted_status_chk
    CHECK (status <> 'posted' OR posted_at IS NOT NULL),
  CONSTRAINT transactions_shape_chk
    CHECK (
      (
        transaction_type = 'income'
        AND destination_account_id IS NOT NULL
        AND source_account_id IS NULL
        AND category_id IS NOT NULL
      )
      OR (
        transaction_type = 'expense'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NULL
        AND category_id IS NOT NULL
      )
      OR (
        transaction_type = 'transfer'
        AND source_account_id IS NOT NULL
        AND destination_account_id IS NOT NULL
        AND source_account_id <> destination_account_id
        AND category_id IS NULL
      )
    ),

  CONSTRAINT pk_transactions PRIMARY KEY (id),
  CONSTRAINT fk_transactions_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_source_account_id FOREIGN KEY (source_account_id) REFERENCES financial_accounts (id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_destination_account_id FOREIGN KEY (destination_account_id) REFERENCES financial_accounts (id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_recurring_template_id FOREIGN KEY (recurring_template_id) REFERENCES recurring_transaction_templates (id) ON DELETE SET NULL
);

CREATE TABLE transaction_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action odin_transaction_event_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_snapshot jsonb,
  after_snapshot jsonb,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT pk_transaction_events PRIMARY KEY (id),
  CONSTRAINT fk_transaction_events_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
  CONSTRAINT fk_transaction_events_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE transaction_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_draft_id text NOT NULL,
  status odin_transaction_draft_status NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  captured_offline_at timestamptz,
  synced_transaction_id uuid,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, client_draft_id),

  CONSTRAINT pk_transaction_drafts PRIMARY KEY (id),
  CONSTRAINT fk_transaction_drafts_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_transaction_drafts_synced_transaction_id FOREIGN KEY (synced_transaction_id) REFERENCES transactions (id) ON DELETE SET NULL
);

CREATE TABLE recurring_transaction_occurrences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recurring_template_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  status odin_recurring_occurrence_status NOT NULL DEFAULT 'scheduled',
  generated_transaction_id uuid,
  reminder_sent_at timestamptz,
  posted_at timestamptz,
  skipped_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT recurring_transaction_occurrences_posted_chk
    CHECK (status <> 'posted' OR generated_transaction_id IS NOT NULL),
  UNIQUE (recurring_template_id, scheduled_date),

  CONSTRAINT pk_recurring_transaction_occurrences PRIMARY KEY (id),
  CONSTRAINT fk_recurring_transaction_occurrences_recurring_template_id FOREIGN KEY (recurring_template_id) REFERENCES recurring_transaction_templates (id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_transaction_occurrences_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_transaction_occurrences_generated_transaction_id FOREIGN KEY (generated_transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
);

CREATE TABLE expected_spending_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid,
  broad_group odin_broad_group,
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
    CHECK (expected_amount_centavos IS NULL OR expected_amount_centavos >= 0),

  CONSTRAINT pk_expected_spending_events PRIMARY KEY (id),
  CONSTRAINT fk_expected_spending_events_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_expected_spending_events_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
);

CREATE TABLE budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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

  CONSTRAINT pk_budgets PRIMARY KEY (id),
  CONSTRAINT fk_budgets_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE budget_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL,
  allocation_scope odin_allocation_scope NOT NULL,
  broad_group odin_broad_group NOT NULL,
  category_id uuid,
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
      (allocation_scope = 'broad_group' AND category_id IS NULL)
      OR (allocation_scope = 'category' AND category_id IS NOT NULL)
    ),
  CONSTRAINT budget_allocations_money_chk
    CHECK (
      allocated_amount_centavos >= 0
      AND rollover_amount_centavos >= 0
      AND (
        spent_amount_snapshot_centavos IS NULL
        OR spent_amount_snapshot_centavos >= 0
      )
    ),

  CONSTRAINT pk_budget_allocations PRIMARY KEY (id),
  CONSTRAINT fk_budget_allocations_budget_id FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_allocations_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
);

CREATE TABLE budget_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL,
  actor_user_id uuid,
  action odin_budget_event_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT pk_budget_events PRIMARY KEY (id),
  CONSTRAINT fk_budget_events_budget_id FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_events_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES profiles (user_id) ON DELETE SET NULL
);

CREATE TABLE savings_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  linked_account_id uuid,
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
    CHECK (status <> 'achieved' OR achieved_at IS NOT NULL),
  CONSTRAINT savings_goals_deleted_status_chk
    CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),

  CONSTRAINT pk_savings_goals PRIMARY KEY (id),
  CONSTRAINT fk_savings_goals_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_savings_goals_linked_account_id FOREIGN KEY (linked_account_id) REFERENCES financial_accounts (id) ON DELETE SET NULL
);

CREATE TABLE savings_goal_contributions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  savings_goal_id uuid NOT NULL,
  user_id uuid NOT NULL,
  transaction_id uuid,
  source odin_contribution_source NOT NULL DEFAULT 'manual',
  contribution_date date NOT NULL,
  amount_centavos bigint NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goal_contributions_amount_chk
    CHECK (amount_centavos > 0),

  CONSTRAINT pk_savings_goal_contributions PRIMARY KEY (id),
  CONSTRAINT fk_savings_goal_contributions_savings_goal_id FOREIGN KEY (savings_goal_id) REFERENCES savings_goals (id) ON DELETE CASCADE,
  CONSTRAINT fk_savings_goal_contributions_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_savings_goal_contributions_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE SET NULL
);

CREATE TABLE savings_goal_progress_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  savings_goal_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  current_amount_centavos bigint NOT NULL,
  progress_state odin_goal_progress_state NOT NULL,
  projected_completion_date date,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT savings_goal_progress_snapshots_amount_chk
    CHECK (current_amount_centavos >= 0),
  UNIQUE (savings_goal_id, snapshot_date),

  CONSTRAINT pk_savings_goal_progress_snapshots PRIMARY KEY (id),
  CONSTRAINT fk_savings_goal_progress_snapshots_savings_goal_id FOREIGN KEY (savings_goal_id) REFERENCES savings_goals (id) ON DELETE CASCADE
);

CREATE TABLE debt_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  linked_account_id uuid,
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

  CONSTRAINT pk_debt_accounts PRIMARY KEY (id),
  CONSTRAINT fk_debt_accounts_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_debt_accounts_linked_account_id FOREIGN KEY (linked_account_id) REFERENCES financial_accounts (id) ON DELETE SET NULL
);

CREATE TABLE debt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  debt_account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  transaction_id uuid,
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
    ),

  CONSTRAINT pk_debt_payments PRIMARY KEY (id),
  CONSTRAINT fk_debt_payments_debt_account_id FOREIGN KEY (debt_account_id) REFERENCES debt_accounts (id) ON DELETE CASCADE,
  CONSTRAINT fk_debt_payments_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_debt_payments_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE SET NULL
);

CREATE TABLE debt_strategy_preferences (
  user_id uuid NOT NULL,
  strategy odin_debt_strategy NOT NULL DEFAULT 'avalanche',
  extra_payment_centavos bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT debt_strategy_preferences_extra_payment_chk
    CHECK (extra_payment_centavos >= 0),

  CONSTRAINT pk_debt_strategy_preferences PRIMARY KEY (user_id),
  CONSTRAINT fk_debt_strategy_preferences_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE debt_repayment_projection_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
    ),

  CONSTRAINT pk_debt_repayment_projection_runs PRIMARY KEY (id),
  CONSTRAINT fk_debt_repayment_projection_runs_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE debt_repayment_projection_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  projection_run_id uuid NOT NULL,
  debt_account_id uuid NOT NULL,
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
  UNIQUE (projection_run_id, debt_account_id),

  CONSTRAINT pk_debt_repayment_projection_items PRIMARY KEY (id),
  CONSTRAINT fk_debt_repayment_projection_items_projection_run_id FOREIGN KEY (projection_run_id) REFERENCES debt_repayment_projection_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_debt_repayment_projection_items_debt_account_id FOREIGN KEY (debt_account_id) REFERENCES debt_accounts (id) ON DELETE CASCADE
);

CREATE TABLE debt_repayment_projection_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  projection_item_id uuid NOT NULL,
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
    ),

  CONSTRAINT pk_debt_repayment_projection_points PRIMARY KEY (id),
  CONSTRAINT fk_debt_repayment_projection_points_projection_item_id FOREIGN KEY (projection_item_id) REFERENCES debt_repayment_projection_items (id) ON DELETE CASCADE
);

CREATE TABLE forecast_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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

  CONSTRAINT pk_forecast_runs PRIMARY KEY (id),
  CONSTRAINT fk_forecast_runs_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE forecast_series (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  forecast_run_id uuid NOT NULL,
  target odin_forecast_target NOT NULL,
  broad_group odin_broad_group,
  category_id uuid,

  -- Optional pointer used when target is savings_balance or debt_balance.
  related_entity_id uuid,

  label text NOT NULL,
  unit text NOT NULL DEFAULT 'centavos',
  explanation text,
  confidence_label text,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT forecast_series_group_target_chk
    CHECK (
      (
        target = 'expense_group'
        AND broad_group IS NOT NULL
        AND category_id IS NULL
        AND related_entity_id IS NULL
      )
      OR (
        target = 'category_spending'
        AND broad_group IS NOT NULL
        AND category_id IS NOT NULL
        AND related_entity_id IS NULL
      )
      OR (
        target NOT IN ('expense_group', 'category_spending')
        AND broad_group IS NULL
        AND category_id IS NULL
      )
    ),

  CONSTRAINT pk_forecast_series PRIMARY KEY (id),
  CONSTRAINT fk_forecast_series_forecast_run_id FOREIGN KEY (forecast_run_id) REFERENCES forecast_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_forecast_series_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
);

CREATE TABLE forecast_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  forecast_series_id uuid NOT NULL,
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
    ),

  CONSTRAINT pk_forecast_points PRIMARY KEY (id),
  CONSTRAINT fk_forecast_points_forecast_series_id FOREIGN KEY (forecast_series_id) REFERENCES forecast_series (id) ON DELETE CASCADE
);

CREATE TABLE forecast_explanation_drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  forecast_series_id uuid NOT NULL,
  driver_key text NOT NULL,
  driver_label text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('increased', 'decreased', 'neutral')),
  impact_amount_centavos bigint,
  explanation text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT pk_forecast_explanation_drivers PRIMARY KEY (id),
  CONSTRAINT fk_forecast_explanation_drivers_forecast_series_id FOREIGN KEY (forecast_series_id) REFERENCES forecast_series (id) ON DELETE CASCADE
);

CREATE TABLE budget_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  forecast_run_id uuid,

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
  infeasibility_step integer,
  explanation_summary text NOT NULL,
  optimization_explanation text,

  -- Set when an accepted recommendation is copied into the budgets table.
  accepted_budget_id uuid,

  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  solver_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT budget_recommendations_period_chk
    CHECK (period_start < period_end),
  CONSTRAINT budget_recommendations_budget_period_days_chk
    CHECK (
      budget_period_days IN (7, 14, 30, 90)
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
  CONSTRAINT budget_recommendations_infeasibility_step_chk
    CHECK (infeasibility_step IS NULL OR infeasibility_step BETWEEN 1 AND 4),

  CONSTRAINT pk_budget_recommendations PRIMARY KEY (id),
  CONSTRAINT fk_budget_recommendations_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_recommendations_forecast_run_id FOREIGN KEY (forecast_run_id) REFERENCES forecast_runs (id) ON DELETE SET NULL,
  CONSTRAINT fk_budget_recommendations_accepted_budget_id FOREIGN KEY (accepted_budget_id) REFERENCES budgets (id) ON DELETE SET NULL
);

CREATE TABLE budget_recommendation_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL,

  allocation_scope odin_allocation_scope NOT NULL,
  broad_group odin_broad_group NOT NULL,
  category_id uuid,

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
      (allocation_scope = 'broad_group' AND category_id IS NULL)
      OR (allocation_scope = 'category' AND category_id IS NOT NULL)
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
    ),

  CONSTRAINT pk_budget_recommendation_allocations PRIMARY KEY (id),
  CONSTRAINT fk_budget_recommendation_allocations_recommendation_id FOREIGN KEY (recommendation_id) REFERENCES budget_recommendations (id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_recommendation_allocations_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
);

CREATE TABLE budget_recommendation_constraints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL,
  constraint_type odin_budget_constraint_type NOT NULL,

  broad_group odin_broad_group,
  category_id uuid,

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
    CHECK (relaxation_step IS NULL OR relaxation_step BETWEEN 1 AND 4),

  CONSTRAINT pk_budget_recommendation_constraints PRIMARY KEY (id),
  CONSTRAINT fk_budget_recommendation_constraints_recommendation_id FOREIGN KEY (recommendation_id) REFERENCES budget_recommendations (id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_recommendation_constraints_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
);

CREATE TABLE budget_recommendation_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL,
  action odin_recommendation_action NOT NULL,
  actor_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT pk_budget_recommendation_events PRIMARY KEY (id),
  CONSTRAINT fk_budget_recommendation_events_recommendation_id FOREIGN KEY (recommendation_id) REFERENCES budget_recommendations (id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_recommendation_events_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE anomaly_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,

  evaluated_at timestamptz NOT NULL DEFAULT now(),
  model_version text,
  profile_label odin_financial_profile_label NOT NULL,
  history_days integer NOT NULL DEFAULT 0,

  transaction_date date NOT NULL,
  merchant_name text,
  category_id uuid NOT NULL,
  broad_group odin_broad_group NOT NULL,
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

  CONSTRAINT pk_anomaly_evaluations PRIMARY KEY (id),
  CONSTRAINT fk_anomaly_evaluations_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_anomaly_evaluations_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
  CONSTRAINT fk_anomaly_evaluations_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
);

CREATE TABLE anomaly_evaluation_features (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  anomaly_evaluation_id uuid NOT NULL,
  feature_key odin_anomaly_feature_key NOT NULL,
  raw_value numeric(18, 6),
  normalized_value numeric(18, 6),
  baseline_value numeric(18, 6),
  deviation_value numeric(18, 6),
  is_top_driver boolean NOT NULL DEFAULT false,
  explanation text,

  UNIQUE (anomaly_evaluation_id, feature_key),

  CONSTRAINT pk_anomaly_evaluation_features PRIMARY KEY (id),
  CONSTRAINT fk_anomaly_evaluation_features_anomaly_evaluation_id FOREIGN KEY (anomaly_evaluation_id) REFERENCES anomaly_evaluations (id) ON DELETE CASCADE
);

CREATE TABLE alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

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
  transaction_id uuid,
  category_id uuid,
  budget_id uuid,
  debt_account_id uuid,
  savings_goal_id uuid,
  forecast_run_id uuid,
  budget_recommendation_id uuid,
  anomaly_evaluation_id uuid,

  duplicate_key text,
  bundle_key text,
  parent_alert_id uuid,

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
  CONSTRAINT alerts_status_timestamps_chk
    CHECK (
      (status <> 'read' OR read_at IS NOT NULL)
      AND (status <> 'acknowledged' OR acknowledged_at IS NOT NULL)
      AND (status <> 'dismissed' OR dismissed_at IS NOT NULL)
      AND (status <> 'cleared' OR cleared_at IS NOT NULL)
    ),

  CONSTRAINT pk_alerts PRIMARY KEY (id),
  CONSTRAINT fk_alerts_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_alerts_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerts_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerts_budget_id FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerts_debt_account_id FOREIGN KEY (debt_account_id) REFERENCES debt_accounts (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerts_savings_goal_id FOREIGN KEY (savings_goal_id) REFERENCES savings_goals (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerts_forecast_run_id FOREIGN KEY (forecast_run_id) REFERENCES forecast_runs (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerts_budget_recommendation_id FOREIGN KEY (budget_recommendation_id) REFERENCES budget_recommendations (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerts_anomaly_evaluation_id FOREIGN KEY (anomaly_evaluation_id) REFERENCES anomaly_evaluations (id) ON DELETE CASCADE,
  CONSTRAINT fk_alerts_parent_alert_id FOREIGN KEY (parent_alert_id) REFERENCES alerts (id) ON DELETE SET NULL
);

CREATE TABLE alert_related_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (
    entity_type IN (
      'transaction',
      'category',
      'budget',
      'forecast_run',
      'budget_recommendation',
      'savings_goal',
      'debt_account',
      'anomaly_evaluation'
    )
  ),
  entity_id uuid NOT NULL,
  label text,
  amount_centavos bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT alert_related_entities_amount_chk
    CHECK (amount_centavos IS NULL OR amount_centavos >= 0),

  CONSTRAINT pk_alert_related_entities PRIMARY KEY (id),
  CONSTRAINT fk_alert_related_entities_alert_id FOREIGN KEY (alert_id) REFERENCES alerts (id) ON DELETE CASCADE
);

CREATE TABLE alert_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL,
  action odin_alert_event_action NOT NULL,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT pk_alert_events PRIMARY KEY (id),
  CONSTRAINT fk_alert_events_alert_id FOREIGN KEY (alert_id) REFERENCES alerts (id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_events_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES profiles (user_id) ON DELETE SET NULL
);

CREATE TABLE alert_notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
  UNIQUE (user_id, category),

  CONSTRAINT pk_alert_notification_preferences PRIMARY KEY (id),
  CONSTRAINT fk_alert_notification_preferences_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE anomaly_whitelist_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_from_alert_id uuid,
  created_from_anomaly_evaluation_id uuid,

  merchant_name text NOT NULL,
  category_id uuid NOT NULL,
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
    ),

  CONSTRAINT pk_anomaly_whitelist_rules PRIMARY KEY (id),
  CONSTRAINT fk_anomaly_whitelist_rules_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_anomaly_whitelist_rules_created_from_alert_id FOREIGN KEY (created_from_alert_id) REFERENCES alerts (id) ON DELETE SET NULL,
  CONSTRAINT fk_anomaly_whitelist_rules_created_from_anomaly_evaluation_id FOREIGN KEY (created_from_anomaly_evaluation_id) REFERENCES anomaly_evaluations (id) ON DELETE SET NULL,
  CONSTRAINT fk_anomaly_whitelist_rules_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
);

CREATE TABLE alert_suppression_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category odin_alert_category NOT NULL,
  source_type odin_alert_source_type,
  status odin_suppression_rule_status NOT NULL DEFAULT 'active',

  created_from_alert_id uuid,
  merchant_name text,
  category_id uuid,
  broad_group odin_broad_group,
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
    CHECK (ends_at IS NULL OR starts_at < ends_at),

  CONSTRAINT pk_alert_suppression_rules PRIMARY KEY (id),
  CONSTRAINT fk_alert_suppression_rules_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_suppression_rules_created_from_alert_id FOREIGN KEY (created_from_alert_id) REFERENCES alerts (id) ON DELETE SET NULL,
  CONSTRAINT fk_alert_suppression_rules_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE report_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
    CHECK (status <> 'available' OR generated_at IS NOT NULL),

  CONSTRAINT pk_report_runs PRIMARY KEY (id),
  CONSTRAINT fk_report_runs_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE CASCADE
);

CREATE TABLE report_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  metric_key text NOT NULL,
  metric_label text NOT NULL,
  amount_centavos bigint,
  numeric_value numeric(18, 6),
  unit text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_metrics_value_chk
    CHECK (amount_centavos IS NOT NULL OR numeric_value IS NOT NULL),
  UNIQUE (report_run_id, metric_key),

  CONSTRAINT pk_report_metrics PRIMARY KEY (id),
  CONSTRAINT fk_report_metrics_report_run_id FOREIGN KEY (report_run_id) REFERENCES report_runs (id) ON DELETE CASCADE
);

CREATE TABLE report_category_breakdowns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  category_id uuid,
  broad_group odin_broad_group,
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
    ),

  CONSTRAINT pk_report_category_breakdowns PRIMARY KEY (id),
  CONSTRAINT fk_report_category_breakdowns_report_run_id FOREIGN KEY (report_run_id) REFERENCES report_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_report_category_breakdowns_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE report_budget_comparisons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  budget_id uuid,
  budget_allocation_id uuid,
  category_id uuid,
  broad_group odin_broad_group,
  allocated_amount_centavos bigint NOT NULL DEFAULT 0,
  actual_amount_centavos bigint NOT NULL DEFAULT 0,
  variance_amount_centavos bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_budget_comparisons_money_chk
    CHECK (allocated_amount_centavos >= 0 AND actual_amount_centavos >= 0),

  CONSTRAINT pk_report_budget_comparisons PRIMARY KEY (id),
  CONSTRAINT fk_report_budget_comparisons_report_run_id FOREIGN KEY (report_run_id) REFERENCES report_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_report_budget_comparisons_budget_id FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE SET NULL,
  CONSTRAINT fk_report_budget_comparisons_budget_allocation_id FOREIGN KEY (budget_allocation_id) REFERENCES budget_allocations (id) ON DELETE SET NULL,
  CONSTRAINT fk_report_budget_comparisons_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE report_forecast_comparisons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  forecast_run_id uuid,
  forecast_series_id uuid,
  category_id uuid,
  broad_group odin_broad_group,
  predicted_amount_centavos bigint NOT NULL DEFAULT 0,
  actual_amount_centavos bigint NOT NULL DEFAULT 0,
  absolute_error_centavos bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT report_forecast_comparisons_money_chk
    CHECK (
      predicted_amount_centavos >= 0
      AND actual_amount_centavos >= 0
      AND absolute_error_centavos >= 0
    ),

  CONSTRAINT pk_report_forecast_comparisons PRIMARY KEY (id),
  CONSTRAINT fk_report_forecast_comparisons_report_run_id FOREIGN KEY (report_run_id) REFERENCES report_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_report_forecast_comparisons_forecast_run_id FOREIGN KEY (forecast_run_id) REFERENCES forecast_runs (id) ON DELETE SET NULL,
  CONSTRAINT fk_report_forecast_comparisons_forecast_series_id FOREIGN KEY (forecast_series_id) REFERENCES forecast_series (id) ON DELETE SET NULL,
  CONSTRAINT fk_report_forecast_comparisons_category_id FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE report_savings_goal_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  savings_goal_id uuid,
  target_amount_centavos bigint NOT NULL,
  current_amount_centavos bigint NOT NULL,
  progress_state odin_goal_progress_state NOT NULL,
  projected_completion_date date,

  CONSTRAINT report_savings_goal_snapshots_money_chk
    CHECK (target_amount_centavos >= 0 AND current_amount_centavos >= 0),

  CONSTRAINT pk_report_savings_goal_snapshots PRIMARY KEY (id),
  CONSTRAINT fk_report_savings_goal_snapshots_report_run_id FOREIGN KEY (report_run_id) REFERENCES report_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_report_savings_goal_snapshots_savings_goal_id FOREIGN KEY (savings_goal_id) REFERENCES savings_goals (id) ON DELETE SET NULL
);

CREATE TABLE report_debt_account_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  debt_account_id uuid,
  current_balance_centavos bigint NOT NULL,
  minimum_payment_centavos bigint NOT NULL,
  projected_payoff_date date,
  strategy odin_debt_strategy,

  CONSTRAINT report_debt_account_snapshots_money_chk
    CHECK (current_balance_centavos >= 0 AND minimum_payment_centavos >= 0),

  CONSTRAINT pk_report_debt_account_snapshots PRIMARY KEY (id),
  CONSTRAINT fk_report_debt_account_snapshots_report_run_id FOREIGN KEY (report_run_id) REFERENCES report_runs (id) ON DELETE CASCADE,
  CONSTRAINT fk_report_debt_account_snapshots_debt_account_id FOREIGN KEY (debt_account_id) REFERENCES debt_accounts (id) ON DELETE SET NULL
);

CREATE TABLE model_evaluation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evaluation_kind odin_model_evaluation_kind NOT NULL,
  status odin_model_evaluation_status NOT NULL DEFAULT 'queued',
  user_id uuid,
  model_kind text NOT NULL,
  model_version text,
  dataset_name text NOT NULL,
  dataset_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_start date,
  period_end date,
  evaluated_at timestamptz,
  notes text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT model_evaluation_runs_period_chk
    CHECK (
      period_start IS NULL
      OR period_end IS NULL
      OR period_start < period_end
    ),
  CONSTRAINT model_evaluation_runs_available_chk
    CHECK (status <> 'available' OR evaluated_at IS NOT NULL),

  CONSTRAINT pk_model_evaluation_runs PRIMARY KEY (id),
  CONSTRAINT fk_model_evaluation_runs_user_id FOREIGN KEY (user_id) REFERENCES profiles (user_id) ON DELETE SET NULL
);

CREATE TABLE model_evaluation_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evaluation_run_id uuid NOT NULL,
  metric_key text NOT NULL,
  metric_label text NOT NULL,
  metric_value numeric(18, 8) NOT NULL,
  metric_unit text,
  direction odin_model_metric_direction NOT NULL,
  target_min numeric(18, 8),
  target_max numeric(18, 8),
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT model_evaluation_metrics_target_chk
    CHECK (
      target_min IS NULL
      OR target_max IS NULL
      OR target_min <= target_max
    ),
  UNIQUE (evaluation_run_id, metric_key),

  CONSTRAINT pk_model_evaluation_metrics PRIMARY KEY (id),
  CONSTRAINT fk_model_evaluation_metrics_evaluation_run_id FOREIGN KEY (evaluation_run_id) REFERENCES model_evaluation_runs (id) ON DELETE CASCADE
);

CREATE TABLE model_evaluation_artifacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evaluation_run_id uuid NOT NULL,
  artifact_kind text NOT NULL,
  storage_path text,
  content jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT model_evaluation_artifacts_content_chk
    CHECK (storage_path IS NOT NULL OR content IS NOT NULL),

  CONSTRAINT pk_model_evaluation_artifacts PRIMARY KEY (id),
  CONSTRAINT fk_model_evaluation_artifacts_evaluation_run_id FOREIGN KEY (evaluation_run_id) REFERENCES model_evaluation_runs (id) ON DELETE CASCADE
);
