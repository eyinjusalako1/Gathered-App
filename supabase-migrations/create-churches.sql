-- Create Churches Table for external sources (OSM)
-- Stores stable external church IDs and metadata

CREATE TABLE IF NOT EXISTS public.churches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  city TEXT,
  postcode TEXT,
  denomination TEXT,
  website TEXT,
  source TEXT NOT NULL DEFAULT 'osm',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can read churches"
  ON public.churches
  FOR SELECT
  TO authenticated
  USING (true);

-- Update updated_at
CREATE OR REPLACE FUNCTION public.update_churches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_churches_updated_at ON public.churches;
CREATE TRIGGER update_churches_updated_at
BEFORE UPDATE ON public.churches
FOR EACH ROW
EXECUTE FUNCTION public.update_churches_updated_at();

-- Best-effort schema alignment if table already exists
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'osm';
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS denomination TEXT;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS website TEXT;




