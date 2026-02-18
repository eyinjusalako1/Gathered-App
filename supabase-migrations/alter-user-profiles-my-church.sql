-- Add my_church_id to user_profiles

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS my_church_id TEXT REFERENCES public.churches(id);


