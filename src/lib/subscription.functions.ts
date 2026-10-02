import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, planById, type Limits, type PlanId } from "./plans";
import { readMyPlan, type PlanState } from "./limits.server";

type Ctx = { supabase: any; userId: string };

export type MyPlan = PlanState;
export type { Limits };

export type SubscriptionRow = {
  id: string;
  user_id: string;
  email: string | null;
  plan: PlanId;
  status: string;
  amount: number;
  payment_reference: string | null;
  note: string | null;
  requested_at: string;
  confirmed_at: string | null;
  expires_at: string | null;
};

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readMyPlan(context as unknown as Ctx));

export const requestPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        plan: z.enum(PLANS.map((p) => p.id) as [PlanId, ...PlanId[]]),
        paymentReference: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const plan = planById(data.plan)!;
    const { data: existing } = await ctx.supabase
      .from("subscriptions")
      .select("id, plan, status")
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (existing && existing.plan === data.plan && (existing.status === "pending" || existing.status === "active")) {
      return { message: `Your ${plan.label} request is already with us.` };
    }
    if (existing) {
      const { error: del } = await ctx.supabase.from("subscriptions").delete().eq("id", existing.id);
      if (del) throw new Error(`Couldn't update your request: ${del.message}`);
    }

    const { error } = await ctx.supabase.from("subscriptions").insert({
      user_id: ctx.userId,
      plan: data.plan,
      status: "pending",
      amount: plan.price,
      payment_reference: data.paymentReference || null,
    });
    if (error) throw new Error(`Couldn't save your request: ${error.message}`);
    return { message: `${plan.label} requested — we'll confirm your payment and unlock it.` };
  });

export const cancelMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { error } = await ctx.supabase.from("subscriptions").delete().eq("user_id", ctx.userId);
    if (error) throw new Error(`Couldn't cancel: ${error.message}`);
    return { message: "Request removed." };
  });

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionRow[]> => {
    const ctx = context as unknown as Ctx;
    const { data, error } = await ctx.supabase.rpc("admin_subscriptions");
    if (error) throw new Error(`Couldn't load requests: ${error.message}`);
    return (data ?? []) as SubscriptionRow[];
  });

export const setSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "declined", "cancelled", "expired"]),
        days: z.number().int().min(1).max(365).default(30),
        note: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: ok, error } = await ctx.supabase.rpc("admin_set_subscription_status", {
      _id: data.id,
      _status: data.status,
      _days: data.days,
      _note: data.note || null,
    });
    if (error) throw new Error(`Couldn't update: ${error.message}`);
    if (!ok) throw new Error("Only an admin can do that.");
    return { message: data.status === "active" ? "Payment confirmed — plan unlocked." : "Updated." };
  });
