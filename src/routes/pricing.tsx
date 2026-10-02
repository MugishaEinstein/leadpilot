import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLANS } from "@/lib/plans";
import { getMyPlan, requestPlan } from "@/lib/subscription.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — LeadPilot" },
      {
        name: "description",
        content:
          "Three LeadPilot plans at $39, $49 and $99 a month. Find B2B businesses, score them with AI, and automate follow-ups.",
      },
      { property: "og:title", content: "Plans & Pricing — LeadPilot" },
      {
        property: "og:description",
        content:
          "Three LeadPilot plans at $39, $49 and $99 a month. Find B2B businesses, score them with AI, and automate follow-ups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});

function useSession() {
  const { data } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  return data;
}

function Pricing() {
  const session = useSession();
  const queryClient = useQueryClient();
  const fetchPlan = useServerFn(getMyPlan);
  const ask = useServerFn(requestPlan);
  const [picked, setPicked] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: mine } = useQuery({
    queryKey: ["my_plan"],
    enabled: !!session,
    queryFn: () => fetchPlan(),
  });

  const plan = PLANS.find((p) => p.id === picked);

  async function submit() {
    if (!plan) return;
    setBusy(true);
    try {
      const res = await ask({ data: { plan: plan.id, paymentReference: reference || undefined } });
      toast.success(res.message);
      setPicked(null);
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["my_plan"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">LeadPilot</span>
        </Link>
        <div className="flex gap-2">
          {session ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Simple plans, <span className="text-primary text-glow">no surprises</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Pick the plan that fits how much outreach you run. Payment is confirmed by our team, and
            your plan unlocks the moment it clears.
          </p>
        </div>

        {mine && (mine.status === "pending" || mine.status === "active") && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-card p-4 text-center text-sm">
            {mine.status === "pending" ? (
              <>
                Your <span className="font-semibold capitalize">{mine.plan}</span> request is waiting for
                payment confirmation.
              </>
            ) : (
              <>
                You're on <span className="font-semibold capitalize">{mine.plan}</span> —{" "}
                {mine.usage.searchesUsed} of {mine.limits.searchesPerMonth} searches used this month
                {mine.expiresAt && ` · renews ${new Date(mine.expiresAt).toLocaleDateString()}`}.
              </>
            )}
          </div>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = mine?.status === "active" && mine.plan === p.id;
            const isPending = mine?.status === "pending" && mine.plan === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
                  p.highlight ? "border-primary card-glow" : "border-border"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h2 className="text-lg font-semibold">{p.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                <p className="mt-5">
                  <span className="text-4xl font-bold tracking-tight">${p.price}</span>
                  <span className="text-sm text-muted-foreground"> / month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={p.highlight ? "default" : "outline"}
                  disabled={isCurrent || isPending}
                  onClick={() => (session ? setPicked(p.id) : (window.location.href = "/auth"))}
                >
                  {isCurrent ? "Current plan" : isPending ? "Request sent" : `Choose ${p.label}`}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold">How payment works</h3>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>1. Choose a plan above — it takes a few seconds.</li>
            <li>2. We send you payment instructions by email.</li>
            <li>3. Pay, then reply with the payment reference (or paste it in the box).</li>
            <li>4. Our team confirms it and your plan unlocks straight away for 30 days.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Plans renew monthly. You can switch plans any time from this page.
          </p>
        </div>
      </main>

      <Dialog open={!!picked} onOpenChange={(open) => !open && setPicked(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request {plan?.label} — ${plan?.price}/month</DialogTitle>
            <DialogDescription>
              We'll email you payment instructions. Once our team confirms your payment, {plan?.label}{" "}
              unlocks for 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ref">Payment reference (optional)</Label>
            <Input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. transfer or mobile money ID"
            />
          </div>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Sending…" : "Send my request"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
