ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS discoverable BOOLEAN DEFAULT TRUE;

UPDATE public.user_profiles
SET discoverable = TRUE
WHERE discoverable IS NULL;



