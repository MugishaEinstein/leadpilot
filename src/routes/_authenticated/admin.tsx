import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, ShieldCheck, X, Zap } from "lucide-react";
import { getMyPlan, listSubscriptions, setSubscriptionStatus } from "@/lib/subscription.functions";
import { planLabel } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Payments Admin — LeadPilot" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const filters = ["pending", "active", "all"] as const;
type Filter = (typeof filters)[number];

function statusClass(status: string) {
  if (status === "active") return "bg-hot text-hot-foreground";
  if (status === "pending") return "bg-warm text-warm-foreground";
  return "bg-secondary text-secondary-foreground";
}

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchPlan = useServerFn(getMyPlan);
  const fetchRows = useServerFn(listSubscriptions);
  const setStatus = useServerFn(setSubscriptionStatus);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ["my_plan"],
    queryFn: () => fetchPlan(),
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["subscriptions"],
    enabled: !!mine?.isAdmin,
    queryFn: () => fetchRows(),
  });

  async function update(id: string, status: "active" | "declined" | "cancelled") {
    setBusyId(id);
    try {
      const res = await setStatus({ data: { id, status } });
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["my_plan"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    } finally {
      setBusyId(null);
    }
  }

  if (mineLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking access…
      </div>
    );
  }

  if (!mine?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-semibold">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This page is for the team that confirms payments. Your account doesn't have access.
          </p>
          <Button asChild className="mt-5" size="sm" variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const shown = rows.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">LeadPilot</span>
          <Badge variant="outline" className="ml-1 font-mono text-xs">
            admin
          </Badge>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <h1 className="text-3xl font-bold tracking-tight">Plan requests</h1>
        <p className="mt-1 text-muted-foreground">
          Confirm a payment and that person's plan unlocks straight away for 30 days.
        </p>

        <div className="mt-6 flex gap-2">
          {filters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)}
              <span className="ml-1 font-mono text-xs opacity-70">
                {f === "all" ? rows.length : rows.filter((r) => r.status === f).length}
              </span>
            </Button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading requests…
            </div>
          )}
          {!isLoading && shown.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Nothing here right now.
            </div>
          )}
          {shown.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold break-all">{r.email ?? r.user_id}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {planLabel(r.plan)} · ${Number(r.amount)} / month ·{" "}
                    {new Date(r.requested_at).toLocaleString()}
                  </p>
                  {r.payment_reference && (
                    <p className="mt-1 text-xs font-mono text-muted-foreground">
                      ref: {r.payment_reference}
                    </p>
                  )}
                  {r.note && <p className="mt-1 text-xs italic text-muted-foreground">{r.note}</p>}
                  {r.expires_at && r.status === "active" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      active until {new Date(r.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusClass(r.status)}>{r.status}</Badge>
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" disabled={busyId === r.id} onClick={() => update(r.id, "active")}>
                        {busyId === r.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Confirm payment
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === r.id}
                        onClick={() => update(r.id, "declined")}
                      >
                        <X className="size-4" /> Decline
                      </Button>
                    </>
                  )}
                  {r.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => update(r.id, "cancelled")}
                    >
                      Cancel access
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
