import { createFileRoute, Link } from "@tanstack/react-router";
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
import { fetchAllLeads } from "@/lib/fetchAll";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Pipeline Dashboard — LeadPilot" },
      {
        name: "description",
        content: "Track AI-scored leads, priorities, and follow-ups in your LeadPilot pipeline.",
      },
      { property: "og:title", content: "Pipeline Dashboard — LeadPilot" },
      {
        property: "og:description",
        content: "Track AI-scored leads, priorities, and follow-ups in your LeadPilot pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Lead = Tables<"leads">;

const scoreBadge: Record<string, { label: string; className: string; icon: typeof Flame }> = {
  hot: { label: "Hot", className: "bg-hot text-hot-foreground", icon: Flame },
  warm: { label: "Warm", className: "bg-warm text-warm-foreground", icon: Thermometer },
  cold: { label: "Cold", className: "bg-cold text-cold-foreground", icon: Snowflake },
};

const statuses = ["new", "contacted", "qualified", "converted", "lost"] as const;

function Dashboard() {
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

  const hot = leads.filter((l) => l.score === "hot").length;
  const warm = leads.filter((l) => l.score === "warm").length;
  const cold = leads.filter((l) => l.score === "cold").length;
  const converted = leads.filter((l) => l.status === "converted").length;

  const [sort, setSort] = useState<string>("newest");
  const scoreRank: Record<string, number> = { hot: 0, warm: 1, cold: 2 };
  const sorted = [...leads].sort((a, b) => {
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

  const stats = [
    { label: "Total leads", value: leads.length, icon: Users },
    { label: "Hot", value: hot, icon: Flame, className: "text-hot" },
    { label: "Warm", value: warm, icon: Thermometer, className: "text-warm" },
    { label: "Cold", value: cold, icon: Snowflake, className: "text-cold" },
    { label: "Converted", value: converted, icon: TrendingUp, className: "text-primary" },
  ];

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
            <Link to="/insights">Insights</Link>
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
        <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-muted-foreground">
          Every lead, AI-scored and ready for follow-up.
        </p>

        {mine && mine.status !== "active" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            <span className="text-muted-foreground">
              {mine.status === "pending"
                ? `Your ${mine.plan} request is waiting for payment confirmation — meanwhile you're on a free trial.`
                : "You're on the free trial. Choose a plan to unlock more searches."}
            </span>
            <Button asChild size="sm">
              <Link to="/pricing">See plans</Link>
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <s.icon className={`size-4 ${s.className ?? ""}`} />
                {s.label}
              </div>
              <p className="mt-2 text-3xl font-bold font-mono">{isLoading ? "…" : s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link to="/leads"><Users className="size-4" /> View all leads</Link></Button>
          <Button asChild variant="outline"><Link to="/leads" search={{ score: "hot" }}><Flame className="size-4" /> Hot leads</Link></Button>
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
