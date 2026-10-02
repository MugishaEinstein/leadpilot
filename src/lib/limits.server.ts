import { planById, planLabel, TRIAL_LIMITS, type Limits } from "./plans";

type Ctx = { supabase: any; userId: string };

export type PlanState = {
  plan: string | null;
  status: string;
  amount: number;
  expiresAt: string | null;
  paymentReference: string | null;
  requestedAt: string | null;
  limits: Limits;
  usage: { searchesUsed: number; businessesFound: number };
  isAdmin: boolean;
};

export function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function readMyPlan(ctx: Ctx): Promise<PlanState> {
  const since = monthStartIso();
  const [{ data: sub }, { count: searches }, { count: found }, admin] = await Promise.all([
    ctx.supabase
      .from("subscriptions")
      .select("plan, status, amount, payment_reference, requested_at, expires_at")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    ctx.supabase
      .from("scrape_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .gte("created_at", since),
    ctx.supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .gte("created_at", since),
    ctx.supabase.rpc("is_admin").then((r: { data: unknown }) => r.data === true),
  ]);

  let status: string = sub?.status ?? "none";
  if (status === "active" && sub?.expires_at && new Date(sub.expires_at).getTime() < Date.now()) {
    status = "expired";
  }

  const active = status === "active" ? planById(sub?.plan) : undefined;
  return {
    plan: active?.id ?? null,
    status,
    amount: Number(sub?.amount ?? 0),
    expiresAt: active ? sub.expires_at : null,
    paymentReference: sub?.payment_reference ?? null,
    requestedAt: sub?.requested_at ?? null,
    limits: active
      ? {
          searchesPerMonth: active.searchesPerMonth,
          businessesPerMonth: active.businessesPerMonth,
          loadMore: active.loadMore,
          seats: active.seats,
        }
      : { ...TRIAL_LIMITS },
    usage: { searchesUsed: searches ?? 0, businessesFound: found ?? 0 },
    isAdmin: admin,
  };
}

export function assertCanSearch(state: PlanState) {
  const label = planLabel(state.plan);
  if (state.usage.searchesUsed >= state.limits.searchesPerMonth) {
    throw new Error(
      state.plan
        ? `You've used all ${state.limits.searchesPerMonth} searches on ${label}. Upgrade for more, or wait for next month.`
        : "Your free trial search is used up. Choose a plan to keep going.",
    );
  }
  if (state.usage.businessesFound >= state.limits.businessesPerMonth) {
    throw new Error(
      state.plan
        ? `You've reached the ${label} limit of ${state.limits.businessesPerMonth} businesses this month.`
        : `Your trial saved ${state.limits.businessesPerMonth} businesses. Choose a plan to save more.`,
    );
  }
}

export function assertDeepSearch(state: PlanState) {
  if (!state.limits.loadMore) {
    throw new Error(
      state.plan
        ? `Deep search isn't part of ${planLabel(state.plan)}. Upgrade to keep adding cities.`
        : "Deep search needs a plan. Choose one to keep adding cities.",
    );
  }
}

export function remainingBusinesses(state: PlanState) {
  return Math.max(0, state.limits.businessesPerMonth - state.usage.businessesFound);
}
