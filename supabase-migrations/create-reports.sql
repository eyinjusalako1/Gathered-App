CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  content_id TEXT,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx ON public.reports (reported_user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporter can create report" ON public.reports;
CREATE POLICY "Reporter can create report"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Reporter can read own reports" ON public.reports;
CREATE POLICY "Reporter can read own reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());



