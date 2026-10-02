ALTER TABLE public.leads ADD COLUMN scrape_job_id uuid REFERENCES public.scrape_jobs(id) ON DELETE SET NULL;
CREATE INDEX leads_scrape_job_id_idx ON public.leads(scrape_job_id);