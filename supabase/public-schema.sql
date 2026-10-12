CREATE TABLE public.onboarding_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status public.odin_onboarding_status DEFAULT 'in_progress'::public.odin_onboarding_status NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    abandoned_at timestamp with time zone,
    superseded_at timestamp with time zone,
    current_step_key text,
    raw_answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    review_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT onboarding_sessions_submit_chk CHECK (((status <> 'submitted'::public.odin_onboarding_status) OR (submitted_at IS NOT NULL)))
);

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);

CREATE TABLE public.account_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status public.odin_request_status DEFAULT 'requested'::public.odin_request_status NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    scheduled_delete_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT account_deletion_requests_schedule_chk CHECK (((scheduled_delete_at IS NULL) OR (requested_at <= scheduled_delete_at)))
);

CREATE TABLE public.alert_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid NOT NULL,
    action public.odin_alert_event_action NOT NULL,
    actor_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.alert_notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category public.odin_alert_category NOT NULL,
    mode public.odin_alert_preference_mode DEFAULT 'enabled'::public.odin_alert_preference_mode NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT false NOT NULL,
    duplicate_cooldown_hours integer DEFAULT 24 NOT NULL,
    snoozed_until timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT alert_notification_preferences_budget_mandatory_chk CHECK (((category <> 'budget_overspending'::public.odin_alert_category) OR ((mode <> 'disabled'::public.odin_alert_preference_mode) AND (in_app_enabled = true)))),
    CONSTRAINT alert_notification_preferences_cooldown_chk CHECK (((duplicate_cooldown_hours >= 1) AND (duplicate_cooldown_hours <= 24)))
);

CREATE TABLE public.alert_related_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    label text,
    amount_centavos bigint,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT alert_related_entities_amount_chk CHECK (((amount_centavos IS NULL) OR (amount_centavos >= 0))),
    CONSTRAINT alert_related_entities_entity_type_check CHECK ((entity_type = ANY (ARRAY['transaction'::text, 'subcategory'::text, 'budget'::text, 'forecast_run'::text, 'budget_recommendation'::text, 'savings_goal'::text, 'debt_account'::text, 'anomaly_evaluation'::text, 'overspending_evaluation'::text])))
);

CREATE TABLE public.alert_suppression_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category public.odin_alert_category NOT NULL,
    source_type public.odin_alert_source_type,
    status public.odin_suppression_rule_status DEFAULT 'active'::public.odin_suppression_rule_status NOT NULL,
    created_from_alert_id uuid,
    merchant_name text,
    subcategory_id uuid,
    category_id uuid,
    amount_center_centavos bigint,
    amount_tolerance_bps integer,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    reason text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    disabled_at timestamp with time zone,
    deleted_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT alert_suppression_rules_amount_chk CHECK (((amount_center_centavos IS NULL) OR (amount_center_centavos >= 0))),
    CONSTRAINT alert_suppression_rules_period_chk CHECK (((ends_at IS NULL) OR (starts_at < ends_at))),
    CONSTRAINT alert_suppression_rules_tolerance_chk CHECK (((amount_tolerance_bps IS NULL) OR ((amount_tolerance_bps >= 0) AND (amount_tolerance_bps <= 10000))))
);

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category public.odin_alert_category NOT NULL,
    source_type public.odin_alert_source_type NOT NULL,
    severity public.odin_alert_severity NOT NULL,
    status public.odin_alert_status DEFAULT 'unread'::public.odin_alert_status NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    explanation text,
    action_label text,
    route_name text,
    route_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    transaction_id uuid,
    subcategory_id uuid,
    budget_id uuid,
    debt_account_id uuid,
    savings_goal_id uuid,
    anomaly_evaluation_id uuid,
    overspending_evaluation_id uuid,
    duplicate_key text,
    bundle_key text,
    parent_alert_id uuid,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_in_app_at timestamp with time zone,
    delivered_push_at timestamp with time zone,
    read_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    cleared_at timestamp with time zone,
    expires_at timestamp with time zone,
    remind_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    model_version text,
    daily_report_evaluation_id uuid,
    CONSTRAINT alerts_anomaly_source_chk CHECK (((category <> 'anomaly_detection'::public.odin_alert_category) OR (anomaly_evaluation_id IS NOT NULL) OR (daily_report_evaluation_id IS NOT NULL))),
    CONSTRAINT alerts_budget_overspending_source_chk CHECK (((category <> 'budget_overspending'::public.odin_alert_category) OR (overspending_evaluation_id IS NOT NULL) OR (daily_report_evaluation_id IS NOT NULL))),
    CONSTRAINT alerts_category_source_chk CHECK ((((category = 'anomaly_detection'::public.odin_alert_category) AND (source_type = ANY (ARRAY['isolation_forest'::public.odin_alert_source_type, 'experimental_model'::public.odin_alert_source_type]))) OR ((category = 'budget_overspending'::public.odin_alert_category) AND (source_type = ANY (ARRAY['budget_overspending_rule'::public.odin_alert_source_type, 'experimental_model'::public.odin_alert_source_type]))) OR ((category = 'forecast_advisory'::public.odin_alert_category) AND (source_type = 'forecast_advisory_rule'::public.odin_alert_source_type)) OR ((category = 'savings_milestone'::public.odin_alert_category) AND (source_type = 'savings_goal_rule'::public.odin_alert_source_type)) OR ((category = 'debt_management'::public.odin_alert_category) AND (source_type = 'debt_rule'::public.odin_alert_source_type)) OR (source_type = 'system'::public.odin_alert_source_type))),
    CONSTRAINT alerts_status_timestamps_chk CHECK ((((status <> 'read'::public.odin_alert_status) OR (read_at IS NOT NULL)) AND ((status <> 'acknowledged'::public.odin_alert_status) OR (acknowledged_at IS NOT NULL)) AND ((status <> 'dismissed'::public.odin_alert_status) OR (dismissed_at IS NOT NULL)) AND ((status <> 'cleared'::public.odin_alert_status) OR (cleared_at IS NOT NULL))))
);

CREATE TABLE public.anomaly_evaluation_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anomaly_evaluation_id uuid NOT NULL,
    feature_key public.odin_anomaly_feature_key NOT NULL,
    raw_value numeric(18,6),
    normalized_value numeric(18,6),
    baseline_value numeric(18,6),
    deviation_value numeric(18,6),
    is_top_driver boolean DEFAULT false NOT NULL,
    explanation text
);

CREATE TABLE public.anomaly_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_version text,
    profile_label text,
    history_days integer DEFAULT 0 NOT NULL,
    merchant_name text,
    subcategory_id uuid NOT NULL,
    amount_centavos bigint NOT NULL,
    raw_anomaly_score numeric(12,8),
    threshold_score numeric(12,8),
    score_percentile numeric(6,3),
    is_anomaly boolean DEFAULT false NOT NULL,
    should_alert_user boolean DEFAULT false NOT NULL,
    review_status public.odin_anomaly_review_status DEFAULT 'not_alerted'::public.odin_anomaly_review_status NOT NULL,
    suppression_reason public.odin_anomaly_suppression_reason,
    suppression_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    feature_vector jsonb DEFAULT '{}'::jsonb NOT NULL,
    baseline_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    top_driver_key public.odin_anomaly_feature_key,
    explanation text,
    failure_reason text,
    CONSTRAINT anomaly_evaluations_alert_review_chk CHECK ((((should_alert_user = true) AND (review_status = ANY (ARRAY['pending_review'::public.odin_anomaly_review_status, 'expected'::public.odin_anomaly_review_status, 'unexpected'::public.odin_anomaly_review_status, 'remind_later'::public.odin_anomaly_review_status]))) OR (should_alert_user = false))),
    CONSTRAINT anomaly_evaluations_amount_chk CHECK ((amount_centavos >= 0)),
    CONSTRAINT anomaly_evaluations_history_days_chk CHECK ((history_days >= 0)),
    CONSTRAINT anomaly_evaluations_score_percentile_chk CHECK (((score_percentile IS NULL) OR ((score_percentile >= (0)::numeric) AND (score_percentile <= (100)::numeric)))),
    CONSTRAINT anomaly_evaluations_suppression_chk CHECK (((should_alert_user = false) OR (suppression_reason IS NULL)))
);

CREATE TABLE public.anomaly_whitelist_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_from_alert_id uuid,
    created_from_anomaly_evaluation_id uuid,
    merchant_name text NOT NULL,
    subcategory_id uuid NOT NULL,
    base_amount_centavos bigint,
    tolerance_bps integer,
    allow_any_amount boolean DEFAULT false NOT NULL,
    status public.odin_suppression_rule_status DEFAULT 'active'::public.odin_suppression_rule_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    disabled_at timestamp with time zone,
    deleted_at timestamp with time zone,
    notes text,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT anomaly_whitelist_rules_amount_chk CHECK (((base_amount_centavos IS NULL) OR (base_amount_centavos >= 0))),
    CONSTRAINT anomaly_whitelist_rules_tolerance_chk CHECK ((((allow_any_amount = true) AND (tolerance_bps IS NULL)) OR ((allow_any_amount = false) AND (base_amount_centavos IS NOT NULL) AND ((tolerance_bps >= 0) AND (tolerance_bps <= 10000)))))
);

CREATE TABLE public.applied_operations (
    operation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    entity text NOT NULL,
    record_id uuid NOT NULL,
    operation_type text NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    slug text NOT NULL,
    label text NOT NULL,
    short_label text,
    description text NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    is_filipino_context boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    minimum_amount_centavos bigint,
    always_in_budget boolean DEFAULT false NOT NULL,
    fixed_amount_centavos bigint,
    CONSTRAINT categories_fixed_amount_minimum_chk CHECK (((fixed_amount_centavos IS NULL) OR (minimum_amount_centavos IS NULL) OR (fixed_amount_centavos >= minimum_amount_centavos))),
    CONSTRAINT categories_fixed_amount_nonnegative_chk CHECK (((fixed_amount_centavos IS NULL) OR (fixed_amount_centavos >= 0))),
    CONSTRAINT categories_owner_chk CHECK ((((is_system = true) AND (user_id IS NULL)) OR ((is_system = false) AND (user_id IS NOT NULL))))
);

CREATE TABLE public.credit_card_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    cycle_start_date date NOT NULL,
    cutoff_date date NOT NULL,
    statement_date date,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT credit_card_cycles_dates_check CHECK (((cycle_start_date <= cutoff_date) AND ((statement_date IS NULL) OR (cutoff_date <= statement_date))))
);

CREATE TABLE public.credit_card_details (
    account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    issuer text,
    credit_limit_centavos bigint NOT NULL,
    available_credit_centavos bigint,
    cutoff_day integer NOT NULL,
    statement_day integer,
    notes text,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    billing_cycle_days integer,
    alert_threshold_percent integer,
    reconciled_available_credit_centavos bigint,
    pre_reconciliation_available_credit_centavos bigint,
    available_credit_reconciled_at timestamp with time zone,
    CONSTRAINT credit_card_details_alert_threshold_percent_check CHECK (((alert_threshold_percent >= 0) AND (alert_threshold_percent <= 100))),
    CONSTRAINT credit_card_details_billing_cycle_days_check CHECK (((billing_cycle_days >= 28) AND (billing_cycle_days <= 31))),
    CONSTRAINT credit_card_details_credit_limit_centavos_check CHECK ((credit_limit_centavos > 0)),
    CONSTRAINT credit_card_details_cutoff_day_check CHECK (((cutoff_day >= 1) AND (cutoff_day <= 31))),
    CONSTRAINT credit_card_details_statement_day_check CHECK (((statement_day >= 1) AND (statement_day <= 31)))
);

CREATE TABLE public.credit_card_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    transaction_id uuid,
    description text NOT NULL,
    original_principal_centavos bigint NOT NULL,
    remaining_principal_centavos bigint NOT NULL,
    term_months integer NOT NULL,
    remaining_months integer NOT NULL,
    monthly_amortization_centavos bigint NOT NULL,
    interest_rate_bps integer DEFAULT 0 NOT NULL,
    interest_type text NOT NULL,
    settlement_status text DEFAULT 'active'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT credit_card_installments_check CHECK (((remaining_principal_centavos >= 0) AND (remaining_principal_centavos <= original_principal_centavos))),
    CONSTRAINT credit_card_installments_check1 CHECK (((remaining_months >= 0) AND (remaining_months <= term_months))),
    CONSTRAINT credit_card_installments_interest_rate_bps_check CHECK ((interest_rate_bps >= 0)),
    CONSTRAINT credit_card_installments_interest_type_check CHECK ((interest_type = ANY (ARRAY['zero_interest'::text, 'interest_bearing'::text]))),
    CONSTRAINT credit_card_installments_monthly_amortization_centavos_check CHECK ((monthly_amortization_centavos > 0)),
    CONSTRAINT credit_card_installments_original_principal_centavos_check CHECK ((original_principal_centavos > 0)),
    CONSTRAINT credit_card_installments_settlement_status_check CHECK ((settlement_status = ANY (ARRAY['active'::text, 'early_settlement_requested'::text, 'completed'::text]))),
    CONSTRAINT credit_card_installments_term_months_check CHECK ((term_months > 0))
);

CREATE TABLE public.credit_card_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    statement_id uuid,
    transaction_id uuid,
    amount_centavos bigint NOT NULL,
    payment_date date NOT NULL,
    source_account_id uuid,
    notes text,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    issuer_recognized boolean DEFAULT false NOT NULL,
    client_mutation_id text,
    forecast_recorded_at timestamp with time zone,
    CONSTRAINT credit_card_payments_amount_centavos_check CHECK ((amount_centavos > 0))
);

CREATE TABLE public.credit_card_repayment_preferences (
    account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    strategy text NOT NULL,
    custom_amount_centavos bigint,
    percentage_bps integer,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT credit_card_repayment_preferences_check CHECK ((((strategy = 'custom_payment'::text) AND (custom_amount_centavos IS NOT NULL) AND (percentage_bps IS NULL)) OR ((strategy = 'percentage_of_statement'::text) AND (custom_amount_centavos IS NULL) AND (percentage_bps IS NOT NULL)) OR ((strategy = ANY (ARRAY['pay_in_full'::text, 'pay_minimum'::text])) AND (custom_amount_centavos IS NULL) AND (percentage_bps IS NULL)))),
    CONSTRAINT credit_card_repayment_preferences_custom_amount_centavos_check CHECK (((custom_amount_centavos IS NULL) OR (custom_amount_centavos > 0))),
    CONSTRAINT credit_card_repayment_preferences_percentage_bps_check CHECK (((percentage_bps IS NULL) OR ((percentage_bps >= 1) AND (percentage_bps <= 10000)))),
    CONSTRAINT credit_card_repayment_preferences_strategy_check CHECK ((strategy = ANY (ARRAY['pay_in_full'::text, 'pay_minimum'::text, 'percentage_of_statement'::text, 'custom_payment'::text])))
);

CREATE TABLE public.credit_card_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    installment_id uuid NOT NULL,
    settlement_date date NOT NULL,
    remaining_principal_centavos bigint NOT NULL,
    settlement_amount_centavos bigint NOT NULL,
    pretermination_fee_centavos bigint DEFAULT 0 NOT NULL,
    status text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT credit_card_settlements_pretermination_fee_centavos_check CHECK ((pretermination_fee_centavos >= 0)),
    CONSTRAINT credit_card_settlements_remaining_principal_centavos_check CHECK ((remaining_principal_centavos >= 0)),
    CONSTRAINT credit_card_settlements_settlement_amount_centavos_check CHECK ((settlement_amount_centavos > 0)),
    CONSTRAINT credit_card_settlements_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'recognized'::text, 'rejected'::text])))
);

CREATE TABLE public.credit_card_statement_strategies (
    statement_id uuid NOT NULL,
    user_id uuid NOT NULL,
    strategy text NOT NULL,
    custom_amount_centavos bigint,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    percentage_bps integer,
    CONSTRAINT credit_card_statement_strategies_custom_amount_centavos_check CHECK (((custom_amount_centavos IS NULL) OR (custom_amount_centavos > 0))),
    CONSTRAINT credit_card_statement_strategies_strategy_check CHECK ((strategy = ANY (ARRAY['pay_in_full'::text, 'pay_minimum'::text, 'percentage_of_statement'::text, 'custom_payment'::text])))
);

CREATE TABLE public.credit_card_statements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    statement_balance_centavos bigint NOT NULL,
    minimum_due_centavos bigint NOT NULL,
    finance_charge_centavos bigint DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    authoritative boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    statement_date date NOT NULL,
    CONSTRAINT credit_card_statements_amounts_check CHECK (((statement_balance_centavos >= 0) AND (minimum_due_centavos >= 0) AND (finance_charge_centavos >= 0) AND (minimum_due_centavos <= statement_balance_centavos))),
    CONSTRAINT credit_card_statements_check CHECK (((minimum_due_centavos >= 0) AND (minimum_due_centavos <= statement_balance_centavos))),
    CONSTRAINT credit_card_statements_finance_charge_centavos_check CHECK ((finance_charge_centavos >= 0)),
    CONSTRAINT credit_card_statements_statement_balance_centavos_check CHECK ((statement_balance_centavos >= 0))
);

CREATE TABLE public.credit_card_transactions (
    transaction_id uuid NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    purchase_type text NOT NULL,
    installment_id uuid,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    client_mutation_id text,
    applied_credit_centavos bigint DEFAULT 0 NOT NULL,
    forecast_recorded_at timestamp with time zone,
    CONSTRAINT credit_card_transactions_applied_credit_centavos_check CHECK ((applied_credit_centavos >= 0)),
    CONSTRAINT credit_card_transactions_purchase_type_check CHECK ((purchase_type = ANY (ARRAY['regular'::text, 'installment'::text])))
);

CREATE TABLE public.daily_financial_report_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    candidate_key text NOT NULL,
    finding text NOT NULL,
    severity public.odin_alert_severity,
    explanation text,
    source_references jsonb DEFAULT '{}'::jsonb NOT NULL,
    anomaly_score numeric(12,8),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_financial_report_evaluations_finding_check CHECK ((finding = ANY (ARRAY['unusual_transaction'::text, 'budget_overspending'::text, 'insufficient_history'::text, 'model_unavailable'::text, 'no_finding'::text])))
);

CREATE TABLE public.daily_financial_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    report_date date NOT NULL,
    cadence text NOT NULL,
    model_version text NOT NULL,
    period_start date NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT daily_financial_reports_cadence_check CHECK ((cadence = ANY (ARRAY['daily'::text, 'weekly'::text]))),
    CONSTRAINT daily_financial_reports_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])))
);

CREATE TABLE public.data_export_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status public.odin_request_status DEFAULT 'requested'::public.odin_request_status NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    expires_at timestamp with time zone,
    export_storage_path text,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT data_export_requests_expiry_chk CHECK (((expires_at IS NULL) OR (requested_at < expires_at)))
);

CREATE TABLE public.debt_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    linked_account_id uuid,
    name text NOT NULL,
    lender_name text,
    status public.odin_debt_account_status DEFAULT 'active'::public.odin_debt_account_status NOT NULL,
    original_balance_centavos bigint DEFAULT 0 NOT NULL,
    current_balance_centavos bigint NOT NULL,
    annual_interest_rate_bps integer DEFAULT 0 NOT NULL,
    minimum_payment_centavos bigint DEFAULT 0 NOT NULL,
    due_day_of_month integer,
    opened_on date,
    paid_off_at timestamp with time zone,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    preset_key text DEFAULT 'unknown'::text NOT NULL,
    payment_frequency text DEFAULT 'monthly'::text NOT NULL,
    next_due_date date,
    maturity_date date,
    target_payoff_date date,
    interest_period text,
    interest_method text,
    preset_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    payment_schedule jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT debt_accounts_deleted_status_chk CHECK (((status <> 'deleted'::public.odin_debt_account_status) OR (deleted_at IS NOT NULL))),
    CONSTRAINT debt_accounts_due_day_chk CHECK (((due_day_of_month IS NULL) OR ((due_day_of_month >= 1) AND (due_day_of_month <= 31)))),
    CONSTRAINT debt_accounts_interest_chk CHECK ((annual_interest_rate_bps >= 0)),
    CONSTRAINT debt_accounts_money_chk CHECK (((original_balance_centavos >= 0) AND (current_balance_centavos >= 0) AND (minimum_payment_centavos >= 0))),
    CONSTRAINT debt_accounts_paid_off_balance_chk CHECK (((status <> 'paid_off'::public.odin_debt_account_status) OR (current_balance_centavos = 0))),
    CONSTRAINT debt_accounts_paid_off_chk CHECK (((status <> 'paid_off'::public.odin_debt_account_status) OR (paid_off_at IS NOT NULL)))
);

CREATE TABLE public.debt_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    debt_account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    transaction_id uuid,
    source public.odin_debt_payment_source DEFAULT 'manual'::public.odin_debt_payment_source NOT NULL,
    payment_date date NOT NULL,
    amount_centavos bigint NOT NULL,
    principal_centavos bigint,
    interest_centavos bigint,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT debt_payments_money_chk CHECK (((amount_centavos > 0) AND ((principal_centavos IS NULL) OR (principal_centavos >= 0)) AND ((interest_centavos IS NULL) OR (interest_centavos >= 0))))
);

CREATE TABLE public.debt_strategy_preferences (
    user_id uuid NOT NULL,
    strategy public.odin_debt_strategy DEFAULT 'avalanche'::public.odin_debt_strategy NOT NULL,
    extra_payment_centavos bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT debt_strategy_preferences_extra_payment_chk CHECK ((extra_payment_centavos >= 0))
);

CREATE TABLE public.edit_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    operation_id uuid,
    entity text NOT NULL,
    record_id uuid NOT NULL,
    reason text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.financial_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    kind public.odin_account_kind NOT NULL,
    status public.odin_account_status DEFAULT 'active'::public.odin_account_status NOT NULL,
    opening_balance_centavos bigint DEFAULT 0 NOT NULL,
    current_balance_centavos bigint DEFAULT 0 NOT NULL,
    include_in_dashboard_balance boolean DEFAULT true NOT NULL,
    institution_name text,
    opened_on date,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT financial_accounts_deleted_status_chk CHECK (((status <> 'deleted'::public.odin_account_status) OR (deleted_at IS NOT NULL)))
);

CREATE TABLE public.financial_condition_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    rule_set_version text NOT NULL,
    input_snapshot jsonb NOT NULL,
    output_snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.financial_obligations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subcategory_id uuid NOT NULL,
    recurring_template_id uuid,
    name text NOT NULL,
    status public.odin_obligation_status DEFAULT 'active'::public.odin_obligation_status NOT NULL,
    amount_centavos bigint NOT NULL,
    frequency public.odin_recurring_frequency NOT NULL,
    due_day_of_month integer,
    is_family_support boolean DEFAULT false NOT NULL,
    is_dependent_support boolean DEFAULT false NOT NULL,
    protected_by_default boolean DEFAULT true NOT NULL,
    starts_on date,
    ends_on date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    due_second_day_of_month integer,
    due_day_of_week integer,
    due_second_day_of_week integer,
    due_month integer,
    CONSTRAINT financial_obligations_amount_chk CHECK ((amount_centavos >= 0)),
    CONSTRAINT financial_obligations_due_day_chk CHECK (((due_day_of_month IS NULL) OR ((due_day_of_month >= 1) AND (due_day_of_month <= 31)))),
    CONSTRAINT financial_obligations_period_chk CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (starts_on <= ends_on)))
);

CREATE TABLE public.financial_plan_allocations (
    id uuid NOT NULL,
    plan_id uuid NOT NULL,
    category_id uuid,
    subcategory_id uuid,
    allocation_rule text NOT NULL,
    allocated_amount_centavos bigint NOT NULL,
    floor_amount_centavos bigint NOT NULL,
    ceiling_amount_centavos bigint,
    forecast_amount_centavos bigint,
    subcategory_weight_bps integer,
    CONSTRAINT financial_plan_allocations_allocated_amount_centavos_check CHECK ((allocated_amount_centavos >= 0)),
    CONSTRAINT financial_plan_allocations_allocation_rule_check CHECK ((allocation_rule = ANY (ARRAY['FIXED'::text, 'MINIMUM'::text, 'FLEXIBLE'::text]))),
    CONSTRAINT financial_plan_allocations_check CHECK (((category_id IS NULL) <> (subcategory_id IS NULL))),
    CONSTRAINT financial_plan_allocations_floor_amount_centavos_check CHECK ((floor_amount_centavos >= 0))
);

CREATE TABLE public.financial_plan_debt_reservations (
    id uuid NOT NULL,
    plan_id uuid NOT NULL,
    debt_account_id uuid,
    credit_card_statement_id uuid,
    amount_centavos bigint NOT NULL,
    due_date date,
    CONSTRAINT financial_plan_debt_reservations_amount_centavos_check CHECK ((amount_centavos >= 0)),
    CONSTRAINT financial_plan_debt_reservations_check CHECK (((debt_account_id IS NULL) <> (credit_card_statement_id IS NULL)))
);

CREATE TABLE public.financial_plan_forecast_points (
    plan_id uuid NOT NULL,
    category_key text NOT NULL,
    amount_centavos bigint NOT NULL,
    CONSTRAINT financial_plan_forecast_points_amount_centavos_check CHECK ((amount_centavos >= 0))
);

CREATE TABLE public.financial_plan_savings_reservations (
    id uuid NOT NULL,
    plan_id uuid NOT NULL,
    savings_goal_id uuid NOT NULL,
    amount_centavos bigint NOT NULL,
    due_date date,
    CONSTRAINT financial_plan_savings_reservations_amount_centavos_check CHECK ((amount_centavos >= 0))
);

CREATE TABLE public.financial_plans (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status text NOT NULL,
    forecast_month text NOT NULL,
    forecast_total_centavos bigint NOT NULL,
    forecast_model_version text NOT NULL,
    forecast_generated_at timestamp with time zone NOT NULL,
    forecast_quality text NOT NULL,
    classification_status text,
    classification_rule_set_version text,
    classification_assessed_at timestamp with time zone,
    available_funds_centavos bigint NOT NULL,
    required_funds_centavos bigint,
    shortfall_centavos bigint,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    debt_surplus_centavos bigint DEFAULT 0 NOT NULL,
    savings_surplus_centavos bigint DEFAULT 0 NOT NULL,
    CONSTRAINT financial_plans_available_funds_centavos_check CHECK ((available_funds_centavos >= 0)),
    CONSTRAINT financial_plans_check CHECK ((period_end = ((date_trunc('month'::text, (period_start)::timestamp with time zone) + '1 mon -1 days'::interval))::date)),
    CONSTRAINT financial_plans_debt_surplus_centavos_check CHECK ((debt_surplus_centavos >= 0)),
    CONSTRAINT financial_plans_forecast_total_centavos_check CHECK ((forecast_total_centavos >= 0)),
    CONSTRAINT financial_plans_period_start_check CHECK (((date_trunc('month'::text, (period_start)::timestamp with time zone))::date = period_start)),
    CONSTRAINT financial_plans_savings_surplus_centavos_check CHECK ((savings_surplus_centavos >= 0)),
    CONSTRAINT financial_plans_status_check CHECK ((status = 'accepted'::text))
);

CREATE TABLE public.hfce_category_defaults (
    slug text NOT NULL,
    label text NOT NULL,
    short_label text,
    description text NOT NULL,
    is_filipino_context boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.hfce_subcategory_defaults (
    category_slug text NOT NULL,
    slug text NOT NULL,
    kind public.odin_subcategory_kind DEFAULT 'expense'::public.odin_subcategory_kind NOT NULL,
    label text NOT NULL,
    short_label text,
    description text NOT NULL,
    is_filipino_context boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    minimum_amount_centavos bigint,
    always_in_budget boolean DEFAULT false NOT NULL,
    fixed_amount_centavos bigint
);

CREATE TABLE public.income_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    income_type public.odin_income_type NOT NULL,
    frequency public.odin_income_frequency NOT NULL,
    expected_amount_centavos bigint,
    min_amount_centavos bigint,
    max_amount_centavos bigint,
    payday_day_of_month integer,
    payday_second_day_of_month integer,
    payday_day_of_week integer,
    next_expected_date date,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    estimated_interval_days integer,
    payday_second_day_of_week integer,
    recurring_template_id uuid,
    destination_account_id uuid,
    subcategory_id uuid,
    CONSTRAINT income_sources_amount_chk CHECK ((((expected_amount_centavos IS NULL) OR (expected_amount_centavos >= 0)) AND ((min_amount_centavos IS NULL) OR (min_amount_centavos >= 0)) AND ((max_amount_centavos IS NULL) OR (max_amount_centavos >= 0)))),
    CONSTRAINT income_sources_amount_range_chk CHECK (((min_amount_centavos IS NULL) OR (max_amount_centavos IS NULL) OR (min_amount_centavos <= max_amount_centavos))),
    CONSTRAINT income_sources_payday_chk CHECK ((((payday_day_of_month IS NULL) OR ((payday_day_of_month >= 1) AND (payday_day_of_month <= 31))) AND ((payday_second_day_of_month IS NULL) OR ((payday_second_day_of_month >= 1) AND (payday_second_day_of_month <= 31))) AND ((payday_day_of_week IS NULL) OR ((payday_day_of_week >= 0) AND (payday_day_of_week <= 6)))))
);

CREATE TABLE public.metro_manila_localities (
    code text NOT NULL,
    name text NOT NULL,
    is_city boolean NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.overspending_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    budget_id uuid,
    budget_allocation_id uuid,
    category_id uuid,
    subcategory_id uuid,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_amount_centavos bigint NOT NULL,
    budgeted_amount_centavos bigint NOT NULL,
    overspent_amount_centavos bigint NOT NULL,
    overspent_percent_bps integer,
    threshold_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    should_alert_user boolean DEFAULT true NOT NULL,
    explanation text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT overspending_evaluations_amounts_chk CHECK (((actual_amount_centavos >= 0) AND (budgeted_amount_centavos >= 0) AND (overspent_amount_centavos >= 0) AND ((overspent_percent_bps IS NULL) OR (overspent_percent_bps >= 0))))
);

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name text,
    metro_manila_city text,
    lifecycle_status public.odin_user_lifecycle_status DEFAULT 'active'::public.odin_user_lifecycle_status NOT NULL,
    onboarding_completed_at timestamp with time zone,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT profiles_deleted_status_chk CHECK (((lifecycle_status <> 'deleted'::public.odin_user_lifecycle_status) OR (deleted_at IS NOT NULL)))
);

CREATE TABLE public.push_device_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_token text NOT NULL,
    platform public.odin_push_device_platform NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.recurring_transaction_occurrences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recurring_template_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scheduled_date date NOT NULL,
    status public.odin_recurring_occurrence_status DEFAULT 'scheduled'::public.odin_recurring_occurrence_status NOT NULL,
    generated_transaction_id uuid,
    reminder_sent_at timestamp with time zone,
    posted_at timestamp with time zone,
    skipped_at timestamp with time zone,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT recurring_transaction_occurrences_posted_chk CHECK (((status <> 'posted'::public.odin_recurring_occurrence_status) OR (generated_transaction_id IS NOT NULL)))
);

CREATE TABLE public.recurring_transaction_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    transaction_type public.odin_transaction_type NOT NULL,
    status public.odin_recurring_template_status DEFAULT 'active'::public.odin_recurring_template_status NOT NULL,
    name text NOT NULL,
    amount_centavos bigint NOT NULL,
    subcategory_id uuid,
    source_account_id uuid,
    destination_account_id uuid,
    frequency public.odin_recurring_frequency NOT NULL,
    interval_count integer DEFAULT 1 NOT NULL,
    day_of_month integer,
    second_day_of_month integer,
    day_of_week integer,
    custom_rule jsonb DEFAULT '{}'::jsonb NOT NULL,
    starts_on date NOT NULL,
    ends_on date,
    next_occurrence_date date,
    last_generated_date date,
    reminder_enabled boolean DEFAULT false NOT NULL,
    reminder_days_before integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stopped_at timestamp with time zone,
    deleted_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT recurring_transaction_templates_amount_chk CHECK ((amount_centavos > 0)),
    CONSTRAINT recurring_transaction_templates_calendar_chk CHECK ((((day_of_month IS NULL) OR ((day_of_month >= 1) AND (day_of_month <= 31))) AND ((second_day_of_month IS NULL) OR ((second_day_of_month >= 1) AND (second_day_of_month <= 31))) AND ((day_of_week IS NULL) OR ((day_of_week >= 0) AND (day_of_week <= 6))))),
    CONSTRAINT recurring_transaction_templates_interval_chk CHECK ((interval_count > 0)),
    CONSTRAINT recurring_transaction_templates_period_chk CHECK (((ends_on IS NULL) OR (starts_on <= ends_on))),
    CONSTRAINT recurring_transaction_templates_reminder_chk CHECK ((reminder_days_before >= 0)),
    CONSTRAINT recurring_transaction_templates_shape_chk CHECK ((((transaction_type = 'income'::public.odin_transaction_type) AND (destination_account_id IS NOT NULL) AND (source_account_id IS NULL) AND (subcategory_id IS NOT NULL)) OR ((transaction_type = 'expense'::public.odin_transaction_type) AND (source_account_id IS NOT NULL) AND (destination_account_id IS NULL) AND (subcategory_id IS NOT NULL)) OR ((transaction_type = 'transfer'::public.odin_transaction_type) AND (source_account_id IS NOT NULL) AND (destination_account_id IS NOT NULL) AND (source_account_id <> destination_account_id) AND (subcategory_id IS NULL))))
);

CREATE TABLE public.savings_account_details (
    account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    account_type text NOT NULL,
    interest_rate_bps integer,
    minimum_balance_centavos bigint,
    base_interest_rate_bps integer,
    effective_interest_rate_bps integer,
    interest_conditions text,
    higher_rate_eligible boolean,
    principal_centavos bigint,
    maturity_date date,
    term_months integer,
    early_withdrawal_rule text,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    planned_contribution_amount_centavos bigint,
    contribution_frequency text,
    contribution_interval_count integer,
    contribution_day_of_month integer,
    contribution_second_day_of_month integer,
    contribution_day_of_week integer,
    custom_interval_days integer,
    next_contribution_date date,
    boosted_interest_rate_bps integer,
    interest_calculation_basis text,
    interest_credit_frequency text,
    maximum_eligible_balance_centavos bigint,
    balance_tiers jsonb,
    required_deposit_centavos bigint,
    required_deposit_frequency text,
    required_transaction_count integer,
    required_transaction_period text,
    direct_deposit_threshold_centavos bigint,
    qualification_period text,
    promotional_interest_rate_bps integer,
    promotion_start_date date,
    promotion_end_date date,
    CONSTRAINT savings_account_details_account_type_check CHECK ((account_type = ANY (ARRAY['personal_savings'::text, 'high_yield_savings'::text, 'time_deposit'::text]))),
    CONSTRAINT savings_account_details_base_interest_rate_bps_check CHECK ((base_interest_rate_bps >= 0)),
    CONSTRAINT savings_account_details_boosted_interest_rate_bps_check CHECK ((boosted_interest_rate_bps >= 0)),
    CONSTRAINT savings_account_details_contribution_day_check CHECK ((((contribution_day_of_month IS NULL) OR ((contribution_day_of_month >= 1) AND (contribution_day_of_month <= 31))) AND ((contribution_second_day_of_month IS NULL) OR ((contribution_second_day_of_month >= 1) AND (contribution_second_day_of_month <= 31))) AND ((contribution_day_of_week IS NULL) OR ((contribution_day_of_week >= 0) AND (contribution_day_of_week <= 6))) AND ((contribution_interval_count IS NULL) OR (contribution_interval_count > 0)) AND ((contribution_frequency IS DISTINCT FROM 'custom'::text) OR COALESCE((custom_interval_days > 0), false)) AND ((contribution_frequency IS DISTINCT FROM 'semi_monthly'::text) OR COALESCE((contribution_day_of_month < contribution_second_day_of_month), false)))),
    CONSTRAINT savings_account_details_contribution_frequency_check CHECK (((contribution_frequency IS NULL) OR (contribution_frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'semi_monthly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text])))),
    CONSTRAINT savings_account_details_contribution_schedule_check CHECK (((account_type = 'time_deposit'::text) OR (contribution_frequency IS NULL) OR ((planned_contribution_amount_centavos >= 0) AND (next_contribution_date IS NOT NULL)))),
    CONSTRAINT savings_account_details_direct_deposit_threshold_centavos_check CHECK ((direct_deposit_threshold_centavos >= 0)),
    CONSTRAINT savings_account_details_early_withdrawal_rule_check CHECK (((early_withdrawal_rule IS NULL) OR (length(early_withdrawal_rule) <= 1000))),
    CONSTRAINT savings_account_details_effective_interest_rate_bps_check CHECK ((effective_interest_rate_bps >= 0)),
    CONSTRAINT savings_account_details_hysa_promotion_dates_check CHECK (((promotion_end_date IS NULL) OR ((promotion_start_date IS NOT NULL) AND (promotion_end_date >= promotion_start_date)))),
    CONSTRAINT savings_account_details_interest_calculation_basis_check CHECK ((interest_calculation_basis = ANY (ARRAY['daily_ending_balance'::text, 'average_daily_balance'::text, 'monthly_average_balance'::text]))),
    CONSTRAINT savings_account_details_interest_conditions_check CHECK (((interest_conditions IS NULL) OR (length(interest_conditions) <= 1000))),
    CONSTRAINT savings_account_details_interest_credit_frequency_check CHECK ((interest_credit_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'at_maturity'::text]))),
    CONSTRAINT savings_account_details_interest_rate_bps_check CHECK ((interest_rate_bps >= 0)),
    CONSTRAINT savings_account_details_maximum_eligible_balance_centavos_check CHECK ((maximum_eligible_balance_centavos >= 0)),
    CONSTRAINT savings_account_details_minimum_balance_centavos_check CHECK ((minimum_balance_centavos >= 0)),
    CONSTRAINT savings_account_details_principal_centavos_check CHECK (((principal_centavos IS NULL) OR (principal_centavos > 0))),
    CONSTRAINT savings_account_details_promotional_interest_rate_bps_check CHECK ((promotional_interest_rate_bps >= 0)),
    CONSTRAINT savings_account_details_qualification_period_check CHECK ((qualification_period = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'custom'::text]))),
    CONSTRAINT savings_account_details_required_deposit_centavos_check CHECK ((required_deposit_centavos >= 0)),
    CONSTRAINT savings_account_details_required_deposit_frequency_check CHECK ((required_deposit_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'custom'::text]))),
    CONSTRAINT savings_account_details_required_transaction_count_check CHECK ((required_transaction_count > 0)),
    CONSTRAINT savings_account_details_required_transaction_period_check CHECK ((required_transaction_period = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'custom'::text]))),
    CONSTRAINT savings_account_details_term_months_check CHECK (((term_months IS NULL) OR (term_months > 0)))
);

CREATE TABLE public.savings_allocation_preferences (
    user_id uuid NOT NULL,
    strategy text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT savings_allocation_preferences_strategy_check CHECK ((strategy = ANY (ARRAY['avalanche'::text, 'snowball'::text])))
);

CREATE TABLE public.savings_goal_activities (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    savings_goal_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    activity_kind text NOT NULL,
    amount_centavos bigint NOT NULL,
    activity_date date NOT NULL,
    notes text,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT savings_goal_activities_activity_kind_check CHECK ((activity_kind = ANY (ARRAY['contribution'::text, 'withdrawal'::text]))),
    CONSTRAINT savings_goal_activities_amount_centavos_check CHECK ((amount_centavos > 0)),
    CONSTRAINT savings_goal_activities_notes_check CHECK (((notes IS NULL) OR (length(notes) <= 1000)))
);

CREATE TABLE public.savings_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    linked_account_id uuid,
    linked_subcategory_id uuid,
    name text NOT NULL,
    status public.odin_savings_goal_status DEFAULT 'active'::public.odin_savings_goal_status NOT NULL,
    progress_state public.odin_goal_progress_state DEFAULT 'projection_unavailable'::public.odin_goal_progress_state NOT NULL,
    target_amount_centavos bigint NOT NULL,
    current_amount_centavos bigint DEFAULT 0 NOT NULL,
    target_date date,
    priority_rank integer DEFAULT 1 NOT NULL,
    projected_completion_date date,
    achieved_at timestamp with time zone,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    goal_type text DEFAULT 'custom'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    starting_amount_centavos bigint DEFAULT 0 NOT NULL,
    emergency_fund_baseline_centavos bigint,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    last_synced_at timestamp with time zone,
    auto_save_amount_centavos bigint DEFAULT 0 NOT NULL,
    interest_rate_bps integer,
    emergency_fund_target_method text DEFAULT 'fixed_amount'::text NOT NULL,
    essential_expense_coverage_months integer,
    planned_contribution_amount_centavos bigint,
    contribution_frequency text,
    contribution_interval_count integer,
    contribution_day_of_month integer,
    contribution_second_day_of_month integer,
    contribution_day_of_week integer,
    custom_interval_days integer,
    next_contribution_date date,
    CONSTRAINT savings_goals_achieved_chk CHECK (((status <> 'achieved'::public.odin_savings_goal_status) OR ((achieved_at IS NOT NULL) AND (progress_state = 'achieved'::public.odin_goal_progress_state) AND (current_amount_centavos >= target_amount_centavos)))),
    CONSTRAINT savings_goals_amount_chk CHECK (((target_amount_centavos > 0) AND (current_amount_centavos >= 0))),
    CONSTRAINT savings_goals_archived_status_chk CHECK (((status <> 'archived'::public.odin_savings_goal_status) OR (archived_at IS NOT NULL))),
    CONSTRAINT savings_goals_auto_save_amount_centavos_check CHECK ((auto_save_amount_centavos >= 0)),
    CONSTRAINT savings_goals_contribution_custom_check CHECK (((contribution_frequency IS DISTINCT FROM 'custom'::text) OR COALESCE((custom_interval_days > 0), false))),
    CONSTRAINT savings_goals_contribution_day_check CHECK ((((contribution_day_of_month IS NULL) OR ((contribution_day_of_month >= 1) AND (contribution_day_of_month <= 31))) AND ((contribution_second_day_of_month IS NULL) OR ((contribution_second_day_of_month >= 1) AND (contribution_second_day_of_month <= 31))) AND ((contribution_day_of_week IS NULL) OR ((contribution_day_of_week >= 0) AND (contribution_day_of_week <= 6))))),
    CONSTRAINT savings_goals_contribution_frequency_check CHECK (((contribution_frequency IS NULL) OR (contribution_frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'semi_monthly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text])))),
    CONSTRAINT savings_goals_contribution_interval_check CHECK (((contribution_interval_count IS NULL) OR (contribution_interval_count > 0))),
    CONSTRAINT savings_goals_contribution_schedule_complete_check CHECK (((contribution_frequency IS NULL) OR ((planned_contribution_amount_centavos IS NOT NULL) AND (next_contribution_date IS NOT NULL) AND (target_date IS NOT NULL)))),
    CONSTRAINT savings_goals_contribution_semi_monthly_check CHECK (((contribution_frequency IS DISTINCT FROM 'semi_monthly'::text) OR COALESCE((((contribution_day_of_month >= 1) AND (contribution_day_of_month <= 31)) AND ((contribution_second_day_of_month >= 1) AND (contribution_second_day_of_month <= 31)) AND (contribution_day_of_month < contribution_second_day_of_month)), false))),
    CONSTRAINT savings_goals_deleted_status_chk CHECK (((status <> 'deleted'::public.odin_savings_goal_status) OR (deleted_at IS NOT NULL))),
    CONSTRAINT savings_goals_emergency_fund_baseline_centavos_check CHECK ((emergency_fund_baseline_centavos >= 0)),
    CONSTRAINT savings_goals_emergency_fund_target_method_check CHECK ((emergency_fund_target_method = ANY (ARRAY['fixed_amount'::text, 'essential_expense_coverage'::text]))),
    CONSTRAINT savings_goals_essential_expense_coverage_months_check CHECK (((essential_expense_coverage_months >= 3) AND (essential_expense_coverage_months <= 6))),
    CONSTRAINT savings_goals_goal_type_check CHECK ((goal_type = ANY (ARRAY['emergency_fund'::text, 'custom'::text]))),
    CONSTRAINT savings_goals_interest_rate_bps_check CHECK ((interest_rate_bps >= 0)),
    CONSTRAINT savings_goals_next_contribution_target_check CHECK (((next_contribution_date IS NULL) OR (target_date IS NULL) OR (next_contribution_date <= target_date))),
    CONSTRAINT savings_goals_planned_contribution_check CHECK (((planned_contribution_amount_centavos IS NULL) OR (planned_contribution_amount_centavos >= 0))),
    CONSTRAINT savings_goals_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT savings_goals_priority_chk CHECK ((priority_rank > 0)),
    CONSTRAINT savings_goals_progress_state_chk CHECK (((progress_state <> 'achieved'::public.odin_goal_progress_state) OR ((status = ANY (ARRAY['achieved'::public.odin_savings_goal_status, 'archived'::public.odin_savings_goal_status])) AND (achieved_at IS NOT NULL) AND (current_amount_centavos >= target_amount_centavos)))),
    CONSTRAINT savings_goals_starting_amount_centavos_check CHECK ((starting_amount_centavos >= 0)),
    CONSTRAINT savings_goals_status_check CHECK ((status = ANY (ARRAY['active'::public.odin_savings_goal_status, 'archived'::public.odin_savings_goal_status, 'deleted'::public.odin_savings_goal_status])))
);

CREATE TABLE public.subcategories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid,
    user_id uuid,
    slug text NOT NULL,
    kind public.odin_subcategory_kind DEFAULT 'expense'::public.odin_subcategory_kind NOT NULL,
    label text NOT NULL,
    short_label text,
    description text NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    is_filipino_context boolean DEFAULT false NOT NULL,
    is_protected_default boolean DEFAULT false NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    minimum_amount_centavos bigint,
    always_in_budget boolean DEFAULT false NOT NULL,
    fixed_amount_centavos bigint,
    CONSTRAINT subcategories_expense_category_chk CHECK ((((kind = 'expense'::public.odin_subcategory_kind) AND (category_id IS NOT NULL)) OR ((kind <> 'expense'::public.odin_subcategory_kind) AND (category_id IS NULL)))),
    CONSTRAINT subcategories_fixed_amount_minimum_chk CHECK (((fixed_amount_centavos IS NULL) OR (minimum_amount_centavos IS NULL) OR (fixed_amount_centavos >= minimum_amount_centavos))),
    CONSTRAINT subcategories_fixed_amount_nonnegative_chk CHECK (((fixed_amount_centavos IS NULL) OR (fixed_amount_centavos >= 0))),
    CONSTRAINT subcategories_minimum_amount_nonnegative_chk CHECK (((minimum_amount_centavos IS NULL) OR (minimum_amount_centavos >= 0))),
    CONSTRAINT subcategories_owner_chk CHECK ((((is_system = true) AND (user_id IS NULL)) OR ((is_system = false) AND (user_id IS NOT NULL)))),
    CONSTRAINT subcategories_user_default_protection_chk CHECK (((is_system = true) OR (is_protected_default = false)))
);

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    transaction_type public.odin_transaction_type NOT NULL,
    status public.odin_transaction_status DEFAULT 'posted'::public.odin_transaction_status NOT NULL,
    entry_source public.odin_transaction_entry_source DEFAULT 'manual'::public.odin_transaction_entry_source NOT NULL,
    transaction_date date NOT NULL,
    posted_at timestamp with time zone DEFAULT now(),
    amount_centavos bigint NOT NULL,
    subcategory_id uuid,
    source_account_id uuid,
    destination_account_id uuid,
    recurring_template_id uuid,
    merchant_name text,
    counterparty_name text,
    notes text,
    client_mutation_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    retain_until date,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    credit_card_posting_date date,
    source_savings_goal_id uuid,
    destination_savings_goal_id uuid,
    category_id uuid,
    CONSTRAINT transactions_amount_chk CHECK ((amount_centavos > 0)),
    CONSTRAINT transactions_category_target_chk CHECK (((category_id IS NULL) OR (subcategory_id IS NULL))),
    CONSTRAINT transactions_deleted_status_chk CHECK (((status <> 'deleted'::public.odin_transaction_status) OR (deleted_at IS NOT NULL))),
    CONSTRAINT transactions_posted_status_chk CHECK (((status <> 'posted'::public.odin_transaction_status) OR (posted_at IS NOT NULL))),
    CONSTRAINT transactions_shape_chk CHECK ((((transaction_type = 'income'::public.odin_transaction_type) AND (destination_account_id IS NOT NULL) AND (source_account_id IS NULL) AND (subcategory_id IS NOT NULL)) OR ((transaction_type = 'expense'::public.odin_transaction_type) AND (source_account_id IS NOT NULL) AND (destination_account_id IS NULL) AND (subcategory_id IS NOT NULL)) OR ((transaction_type = 'transfer'::public.odin_transaction_type) AND (source_account_id IS NOT NULL) AND (destination_account_id IS NOT NULL) AND (source_account_id <> destination_account_id) AND (subcategory_id IS NULL))))
);

CREATE TABLE public.user_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    consent_kind public.odin_consent_kind NOT NULL,
    status public.odin_consent_status NOT NULL,
    version text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    effective_at timestamp with time zone DEFAULT now() NOT NULL,
    withdrawn_at timestamp with time zone,
    source text,
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT user_consents_withdrawn_at_chk CHECK (((status <> 'withdrawn'::public.odin_consent_status) OR (withdrawn_at IS NOT NULL)))
);

CREATE TABLE public.user_debt_priorities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    debt_account_id uuid NOT NULL,
    priority_rank integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT user_debt_priorities_rank_chk CHECK ((priority_rank > 0))
);

CREATE TABLE public.user_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone
);

CREATE TABLE public.user_eligibility_profiles (
    user_id uuid NOT NULL,
    date_of_birth date,
    is_filipino boolean,
    metro_manila_presence public.odin_metro_manila_presence,
    metro_manila_locality_code text,
    primary_employment_classification public.odin_employment_classification,
    primary_employment_other text,
    eligibility_confirmed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT user_eligibility_profiles_birth_date_chk CHECK (((date_of_birth IS NULL) OR (date_of_birth <= CURRENT_DATE))),
    CONSTRAINT user_eligibility_profiles_confirmed_eligibility_chk CHECK (((eligibility_confirmed_at IS NULL) OR ((date_of_birth IS NOT NULL) AND (is_filipino = true) AND (metro_manila_presence IS NOT NULL) AND (metro_manila_locality_code IS NOT NULL) AND (primary_employment_classification IS NOT NULL)))),
    CONSTRAINT user_eligibility_profiles_other_employment_chk CHECK (((primary_employment_classification <> 'other'::public.odin_employment_classification) OR (primary_employment_other IS NOT NULL)))
);

CREATE TABLE public.user_privacy_settings (
    user_id uuid NOT NULL,
    personalization_enabled boolean DEFAULT true NOT NULL,
    model_training_opt_in boolean DEFAULT false NOT NULL,
    research_evaluation_opt_in boolean DEFAULT false NOT NULL,
    notifications_opt_in boolean DEFAULT false NOT NULL,
    data_retention_days integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT user_privacy_settings_retention_chk CHECK (((data_retention_days IS NULL) OR (data_retention_days > 0)))
);

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alert_notification_preferences
    ADD CONSTRAINT alert_notification_preferences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alert_related_entities
    ADD CONSTRAINT alert_related_entities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anomaly_evaluation_features
    ADD CONSTRAINT anomaly_evaluation_features_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anomaly_evaluations
    ADD CONSTRAINT anomaly_evaluations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anomaly_whitelist_rules
    ADD CONSTRAINT anomaly_whitelist_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.applied_operations
    ADD CONSTRAINT applied_operations_pkey PRIMARY KEY (operation_id);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_card_cycles
    ADD CONSTRAINT credit_card_cycles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_card_details
    ADD CONSTRAINT credit_card_details_pkey PRIMARY KEY (account_id);

ALTER TABLE ONLY public.credit_card_installments
    ADD CONSTRAINT credit_card_installments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_card_repayment_preferences
    ADD CONSTRAINT credit_card_repayment_preferences_pkey PRIMARY KEY (account_id);

ALTER TABLE ONLY public.credit_card_settlements
    ADD CONSTRAINT credit_card_settlements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_card_statement_strategies
    ADD CONSTRAINT credit_card_statement_strategies_pkey PRIMARY KEY (statement_id);

ALTER TABLE ONLY public.credit_card_statements
    ADD CONSTRAINT credit_card_statements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_pkey PRIMARY KEY (transaction_id);

ALTER TABLE ONLY public.daily_financial_report_evaluations
    ADD CONSTRAINT daily_financial_report_evaluations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_financial_reports
    ADD CONSTRAINT daily_financial_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_export_requests
    ADD CONSTRAINT data_export_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.debt_accounts
    ADD CONSTRAINT debt_accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.debt_strategy_preferences
    ADD CONSTRAINT debt_strategy_preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.edit_history
    ADD CONSTRAINT edit_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_condition_assessments
    ADD CONSTRAINT financial_condition_assessments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_obligations
    ADD CONSTRAINT financial_obligations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_plan_allocations
    ADD CONSTRAINT financial_plan_allocations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_plan_debt_reservations
    ADD CONSTRAINT financial_plan_debt_reservations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_plan_forecast_points
    ADD CONSTRAINT financial_plan_forecast_points_pkey PRIMARY KEY (plan_id, category_key);

ALTER TABLE ONLY public.financial_plan_savings_reservations
    ADD CONSTRAINT financial_plan_savings_reservations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_plans
    ADD CONSTRAINT financial_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hfce_category_defaults
    ADD CONSTRAINT hfce_category_defaults_pkey PRIMARY KEY (slug);

ALTER TABLE ONLY public.hfce_subcategory_defaults
    ADD CONSTRAINT hfce_subcategory_defaults_pkey PRIMARY KEY (slug);

ALTER TABLE ONLY public.income_sources
    ADD CONSTRAINT income_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.metro_manila_localities
    ADD CONSTRAINT metro_manila_localities_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.onboarding_sessions
    ADD CONSTRAINT onboarding_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.overspending_evaluations
    ADD CONSTRAINT overspending_evaluations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_device_tokens
    ADD CONSTRAINT push_device_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recurring_transaction_occurrences
    ADD CONSTRAINT recurring_transaction_occurrences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recurring_transaction_templates
    ADD CONSTRAINT recurring_transaction_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.savings_account_details
    ADD CONSTRAINT savings_account_details_pkey PRIMARY KEY (account_id);

ALTER TABLE ONLY public.savings_allocation_preferences
    ADD CONSTRAINT savings_allocation_preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.savings_goal_activities
    ADD CONSTRAINT savings_goal_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.savings_goals
    ADD CONSTRAINT savings_goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_debt_priorities
    ADD CONSTRAINT user_debt_priorities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_eligibility_profiles
    ADD CONSTRAINT user_eligibility_profiles_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_privacy_settings
    ADD CONSTRAINT user_privacy_settings_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alert_notification_preferences
    ADD CONSTRAINT alert_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alert_related_entities
    ADD CONSTRAINT alert_related_entities_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_alert_owner_fk FOREIGN KEY (created_from_alert_id, user_id) REFERENCES public.alerts(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_created_from_alert_id_fkey FOREIGN KEY (created_from_alert_id) REFERENCES public.alerts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alert_suppression_rules
    ADD CONSTRAINT alert_suppression_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_anomaly_evaluation_id_fkey FOREIGN KEY (anomaly_evaluation_id) REFERENCES public.anomaly_evaluations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_anomaly_evaluation_owner_fk FOREIGN KEY (anomaly_evaluation_id, user_id) REFERENCES public.anomaly_evaluations(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_daily_report_evaluation_id_fkey FOREIGN KEY (daily_report_evaluation_id) REFERENCES public.daily_financial_report_evaluations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_debt_account_id_fkey FOREIGN KEY (debt_account_id) REFERENCES public.debt_accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_debt_account_owner_fk FOREIGN KEY (debt_account_id, user_id) REFERENCES public.debt_accounts(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_overspending_evaluation_id_fkey FOREIGN KEY (overspending_evaluation_id) REFERENCES public.overspending_evaluations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_overspending_evaluation_owner_fk FOREIGN KEY (overspending_evaluation_id, user_id) REFERENCES public.overspending_evaluations(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_parent_alert_id_fkey FOREIGN KEY (parent_alert_id) REFERENCES public.alerts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_parent_owner_fk FOREIGN KEY (parent_alert_id, user_id) REFERENCES public.alerts(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_savings_goal_id_fkey FOREIGN KEY (savings_goal_id) REFERENCES public.savings_goals(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_savings_goal_owner_fk FOREIGN KEY (savings_goal_id, user_id) REFERENCES public.savings_goals(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_transaction_owner_fk FOREIGN KEY (transaction_id, user_id) REFERENCES public.transactions(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anomaly_evaluation_features
    ADD CONSTRAINT anomaly_evaluation_features_anomaly_evaluation_id_fkey FOREIGN KEY (anomaly_evaluation_id) REFERENCES public.anomaly_evaluations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anomaly_evaluations
    ADD CONSTRAINT anomaly_evaluations_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.anomaly_evaluations
    ADD CONSTRAINT anomaly_evaluations_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anomaly_evaluations
    ADD CONSTRAINT anomaly_evaluations_transaction_owner_fk FOREIGN KEY (transaction_id, user_id) REFERENCES public.transactions(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anomaly_evaluations
    ADD CONSTRAINT anomaly_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anomaly_whitelist_rules
    ADD CONSTRAINT anomaly_whitelist_rules_alert_owner_fk FOREIGN KEY (created_from_alert_id, user_id) REFERENCES public.alerts(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anomaly_whitelist_rules
    ADD CONSTRAINT anomaly_whitelist_rules_created_from_alert_id_fkey FOREIGN KEY (created_from_alert_id) REFERENCES public.alerts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anomaly_whitelist_rules
    ADD CONSTRAINT anomaly_whitelist_rules_created_from_anomaly_evaluation_id_fkey FOREIGN KEY (created_from_anomaly_evaluation_id) REFERENCES public.anomaly_evaluations(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anomaly_whitelist_rules
    ADD CONSTRAINT anomaly_whitelist_rules_evaluation_owner_fk FOREIGN KEY (created_from_anomaly_evaluation_id, user_id) REFERENCES public.anomaly_evaluations(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.anomaly_whitelist_rules
    ADD CONSTRAINT anomaly_whitelist_rules_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.anomaly_whitelist_rules
    ADD CONSTRAINT anomaly_whitelist_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.applied_operations
    ADD CONSTRAINT applied_operations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_cycles
    ADD CONSTRAINT credit_card_cycles_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_cycles
    ADD CONSTRAINT credit_card_cycles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_details
    ADD CONSTRAINT credit_card_details_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_details
    ADD CONSTRAINT credit_card_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_installments
    ADD CONSTRAINT credit_card_installments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_installments
    ADD CONSTRAINT credit_card_installments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.credit_card_cycles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.credit_card_statements(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.credit_card_payments
    ADD CONSTRAINT credit_card_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_repayment_preferences
    ADD CONSTRAINT credit_card_repayment_preferences_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_repayment_preferences
    ADD CONSTRAINT credit_card_repayment_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_settlements
    ADD CONSTRAINT credit_card_settlements_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.credit_card_installments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_settlements
    ADD CONSTRAINT credit_card_settlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_statement_strategies
    ADD CONSTRAINT credit_card_statement_strategies_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.credit_card_statements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_statement_strategies
    ADD CONSTRAINT credit_card_statement_strategies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_statements
    ADD CONSTRAINT credit_card_statements_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.credit_card_cycles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_statements
    ADD CONSTRAINT credit_card_statements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.credit_card_cycles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.credit_card_installments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.daily_financial_report_evaluations
    ADD CONSTRAINT daily_financial_report_evaluations_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.daily_financial_reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.daily_financial_reports
    ADD CONSTRAINT daily_financial_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.data_export_requests
    ADD CONSTRAINT data_export_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.debt_accounts
    ADD CONSTRAINT debt_accounts_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.debt_accounts
    ADD CONSTRAINT debt_accounts_linked_account_owner_fk FOREIGN KEY (linked_account_id, user_id) REFERENCES public.financial_accounts(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.debt_accounts
    ADD CONSTRAINT debt_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_account_owner_fk FOREIGN KEY (debt_account_id, user_id) REFERENCES public.debt_accounts(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_debt_account_id_fkey FOREIGN KEY (debt_account_id) REFERENCES public.debt_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_transaction_owner_fk FOREIGN KEY (transaction_id, user_id) REFERENCES public.transactions(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.debt_strategy_preferences
    ADD CONSTRAINT debt_strategy_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.edit_history
    ADD CONSTRAINT edit_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_condition_assessments
    ADD CONSTRAINT financial_condition_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_obligations
    ADD CONSTRAINT financial_obligations_recurring_template_id_fkey FOREIGN KEY (recurring_template_id) REFERENCES public.recurring_transaction_templates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.financial_obligations
    ADD CONSTRAINT financial_obligations_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.financial_obligations
    ADD CONSTRAINT financial_obligations_template_owner_fk FOREIGN KEY (recurring_template_id, user_id) REFERENCES public.recurring_transaction_templates(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.financial_obligations
    ADD CONSTRAINT financial_obligations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_plan_allocations
    ADD CONSTRAINT financial_plan_allocations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);

ALTER TABLE ONLY public.financial_plan_allocations
    ADD CONSTRAINT financial_plan_allocations_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.financial_plans(id);

ALTER TABLE ONLY public.financial_plan_allocations
    ADD CONSTRAINT financial_plan_allocations_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id);

ALTER TABLE ONLY public.financial_plan_debt_reservations
    ADD CONSTRAINT financial_plan_debt_reservations_credit_card_statement_id_fkey FOREIGN KEY (credit_card_statement_id) REFERENCES public.credit_card_statements(id);

ALTER TABLE ONLY public.financial_plan_debt_reservations
    ADD CONSTRAINT financial_plan_debt_reservations_debt_account_id_fkey FOREIGN KEY (debt_account_id) REFERENCES public.debt_accounts(id);

ALTER TABLE ONLY public.financial_plan_debt_reservations
    ADD CONSTRAINT financial_plan_debt_reservations_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.financial_plans(id);

ALTER TABLE ONLY public.financial_plan_forecast_points
    ADD CONSTRAINT financial_plan_forecast_points_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.financial_plans(id);

ALTER TABLE ONLY public.financial_plan_savings_reservations
    ADD CONSTRAINT financial_plan_savings_reservations_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.financial_plans(id);

ALTER TABLE ONLY public.financial_plan_savings_reservations
    ADD CONSTRAINT financial_plan_savings_reservations_savings_goal_id_fkey FOREIGN KEY (savings_goal_id) REFERENCES public.savings_goals(id);

ALTER TABLE ONLY public.financial_plans
    ADD CONSTRAINT financial_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.income_sources
    ADD CONSTRAINT income_sources_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.income_sources
    ADD CONSTRAINT income_sources_recurring_template_id_fkey FOREIGN KEY (recurring_template_id) REFERENCES public.recurring_transaction_templates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.income_sources
    ADD CONSTRAINT income_sources_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.income_sources
    ADD CONSTRAINT income_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.onboarding_sessions
    ADD CONSTRAINT onboarding_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.overspending_evaluations
    ADD CONSTRAINT overspending_evaluations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.overspending_evaluations
    ADD CONSTRAINT overspending_evaluations_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.overspending_evaluations
    ADD CONSTRAINT overspending_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_device_tokens
    ADD CONSTRAINT push_device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_occurrences
    ADD CONSTRAINT recurring_transaction_occurrences_generated_transaction_id_fkey FOREIGN KEY (generated_transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_occurrences
    ADD CONSTRAINT recurring_transaction_occurrences_generated_tx_owner_fk FOREIGN KEY (generated_transaction_id, user_id) REFERENCES public.transactions(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_occurrences
    ADD CONSTRAINT recurring_transaction_occurrences_recurring_template_id_fkey FOREIGN KEY (recurring_template_id) REFERENCES public.recurring_transaction_templates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_occurrences
    ADD CONSTRAINT recurring_transaction_occurrences_template_owner_fk FOREIGN KEY (recurring_template_id, user_id) REFERENCES public.recurring_transaction_templates(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_occurrences
    ADD CONSTRAINT recurring_transaction_occurrences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_templates
    ADD CONSTRAINT recurring_transaction_templates_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_templates
    ADD CONSTRAINT recurring_transaction_templates_destination_account_owner_fk FOREIGN KEY (destination_account_id, user_id) REFERENCES public.financial_accounts(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_templates
    ADD CONSTRAINT recurring_transaction_templates_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_templates
    ADD CONSTRAINT recurring_transaction_templates_source_account_owner_fk FOREIGN KEY (source_account_id, user_id) REFERENCES public.financial_accounts(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurring_transaction_templates
    ADD CONSTRAINT recurring_transaction_templates_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.recurring_transaction_templates
    ADD CONSTRAINT recurring_transaction_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.savings_account_details
    ADD CONSTRAINT savings_account_details_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.savings_account_details
    ADD CONSTRAINT savings_account_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.savings_allocation_preferences
    ADD CONSTRAINT savings_allocation_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.savings_goal_activities
    ADD CONSTRAINT savings_goal_activities_savings_goal_id_fkey FOREIGN KEY (savings_goal_id) REFERENCES public.savings_goals(id);

ALTER TABLE ONLY public.savings_goal_activities
    ADD CONSTRAINT savings_goal_activities_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);

ALTER TABLE ONLY public.savings_goal_activities
    ADD CONSTRAINT savings_goal_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.savings_goals
    ADD CONSTRAINT savings_goals_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.savings_goals
    ADD CONSTRAINT savings_goals_linked_account_owner_fk FOREIGN KEY (linked_account_id, user_id) REFERENCES public.financial_accounts(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.savings_goals
    ADD CONSTRAINT savings_goals_linked_subcategory_id_fkey FOREIGN KEY (linked_subcategory_id) REFERENCES public.subcategories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.savings_goals
    ADD CONSTRAINT savings_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_destination_account_owner_fk FOREIGN KEY (destination_account_id, user_id) REFERENCES public.financial_accounts(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_destination_savings_goal_id_fkey FOREIGN KEY (destination_savings_goal_id) REFERENCES public.savings_goals(id);

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_recurring_template_id_fkey FOREIGN KEY (recurring_template_id) REFERENCES public.recurring_transaction_templates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_recurring_template_owner_fk FOREIGN KEY (recurring_template_id, user_id) REFERENCES public.recurring_transaction_templates(id, user_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.financial_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_source_account_owner_fk FOREIGN KEY (source_account_id, user_id) REFERENCES public.financial_accounts(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_source_savings_goal_id_fkey FOREIGN KEY (source_savings_goal_id) REFERENCES public.savings_goals(id);

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_debt_priorities
    ADD CONSTRAINT user_debt_priorities_account_owner_fk FOREIGN KEY (debt_account_id, user_id) REFERENCES public.debt_accounts(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_debt_priorities
    ADD CONSTRAINT user_debt_priorities_debt_account_id_fkey FOREIGN KEY (debt_account_id) REFERENCES public.debt_accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_debt_priorities
    ADD CONSTRAINT user_debt_priorities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_eligibility_profiles
    ADD CONSTRAINT user_eligibility_profiles_metro_manila_locality_code_fkey FOREIGN KEY (metro_manila_locality_code) REFERENCES public.metro_manila_localities(code) ON DELETE RESTRICT;

ALTER TABLE ONLY public.user_eligibility_profiles
    ADD CONSTRAINT user_eligibility_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_privacy_settings
    ADD CONSTRAINT user_privacy_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
