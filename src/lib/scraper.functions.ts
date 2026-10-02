import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { appUserReconnectRequired, callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getConnectionKeyForUser } from "./appUserConnections.server";
import { assertCanSearch, assertDeepSearch, readMyPlan, remainingBusinesses } from "./limits.server";

const MAPS_URL = "https://connector-gateway.lovable.dev/google_maps";
const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const REGIONS_PER_LOAD = 2;
const HEADER = ["Business name", "Category", "Phone", "Website", "Address", "Country", "Rating", "Reviews", "Status", "Profile link", "Searched area"];

type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
};

type Ctx = { supabase: any; userId: string };

async function failIfBad(res: Response, label: string) {
  if (res.ok) return;
  const body = await res.text();
  console.error(`${label} failed [${res.status}]: ${body}`);
  throw new Error(`${label} failed [${res.status}]: ${body.slice(0, 300)}`);
}

async function searchPlaces(textQuery: string): Promise<Place[]> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Business search isn't set up yet.");
  const places: Place[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await fetch(`${MAPS_URL}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": maps,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName,places.businessStatus,nextPageToken",
      },
      body: JSON.stringify({ textQuery, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
    });
    await failIfBad(res, "Business search");
    const json = (await res.json()) as { places?: Place[]; nextPageToken?: string };
    places.push(...(json.places ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return places;
}

async function sheets(connKey: string, path: string, init?: RequestInit) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: connKey,
    connectorId: "google_sheets",
    path,
    init: { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } },
    requiredScopes: SHEETS_SCOPES,
  });
  if (await appUserReconnectRequired(res)) {
    throw new Error("Your account access needs to be renewed. Click “Reconnect” and try again.");
  }
  return res;
}

async function requireAccount(userId: string) {
  const key = await getConnectionKeyForUser(userId, "google_sheets");
  if (!key) throw new Error("Connect your account first.");
  return key;
}

async function ensureMaster(ctx: Ctx, connKey: string) {
  const { data: existing } = await ctx.supabase
    .from("user_sheets")
    .select("spreadsheet_id, spreadsheet_url")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (existing) {
    const check = await sheets(connKey, `/v4/spreadsheets/${existing.spreadsheet_id}?fields=spreadsheetId`);
    if (check.ok) return { id: existing.spreadsheet_id as string, url: existing.spreadsheet_url as string };
    if (check.status !== 404) await failIfBad(check, "Spreadsheet lookup");
  }
  const res = await sheets(connKey, "/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: "LeadPilot — Master Leads" },
      sheets: [{ properties: { title: "About" } }],
    }),
  });
  await failIfBad(res, "Spreadsheet create");
  const s = (await res.json()) as { spreadsheetId: string; spreadsheetUrl: string };
  await sheets(connKey, `/v4/spreadsheets/${s.spreadsheetId}/values/About!A1:A2?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [["LeadPilot master spreadsheet"], ["Each search gets its own tab."]] }),
  });
  const { error } = await ctx.supabase
    .from("user_sheets")
    .upsert({ user_id: ctx.userId, spreadsheet_id: s.spreadsheetId, spreadsheet_url: s.spreadsheetUrl });
  if (error) throw new Error(`Saving spreadsheet failed: ${error.message}`);
  return { id: s.spreadsheetId, url: s.spreadsheetUrl };
}

function cleanTab(s: string) {
  return s.replace(/[^\p{L}\p{N} &.,()-]/gu, " ").replace(/\s+/g, " ").trim();
}

function tabRange(tab: string, suffix: string) {
  return `${encodeURIComponent(`'${tab}'`)}!${suffix}`;
}

function toRow(p: Place, country: string, fallbackType: string, area: string) {
  return [
    p.displayName?.text ?? "",
    p.primaryTypeDisplayName?.text ?? fallbackType,
    p.internationalPhoneNumber ?? "",
    p.websiteUri ?? "",
    p.formattedAddress ?? "",
    country,
    p.rating ?? "",
    p.userRatingCount ?? "",
    p.businessStatus ?? "",
    p.googleMapsUri ?? "",
    area,
  ];
}

async function saveFresh(ctx: Ctx, places: Place[], businessType: string, country: string, cap?: number) {
  const unique = [...new Map(places.map((p) => [p.id, p])).values()];
  if (!unique.length) return [];
  const { data: existing } = await ctx.supabase
    .from("leads")
    .select("place_id")
    .eq("user_id", ctx.userId)
    .in("place_id", unique.map((p) => p.id));
  const known = new Set((existing ?? []).map((e: { place_id: string }) => e.place_id));
  const fresh = unique.filter((p) => !known.has(p.id)).slice(0, cap ?? unique.length);
  if (fresh.length) {
    const { error } = await ctx.supabase.from("leads").insert(
      fresh.map((p) => ({
        user_id: ctx.userId,
        name: p.displayName?.text ?? "Unknown business",
        company: p.displayName?.text ?? null,
        message: `Found via business search: ${p.primaryTypeDisplayName?.text ?? businessType} in ${country}.`,
        source: "business_search",
        phone: p.internationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        address: p.formattedAddress ?? null,
        country,
        category: p.primaryTypeDisplayName?.text ?? businessType,
        rating: p.rating ?? null,
        review_count: p.userRatingCount ?? null,
        maps_url: p.googleMapsUri ?? null,
        place_id: p.id,
      })),
    );
    if (error) throw new Error(`Saving leads failed: ${error.message}`);
  }
  return fresh;
}

async function linkToJob(ctx: Ctx, fresh: Place[], jobId: string) {
  if (!fresh.length) return;
  await ctx.supabase
    .from("leads")
    .update({ scrape_job_id: jobId })
    .eq("user_id", ctx.userId)
    .in("place_id", fresh.map((p) => p.id));
}

async function appendRows(connKey: string, spreadsheetId: string, tab: string, rows: (string | number)[][]) {
  if (!rows.length) return;
  const res = await sheets(
    connKey,
    `/v4/spreadsheets/${spreadsheetId}/values/${tabRange(tab, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rows }) },
  );
  await failIfBad(res, "Spreadsheet append");
}

async function generateRegions(country: string): Promise<string[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Reply with only a JSON array of strings, no prose." },
        {
          role: "user",
          content: `List the 30 most commercially important cities and towns in ${country}, largest first. Use the names people would type when searching for businesses there.`,
        },
      ],
    }),
  });
  await failIfBad(res, "Region lookup");
  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try {
    const arr = JSON.parse(match?.[0] ?? "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

export const scrapeBusinesses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ businessType: z.string().trim().min(2).max(100), country: z.string().trim().min(2).max(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const state = await readMyPlan(ctx);
    assertCanSearch(state);

    const connKey = await requireAccount(ctx.userId);
    const results = await searchPlaces(`${data.businessType} in ${data.country}`);
    const master = await ensureMaster(ctx, connKey);

    const stamp = new Date().toISOString().slice(5, 16).replace("T", " ");
    const tab = cleanTab(`${data.businessType} - ${data.country}`).slice(0, 80) + ` ${stamp.replace(":", "h")}`;
    const addRes = await sheets(connKey, `/v4/spreadsheets/${master.id}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1 } } } }],
      }),
    });
    await failIfBad(addRes, "Add tab");
    const added = (await addRes.json()) as { replies: { addSheet: { properties: { sheetId: number } } }[] };
    const sheetId = added.replies[0]?.addSheet.properties.sheetId ?? 0;
    const tabUrl = `https://docs.google.com/spreadsheets/d/${master.id}/edit#gid=${sheetId}`;

    const fresh = await saveFresh(ctx, results, data.businessType, data.country, remainingBusinesses(state));
    await appendRows(connKey, master.id, tab, [
      HEADER,
      ...results.map((p) => toRow(p, data.country, data.businessType, data.country)),
    ]);

    const { data: job, error } = await ctx.supabase
      .from("scrape_jobs")
      .insert({
        user_id: ctx.userId,
        business_type: data.businessType,
        country: data.country,
        result_count: results.length,
        sheet_url: tabUrl,
        spreadsheet_id: master.id,
        sheet_tab: tab,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Saving search failed: ${error.message}`);
    await linkToJob(ctx, fresh, job.id);

    return { jobId: job.id, found: results.length, added: fresh.length, sheetUrl: tabUrl };
  });

export const loadMoreResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const state = await readMyPlan(ctx);
    assertDeepSearch(state);
    const cap = remainingBusinesses(state);

    const connKey = await requireAccount(ctx.userId);
    const { data: job, error } = await ctx.supabase.from("scrape_jobs").select("*").eq("id", data.jobId).single();
    if (error || !job) throw new Error("Search not found");
    if (!job.spreadsheet_id || !job.sheet_tab) throw new Error("This older search can't be extended. Run a new search.");

    let regions = job.regions as string[] | null;
    if (!regions || regions.length === 0) {
      regions = await generateRegions(job.country);
      if (!regions.length) throw new Error("Couldn't find more areas to search in this country.");
    }
    const start = job.region_index;
    const batch = regions.slice(start, start + REGIONS_PER_LOAD);
    if (!batch.length) return { added: 0, remaining: 0, done: true, areas: [] as string[] };

    const rows: (string | number)[][] = [];
    let added = 0;
    let left = cap;
    for (const area of batch) {
      const places = await searchPlaces(`${job.business_type} in ${area}, ${job.country}`);
      const fresh = await saveFresh(ctx, places, job.business_type, job.country, left);
      await linkToJob(ctx, fresh, job.id);
      added += fresh.length;
      left = Math.max(0, left - fresh.length);
      rows.push(...fresh.map((p) => toRow(p, job.country, job.business_type, area)));
    }
    await appendRows(connKey, job.spreadsheet_id, job.sheet_tab, rows);

    const nextIndex = start + batch.length;
    await ctx.supabase
      .from("scrape_jobs")
      .update({ regions, region_index: nextIndex, result_count: job.result_count + added })
      .eq("id", job.id);

    return { added, remaining: regions.length - nextIndex, done: nextIndex >= regions.length, areas: batch };
  });
