CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')), '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_privacy_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_eligibility_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ponytail: backfill existing users who lack an eligibility profile
INSERT INTO public.user_eligibility_profiles (user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.user_eligibility_profiles e ON e.user_id = u.id
WHERE e.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
