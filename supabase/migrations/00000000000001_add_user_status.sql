-- Add status column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended'));

-- Backfill: mark existing active users
UPDATE public.profiles SET status = 'active' WHERE is_active = true;

-- Replace the trigger function to handle status on new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, is_active, status)
  VALUES (
    new.id,
    'user',
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.email_confirmed_at IS NOT NULL, false),
    CASE WHEN new.email_confirmed_at IS NOT NULL THEN 'active' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
