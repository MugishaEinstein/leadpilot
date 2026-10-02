import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Zap, Flame, Thermometer, Snowflake, ArrowRight, Bot, Mail, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { scoreLead } from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadPilot — AI Lead Capture & Scoring" },
      {
        name: "description",
        content:
          "Capture leads, score them instantly with AI (Hot/Warm/Cold), and generate personalized follow-ups automatically.",
      },
      { property: "og:title", content: "LeadPilot — AI Lead Capture & Scoring" },
      {
        property: "og:description",
        content:
          "Capture leads, score them instantly with AI (Hot/Warm/Cold), and generate personalized follow-ups automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: Zap,
    title: "Capture",
    text: "Leads come in through the form and land in your pipeline instantly.",
  },
  {
    icon: Bot,
    title: "AI Scoring",
    text: "Every lead is analyzed and scored Hot, Warm, or Cold based on buying intent.",
  },
  {
    icon: Mail,
    title: "Follow-ups",
    text: "Personalized follow-up emails are drafted for each lead automatically.",
  },
  {
    icon: BarChart3,
    title: "Dashboard",
    text: "Track your whole pipeline, priorities, and conversion status in one place.",
  },
];

function Index() {
  const router = useRouter();
  const runScore = useServerFn(scoreLead);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: string; reason: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const scored = await runScore({ data: { name, email, company, message, source: "website" } });
      const { error } = await supabase.from("leads").insert({
        name,
        email,
        company: company || null,
        message,
        source: "website",
        score: scored.score,
        score_reason: scored.reason,
      });
      if (error) throw error;
      setResult(scored);
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
      toast.success("Lead captured and scored!");
      router.invalidate();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const scoreIcon =
    result?.score === "hot" ? (
      <Flame className="size-5 text-hot" />
    ) : result?.score === "warm" ? (
      <Thermometer className="size-5 text-warm" />
    ) : (
      <Snowflake className="size-5 text-cold" />
    );

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
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
            <Link to="/dashboard">
              Dashboard <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary animate-pulse-dot" />
          AI-powered lead automation
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Never lose a lead <span className="text-primary text-glow">again.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Capture every inquiry, let AI score buying intent instantly, and send personalized
          follow-ups — all on autopilot.
        </p>
      </section>

      {/* Steps */}
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="rounded-xl border border-border bg-card p-5 animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <s.icon className="mb-3 size-5 text-primary" />
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </section>

      {/* Capture form */}
      <section className="mx-auto max-w-2xl px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 card-glow">
          <h2 className="text-2xl font-bold tracking-tight">Try it live</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit a test lead below — the AI will score it in seconds and add it to your pipeline.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company (optional)</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi, we're looking for help automating our sales outreach for a team of 20…"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "AI is scoring…" : "Capture & score lead"}
            </Button>
          </form>

          {result && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-secondary p-4 animate-fade-up">
              {scoreIcon}
              <div>
                <p className="font-semibold capitalize">{result.score} lead</p>
                <p className="text-sm text-muted-foreground">{result.reason}</p>
                <Link
                  to="/dashboard"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View in dashboard <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        LeadPilot — AI lead capture, scoring & follow-up automation
      </footer>
    </div>
  );
}
