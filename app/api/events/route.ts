import { NextResponse } from "next/server";

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const DB_EVENTS = "32363e92-d17b-81a5-8199-d3f1f34a9fdf";
const BASE = "https://api.notion.com/v1";

const HEADERS = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

// In-memory cache
let cache: { data: unknown[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function extractText(rt: unknown[]): string {
  if (!rt || !Array.isArray(rt)) return "";
  return rt.map((r: any) => r.plain_text || "").join("").trim();
}

function extractSelect(sel: unknown): string {
  if (!sel || typeof sel !== "object") return "";
  return (sel as any).name || "";
}

async function fetchAllEvents(): Promise<unknown[]> {
  const results: unknown[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${BASE}/databases/${DB_EVENTS}/query`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Notion error: ${res.status}`);
    const data = await res.json();

    for (const page of data.results) {
      const props = page.properties;
      results.push({
        source:        extractSelect(props.City?.select),
        date:          props.Date?.date?.start ? formatDateForDash(props.Date.date.start) : "",
        client:        extractText(props.Client?.rich_text),
        event_type:    extractEventType(extractText(props["Event Name"]?.title), extractText(props.Client?.rich_text)),
        attendant:     extractText(props.Attendant?.rich_text),
        booth:         extractText(props.Booth?.rich_text),
        hours:         "",
        start_time:    extractStartTime(extractText(props.Time?.rich_text)),
        end_time:      extractEndTime(extractText(props.Time?.rich_text)),
        venue:         extractText(props.Venue?.rich_text),
        payment:       extractSelect(props.Payment?.select),
        indoor_outdoor:"",
        backdrop:      "",
        feedback:      "",
        addons:        "",
      });
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return results;
}

function formatDateForDash(iso: string): string {
  // Convert "2025-06-08" → "Sunday, June 8, 2025"
  try {
    const d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC"
    });
  } catch { return iso; }
}

function extractEventType(eventName: string, client: string): string {
  const n = eventName.replace(client, "").replace(/^[\s—\-]+|[\s—\-]+$/g, "");
  return n || "Event";
}

function extractStartTime(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split("–").map(s => s.trim());
  return parts[0] || timeStr;
}

function extractEndTime(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split("–").map(s => s.trim());
  return parts[1] || "";
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && (now - cache.ts) < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=3600" }
      });
    }

    const events = await fetchAllEvents();
    cache = { data: events, ts: now };

    return NextResponse.json(events, {
      headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=3600" }
    });
  } catch (err: unknown) {
    console.error("Events API error:", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
