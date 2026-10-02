ALTER TABLE public.leads ADD COLUMN user_id uuid;
DROP INDEX IF EXISTS public.leads_place_id_key;
CREATE UNIQUE INDEX leads_user_place_key ON public.leads(user_id, place_id) WHERE place_id IS NOT NULL;
CREATE INDEX leads_user_id_idx ON public.leads(user_id);

DROP POLICY "Signed-in users read leads" ON public.leads;
DROP POLICY "Signed-in users update leads" ON public.leads;
DROP POLICY "Signed-in users delete leads" ON public.leads;
CREATE POLICY "Own or inbound leads read" ON public.leads FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Own or inbound leads update" ON public.leads FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Own leads delete" ON public.leads FOR DELETE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

ALTER TABLE public.scrape_jobs
  ADD COLUMN spreadsheet_id text,
  ADD COLUMN sheet_tab text,
  ADD COLUMN regions text[],
  ADD COLUMN region_index integer NOT NULL DEFAULT 0;
CREATE POLICY "Own jobs update" ON public.scrape_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_sheets (
  user_id uuid PRIMARY KEY,
  spreadsheet_id text NOT NULL,
  spreadsheet_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sheets TO authenticated;
GRANT ALL ON public.user_sheets TO service_role;
ALTER TABLE public.user_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sheet select" ON public.user_sheets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own sheet insert" ON public.user_sheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own sheet update" ON public.user_sheets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own sheet delete" ON public.user_sheets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;