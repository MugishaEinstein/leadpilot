// Shared plan definitions — safe to import from browser and server code.

export type PlanId = "starter" | "growth" | "scale";

export type Limits = {
  searchesPerMonth: number;
  businessesPerMonth: number;
  loadMore: boolean;
  seats: number;
};


export type Plan = {
  id: PlanId;
  label: string;
  price: number;
  blurb: string;
  searchesPerMonth: number;
  businessesPerMonth: number;
  loadMore: boolean;
  seats: number;
  support: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    label: "Starter",
    price: 39,
    blurb: "For a solo founder validating one market.",
    searchesPerMonth: 5,
    businessesPerMonth: 300,
    loadMore: false,
    seats: 1,
    support: "Email support",
    features: [
      "5 business searches a month",
      "Up to 300 businesses a month",
      "Results in your own spreadsheet",
      "AI lead scoring (Hot / Warm / Cold)",
      "One-click follow-up drafts",
      "1 workspace seat",
    ],
  },
  {
    id: "growth",
    label: "Growth",
    price: 49,
    blurb: "For a small sales team filling a pipeline every week.",
    searchesPerMonth: 15,
    businessesPerMonth: 1200,
    loadMore: true,
    seats: 3,
    support: "Priority support",
    highlight: true,
    features: [
      "Lead insights & analytics",
      "15 business searches a month",
      "Up to 1,200 businesses a month",
      "Deep search: keep adding more cities",
      "Everything in Starter",
      "3 workspace seats",
      "Priority support",
    ],
  },
  {
    id: "scale",
    label: "Scale",
    price: 99,
    blurb: "For agencies and outbound teams running several markets.",
    searchesPerMonth: 50,
    businessesPerMonth: 4000,
    loadMore: true,
    seats: 10,
    support: "Named contact",
    features: [
      "Lead insights & analytics",
      "50 business searches a month",
      "Up to 4,000 businesses a month",
      "Deep search: keep adding more cities",
      "Everything in Growth",
      "10 workspace seats",
      "Onboarding call and a named contact",
    ],
  },
];

export const TRIAL_LIMITS = {
  searchesPerMonth: 1,
  businessesPerMonth: 60,
  loadMore: false,
  seats: 1,
};

export function planById(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function planLabel(id: string | null | undefined): string {
  return planById(id)?.label ?? "Trial";
}

export function planPrice(id: string | null | undefined): number {
  return planById(id)?.price ?? 0;
}
