import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { fetchAllLeads } from "@/lib/fetchAll";
import { X } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Zap,
  ArrowLeft,
  Flame,
  Thermometer,
  Snowflake,
  Mail,
  Loader2,
  Trash2,
  Users,
  TrendingUp,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { draftFollowUp } from "@/lib/leads.functions";
import { getMyPlan } from "@/lib/subscription.functions";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/leads")({
  validateSearch: z.object({
    score: z.string().optional(),
    status: z.string().optional(),
    category: z.string().optional(),
    country: z.string().optional(),
    has: z.enum(["phone", "website", "rating"]).optional(),
    recent: z.boolean().optional(),
    job: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "All Leads — LeadPilot" },
      {
        name: "description",
        content: "Browse, filter and sort every business lead you have found with LeadPilot.",
      },
      { property: "og:title", content: "All Leads — LeadPilot" },
      {
        property: "og:description",
        content: "Browse, filter and sort every business lead you have found with LeadPilot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});

type Lead = Tables<"leads">;

const scoreBadge: Record<string, { label: string; className: string; icon: typeof Flame }> = {
  hot: { label: "Hot", className: "bg-hot text-hot-foreground", icon: Flame },
  warm: { label: "Warm", className: "bg-warm text-warm-foreground", icon: Thermometer },
  cold: { label: "Cold", className: "bg-cold text-cold-foreground", icon: Snowflake },
};

const statuses = ["new", "contacted", "qualified", "converted", "lost"] as const;

function LeadsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const runDraft = useServerFn(draftFollowUp);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lead: Lead; text: string } | null>(null);

  const fetchPlan = useServerFn(getMyPlan);
  const { data: mine } = useQuery({ queryKey: ["my_plan"], queryFn: () => fetchPlan() });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      return fetchAllLeads<Lead>("*");
    },
  });


  const [sort, setSort] = useState<string>("newest");
  const scoreRank: Record<string, number> = { hot: 0, warm: 1, cold: 2 };
  const norm = (v: string | null) => v || "Unknown";
  const weekAgo = Date.now() - 7 * 864e5;
  const filtered = leads.filter((l) =>
    (!search.score || norm(l.score) === search.score) &&
    (!search.status || norm(l.status) === search.status) &&
    (!search.category || norm(l.category) === search.category) &&
    (!search.country || norm(l.country) === search.country) &&
    (!search.job || l.scrape_job_id === search.job) &&
    (!search.recent || new Date(l.created_at).getTime() >= weekAgo) &&
    (search.has !== "phone" || !!l.phone) &&
    (search.has !== "website" || !!l.website) &&
    (search.has !== "rating" || l.rating != null));
  const activeFilters = Object.entries(search).filter(([, v]) => v !== undefined);
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "oldest": return a.created_at.localeCompare(b.created_at);
      case "name": return a.name.localeCompare(b.name);
      case "score": return (scoreRank[a.score ?? ""] ?? 3) - (scoreRank[b.score ?? ""] ?? 3);
      case "rating": return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      case "reviews": return (b.review_count ?? 0) - (a.review_count ?? 0);
      case "status": return statuses.indexOf(a.status as never) - statuses.indexOf(b.status as never);
      case "country": return (a.country ?? "").localeCompare(b.country ?? "");
      default: return b.created_at.localeCompare(a.created_at);
    }
  });

  async function handleDraft(lead: Lead) {
    setDraftingId(lead.id);
    try {
      const text = await runDraft({
        data: {
          name: lead.name,
          company: lead.company ?? undefined,
          message: lead.message,
          score: (lead.score as "hot" | "warm" | "cold") ?? "warm",
        },
      });
      await supabase.from("leads").update({ follow_up_draft: text }).eq("id", lead.id);
      setDraft({ lead, text });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't generate the follow-up. Try again.");
    } finally {
      setDraftingId(null);
    }
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error("Couldn't update status");
    else queryClient.invalidateQueries({ queryKey: ["leads"] });
  }

  async function deleteLead(id: string) {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) toast.error("Couldn't delete lead");
    else {
      toast.success("Lead removed");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    }
  }

  
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">LeadPilot</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {mine && (
            <Badge variant="outline" className="font-mono text-xs capitalize">
              {mine.plan ?? "trial"} ·{" "}
              {Math.max(0, mine.limits.searchesPerMonth - mine.usage.searchesUsed)} searches left
            </Badge>
          )}
          <Button asChild size="sm">
            <Link to="/scraper">
              <Search className="size-4" /> Find leads
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/pricing">Pricing</Link>
          </Button>
          {mine?.isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Payments</Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" /> Capture form
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="mt-1 text-muted-foreground">
          {isLoading ? "Loading…" : `Showing ${filtered.length} of ${leads.length} leads`}
        </p>



        {/* Leads */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {activeFilters.map(([k, v]) => (
            <Badge key={k} variant="outline" className="gap-1 capitalize">
              {k === "has" ? `Has ${v}` : k === "recent" ? "Added this week" : k === "job" ? "One search" : `${k}: ${v}`}
              <button aria-label={`Remove ${k} filter`} onClick={() => navigate({ search: (p) => ({ ...p, [k]: undefined }) })}><X className="size-3" /></button>
            </Badge>
          ))}
          {activeFilters.length > 0 && <Button size="sm" variant="ghost" onClick={() => navigate({ search: {} })}>Clear filters</Button>}
          <span className="ml-auto text-sm text-muted-foreground">Sort by</span>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="score">Score (hot first)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="rating">Rating (highest)</SelectItem>
              <SelectItem value="reviews">Most reviews</SelectItem>
              <SelectItem value="country">Country</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-12 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading leads…
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <p className="font-semibold">No leads match</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit the capture form on the home page to see AI scoring in action.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link to="/">Capture a lead</Link>
              </Button>
            </div>
          )}

          {sorted.map((lead) => {
            const badge = scoreBadge[lead.score ?? "warm"] ?? scoreBadge["warm"]!;
            return (
              <div
                key={lead.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 animate-fade-up sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{lead.name}</span>
                    <Badge className={badge.className}>
                      <badge.icon className="size-3" /> {badge.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[lead.email, lead.company !== lead.name ? lead.company : null, lead.phone, lead.address]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {(lead.website || lead.maps_url) && (
                    <p className="mt-1 flex gap-3 text-xs">
                      {lead.website && (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="text-primary underline">
                          Website
                        </a>
                      )}
                      {lead.maps_url && (
                        <a href={lead.maps_url} target="_blank" rel="noreferrer" className="text-primary underline">
                          Listing{lead.rating ? ` · ★ ${lead.rating}` : ""}
                        </a>
                      )}
                    </p>
                  )}
                  <p className="mt-2 text-sm leading-relaxed">{lead.message}</p>
                  {lead.score_reason && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      AI: {lead.score_reason}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <Select
                    value={lead.status}
                    onValueChange={(v) => updateStatus(lead.id, v)}
                  >
                    <SelectTrigger className="w-36 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={lead.follow_up_draft ? "outline" : "default"}
                      disabled={draftingId === lead.id}
                      onClick={() =>
                        lead.follow_up_draft
                          ? setDraft({ lead, text: lead.follow_up_draft })
                          : handleDraft(lead)
                      }
                    >
                      {draftingId === lead.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Mail className="size-4" />
                      )}
                      {lead.follow_up_draft ? "View draft" : "Draft follow-up"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteLead(lead.id)}
                      aria-label="Delete lead"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Follow-up for {draft?.lead.name}</DialogTitle>
          </DialogHeader>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary p-4 font-sans text-sm leading-relaxed">
            {draft?.text}
          </pre>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(draft?.text ?? "");
              toast.success("Copied to clipboard");
            }}
          >
            Copy email
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
