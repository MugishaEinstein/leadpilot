ALTER TABLE public.leads
  ADD COLUMN phone text,
  ADD COLUMN website text,
  ADD COLUMN address text,
  ADD COLUMN country text,
  ADD COLUMN category text,
  ADD COLUMN rating numeric,
  ADD COLUMN review_count integer,
  ADD COLUMN maps_url text,
  ADD COLUMN place_id text;
ALTER TABLE public.leads ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_place_id_key ON public.leads(place_id) WHERE place_id IS NOT NULL;

DROP POLICY "Anyone can read leads" ON public.leads;
DROP POLICY "Anyone can update leads" ON public.leads;
DROP POLICY "Anyone can delete leads" ON public.leads;
CREATE POLICY "Signed-in users read leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users update leads" ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users delete leads" ON public.leads FOR DELETE TO authenticated USING (true);

CREATE TABLE public.scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type text NOT NULL,
  country text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  sheet_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrape_jobs TO authenticated;
GRANT ALL ON public.scrape_jobs TO service_role;
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own jobs select" ON public.scrape_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own jobs insert" ON public.scrape_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own jobs delete" ON public.scrape_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);