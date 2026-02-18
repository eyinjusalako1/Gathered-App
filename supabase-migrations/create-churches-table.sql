-- Create Churches Table
-- This table stores church information for discovery

CREATE TABLE IF NOT EXISTS public.churches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  postcode TEXT,
  address TEXT,
  denomination TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active churches
CREATE POLICY "Anyone can view active churches"
  ON public.churches
  FOR SELECT
  USING (is_active = true);

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_churches_is_active ON public.churches(is_active);
CREATE INDEX IF NOT EXISTS idx_churches_city ON public.churches(city);
CREATE INDEX IF NOT EXISTS idx_churches_name ON public.churches(name);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_churches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_churches_updated_at
BEFORE UPDATE ON public.churches
FOR EACH ROW
EXECUTE FUNCTION public.update_churches_updated_at();





