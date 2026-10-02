import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, List, Loader2, Lock, MapPin, Plus, Search, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { scrapeBusinesses, loadMoreResults } from "@/lib/scraper.functions";
import { getMyPlan } from "@/lib/subscription.functions";
import { getGoogleStatus, startGoogleConnect, completeGoogleConnect, disconnectGoogle } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/scraper")({
  head: () => ({
    meta: [
      { title: "Lead Finder — LeadPilot" },
      {
        name: "description",
        content:
          "Find B2B businesses by type and country, save them to your own spreadsheet, and add them to your pipeline.",
      },
      { property: "og:title", content: "Lead Finder — LeadPilot" },
      {
        property: "og:description",
        content:
          "Find B2B businesses by type and country, save them to your own spreadsheet, and add them to your pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScraperPage,
});

function waitForOAuth(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    };
    const onMessage = (e: MessageEvent) => {
      const type = e.data?.type;
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.connectorId !== "google_sheets") return;
      if (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed") return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") resolve(typeof e.data.code === "string" ? e.data.code : null);
      else reject(new Error("Connection failed."));
    };
    window.addEventListener("message", onMessage);
    const poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Connection window closed before finishing."));
    }, 500);
  });
}

function ScraperPage() {
  const run = useServerFn(scrapeBusinesses);
  const more = useServerFn(loadMoreResults);
  const status = useServerFn(getGoogleStatus);
  const fetchPlan = useServerFn(getMyPlan);
  const startConnect = useServerFn(startGoogleConnect);
  const complete = useServerFn(completeGoogleConnect);
  const disconnect = useServerFn(disconnectGoogle);
  const queryClient = useQueryClient();
  const [businessType, setBusinessType] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [moreId, setMoreId] = useState<string | null>(null);

  const { data: google, isLoading: googleLoading } = useQuery({ queryKey: ["google_status"], queryFn: () => status() });
  const { data: mine } = useQuery({ queryKey: ["my_plan"], queryFn: () => fetchPlan() });

  const { data: jobs = [] } = useQuery({
    queryKey: ["scrape_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scrape_jobs").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });

  async function connect() {
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) {
      toast.error("Please allow popups and try again.");
      return;
    }
    setConnecting(true);
    try {
      const { authorizationUrl } = await startConnect();
      const done = waitForOAuth(popup);
      popup.location.href = authorizationUrl;
      const code = await done;
      if (code) await complete({ data: { code } });
      await queryClient.invalidateQueries({ queryKey: ["google_status"] });
      toast.success(google?.connected ? "Reconnected" : "Account connected");
    } catch (err) {
      popup.close();
      toast.error(err instanceof Error ? err.message : "Couldn't connect your account");
    } finally {
      setConnecting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await run({ data: { businessType, country } });
      toast.success(`Found ${res.found} businesses — ${res.added} new added`);
      queryClient.invalidateQueries({ queryKey: ["scrape_jobs"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["my_plan"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore(jobId: string) {
    setMoreId(jobId);
    try {
      const res = await more({ data: { jobId } });
      if (res.done && res.added === 0 && res.areas.length === 0) toast.info("No more areas left to search for this one.");
      else toast.success(`${res.added} more businesses added from ${res.areas.join(", ")}${res.remaining ? ` · ${res.remaining} areas left` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["scrape_jobs"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["my_plan"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load more");
    } finally {
      setMoreId(null);
    }
  }

  const left = mine ? Math.max(0, mine.limits.searchesPerMonth - mine.usage.searchesUsed) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">LeadPilot</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard"><ArrowLeft className="size-4" /> Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <h1 className="text-3xl font-bold tracking-tight">Lead finder</h1>
        <p className="mt-1 text-muted-foreground">
          Search businesses by type and country and view the results right here — a backup copy is kept in your
          Drive.
        </p>

        {mine && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold capitalize text-foreground">{mine.plan ?? "trial"}</span>{" "}
              · {left} of {mine.limits.searchesPerMonth} searches left this month ·{" "}
              {mine.usage.businessesFound} of {mine.limits.businessesPerMonth} businesses saved
            </span>
            {mine.status !== "active" && (
              <Button asChild size="sm">
                <Link to="/pricing">Choose a plan</Link>
              </Button>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="text-sm">
            {googleLoading ? "Checking connection…" : google?.connected ? (
              <span>Account connected · results are backed up to your Drive automatically</span>
            ) : (
              <span className="text-muted-foreground">Connect your account so results are saved to your Drive.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={google?.connected ? "outline" : "default"} onClick={connect} disabled={connecting}>
              {connecting && <Loader2 className="size-4 animate-spin" />}
              {google?.connected ? "Reconnect" : "Connect account"}
            </Button>
            {google?.connected && (
              <Button size="sm" variant="ghost" onClick={async () => { await disconnect(); queryClient.invalidateQueries({ queryKey: ["google_status"] }); toast.success("Disconnected"); }}>
                Disconnect
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="type">Business type</Label>
            <Input id="type" required placeholder="e.g. dental clinics" value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="country">Country</Label>
            <Input id="country" required placeholder="e.g. Rwanda" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading || !google?.connected}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {loading ? "Searching…" : "Find leads"}
          </Button>
        </form>

        <h2 className="mt-10 text-lg font-semibold">Your searches</h2>
        <div className="mt-3 space-y-2">
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">No searches yet.</p>}
          {jobs.map((j) => {
            const areasLeft = j.regions ? j.regions.length - j.region_index : null;
            return (
              <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-medium">{j.business_type} <span className="text-muted-foreground">in</span> {j.country}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground font-mono">
                    <MapPin className="size-3" /> {j.result_count} businesses · {new Date(j.created_at).toLocaleString()}
                    {areasLeft !== null && ` · ${areasLeft} areas left`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {j.spreadsheet_id && areasLeft !== 0 && (
                    mine?.limits.loadMore ? (
                      <Button size="sm" onClick={() => loadMore(j.id)} disabled={moreId === j.id || !google?.connected}>
                        {moreId === j.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Load more
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/pricing"><Lock className="size-4" /> Deep search</Link>
                      </Button>
                    )
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to="/leads" search={{ job: j.id }}><List className="size-4" /> View leads</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
