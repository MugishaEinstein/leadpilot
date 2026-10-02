import { supabase } from "@/integrations/supabase/client";

// The database returns at most 1000 rows per request; page through to get everything.
export async function fetchAllLeads<T = Record<string, unknown>>(columns: string, filter?: { jobId?: string }): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = supabase.from("leads").select(columns).order("created_at", { ascending: false }).range(from, from + size - 1);
    if (filter?.jobId) q = q.eq("scrape_job_id", filter.jobId);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}
