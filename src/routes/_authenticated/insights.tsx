import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { fetchAllLeads } from "@/lib/fetchAll";
import { getMyPlan } from "@/lib/subscription.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — LeadPilot" },
      { name: "description", content: "See trends across your leads: scores, statuses, top categories and countries." },
      { property: "og:title", content: "Insights — LeadPilot" },
      { property: "og:description", content: "See trends across your leads: scores, statuses, top categories and countries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
});

function count<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || "Unknown";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const pct = (v: number, t: number) => `${t ? Math.round((v / t) * 100) : 0}%`;

function Bars({ title, field, data, total }: { title: string; field: "score" | "status" | "category" | "country"; data: [string, number][]; total: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        {data.slice(0, 8).map(([k, v]) => (
          <Link key={k} to="/leads" search={{ [field]: k }} className="block rounded-md p-1 -m-1 transition-colors hover:bg-muted">
            <div className="flex justify-between text-sm"><span className="capitalize">{k}</span><span className="text-muted-foreground"><span className="font-semibold text-foreground">{pct(v, total)}</span> · {v}</span></div>
            <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(v / Math.max(total, 1)) * 100}%` }} /></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InsightsPage() {
  const fetchPlan = useServerFn(getMyPlan);
  const { data: mine, isLoading } = useQuery({ queryKey: ["my_plan"], queryFn: () => fetchPlan() });
  const allowed = mine?.status === "active" && (mine.plan === "growth" || mine.plan === "scale");

  const { data: leads = [] } = useQuery({
    queryKey: ["insights_leads"],
    enabled: allowed,
    queryFn: async () => {
      return fetchAllLeads<{ score: string | null; status: string; category: string | null; country: string | null; rating: number | null; phone: string | null; website: string | null; created_at: string }>("score,status,category,country,rating,phone,website,created_at");
    },
  });

  const total = leads.length;
  const withPhone = leads.filter((l) => l.phone).length;
  const withSite = leads.filter((l) => l.website).length;
  const rated = leads.filter((l) => l.rating != null);
  const avg = rated.length ? (rated.reduce((s, l) => s + Number(l.rating), 0) / rated.length).toFixed(1) : "—";
  const week = leads.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 864e5).length;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Button asChild variant="outline" size="sm"><Link to="/dashboard"><ArrowLeft className="size-4" /> Dashboard</Link></Button>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">Click any number or bar to see those leads.</p>
        {isLoading ? (
          <Loader2 className="mt-8 size-5 animate-spin" />
        ) : !allowed ? (
          <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
            <Lock className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-semibold">Insights are available on the Growth ($49) and Scale ($99) plans.</p>
            <Button asChild className="mt-4"><Link to="/pricing">See plans</Link></Button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-5">
              {([
                ["Total leads", total.toLocaleString(), "100% of your leads", {}],
                ["Added this week", pct(week, total), `${week} leads`, { recent: true }],
                ["With phone", pct(withPhone, total), `${withPhone} leads`, { has: "phone" }],
                ["With website", pct(withSite, total), `${withSite} leads`, { has: "website" }],
                ["Avg rating", avg, `${pct(rated.length, total)} rated`, { has: "rating" }],
              ] as const).map(([k, v, sub, search]) => (
                <Link key={k} to="/leads" search={search} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="mt-1 text-2xl font-bold">{v}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </Link>
              ))}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Bars title="By score" field="score" data={count(leads, (l) => l.score)} total={total} />
              <Bars title="By status" field="status" data={count(leads, (l) => l.status)} total={total} />
              <Bars title="Top categories" field="category" data={count(leads, (l) => l.category)} total={total} />
              <Bars title="Top countries" field="country" data={count(leads, (l) => l.country)} total={total} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
