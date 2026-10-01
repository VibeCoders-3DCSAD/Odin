-- Classification V2 supersedes this questionnaire classifier.
DROP FUNCTION IF EXISTS public.submit_onboarding_session_with_classification(
  uuid,
  uuid,
  odin_financial_profile_label,
  numeric,
  text,
  text
);
