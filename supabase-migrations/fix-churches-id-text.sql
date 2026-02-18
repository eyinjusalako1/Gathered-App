-- Ensure churches.id is TEXT (for stable external IDs like node:123)

ALTER TABLE public.churches DROP CONSTRAINT IF EXISTS churches_pkey;

ALTER TABLE public.churches
ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE public.churches
ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.churches
ADD PRIMARY KEY (id);




