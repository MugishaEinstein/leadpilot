import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`AI gateway failed [${response.status}]: ${body}`);
    throw new Error(`AI request failed [${response.status}]`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const leadInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  message: z.string().min(1),
  source: z.string().default("website"),
});

export const scoreLead = createServerFn({ method: "POST" })
  .inputValidator((data) => leadInput.parse(data))
  .handler(async ({ data }) => {
    const content = await callAI(
      `You are a lead qualification engine for a B2B services business. Score inbound leads as HOT, WARM, or COLD based on buying intent, urgency, budget signals, and fit. Respond with ONLY valid JSON: {"score":"hot"|"warm"|"cold","reason":"one concise sentence explaining the score"}`,
      `Lead:\nName: ${data.name}\nEmail: ${data.email}\nCompany: ${data.company || "unknown"}\nSource: ${data.source}\nMessage: ${data.message}`,
    );

    try {
      const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
      const score = ["hot", "warm", "cold"].includes(parsed.score) ? parsed.score : "warm";
      return { score: score as "hot" | "warm" | "cold", reason: String(parsed.reason || "") };
    } catch {
      return { score: "warm" as const, reason: "Scored by AI (defaulted to warm)." };
    }
  });

export const draftFollowUp = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        name: z.string(),
        company: z.string().optional(),
        message: z.string(),
        score: z.enum(["hot", "warm", "cold"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const tone =
      data.score === "hot"
        ? "urgent and highly personalized, proposing a call within 24 hours"
        : data.score === "warm"
          ? "helpful and value-driven, sharing a relevant insight and soft call-to-action"
          : "light and nurturing, keeping the door open without pressure";

    return callAI(
      `You are a sales copywriter. Write a short follow-up email (under 120 words, plain text, no subject line prefix beyond "Subject:") that is ${tone}. Sign off as "The Team".`,
      `Lead: ${data.name}${data.company ? ` at ${data.company}` : ""}. Their message: "${data.message}". Lead score: ${data.score.toUpperCase()}.`,
    );
  });
