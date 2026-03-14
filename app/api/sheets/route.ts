import { NextResponse } from "next/server";

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const BASE = "https://api.notion.com/v1";

const DB_ATTENDANTS = "32363e92-d17b-81c6-ad67-fe86a0235f00";
const DB_PAYROLL    = "32363e92-d17b-8169-8f54-dbf9e40b06d2";
const DB_FEEDBACK   = "32363e92-d17b-8199-810e-c88044955601";

const HEADERS = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

// In-memory cache
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function extractText(rt: unknown[]): string {
  if (!rt || !Array.isArray(rt)) return "";
  return rt.map((r: any) => r.plain_text || "").join("").trim();
}
function extractSelect(sel: unknown): string {
  if (!sel || typeof sel !== "object") return "";
  return (sel as any).name || "";
}
function extractNum(n: unknown): string {
  if (n === null || n === undefined) return "";
  return String(n);
}

async function fetchAll(dbId: string): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`${BASE}/databases/${dbId}/query`, {
      method: "POST", headers: HEADERS, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Notion ${dbId} error: ${res.status}`);
    const data = await res.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

function formatDateForDash(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC"
    });
  } catch { return iso; }
}

async function getAttendants() {
  const pages = await fetchAll(DB_ATTENDANTS);
  return pages.map(p => {
    const props = p.properties;
    return {
      name:         extractText(props.Name?.title),
      status:       extractSelect(props.Status?.select),
      has_booth:    props["Has Booth"]?.checkbox ? "Yes" : "",
      phone:        props.Phone?.phone_number || "",
      address:      extractText(props.Address?.rich_text),
      availability: extractText(props.Availability?.rich_text),
    };
  });
}

async function getPayroll() {
  const pages = await fetchAll(DB_PAYROLL);
  return pages.map(p => {
    const props = p.properties;
    const entryTitle = extractText(props.Entry?.title);
    const parts = entryTitle.split(" — ");
    return {
      attendant: parts[0] || extractText(props.Attendant?.rich_text),
      client:    parts[1] || "",
      date:      formatDateForDash(props.Date?.date?.start || ""),
      start:     "",
      end:       "",
      address:   "",
      miles:     extractNum(props.Miles?.number),
      hours:     extractNum(props.Hours?.number),
      gas_pay:   extractNum(props["Gas ($)"]?.number),
      total_pay: extractNum(props["Total Pay ($)"]?.number),
      pay_rate:  "",
      city:      extractSelect(props.City?.select),
    };
  });
}

async function getFeedback() {
  const pages = await fetchAll(DB_FEEDBACK);
  return pages.map(p => {
    const props = p.properties;
    const event = extractText(props.Event?.rich_text);
    const parenMatch = event.match(/\(([^)]+)\)/);
    return {
      client:      event.replace(/\s*\([^)]*\)/, "").trim(),
      date:        formatDateForDash(props.Date?.date?.start || ""),
      attendant:   parenMatch ? parenMatch[1] : "",
      digitals:    "",
      status:      props.Resolved?.checkbox ? "Resolved" : "",
      remarks:     extractText(props.Details?.rich_text),
      rebook:      "",
      review_sent: "",
    };
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && (now - cache.ts) < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=3600" }
      });
    }

    const [attendants, payroll, feedback] = await Promise.all([
      getAttendants(),
      getPayroll(),
      getFeedback(),
    ]);

    const data = {
      payroll,
      attendants,
      feedback,
      complaints:    [],
      confirmations: [],
      equipment:     [],
      post_event:    [],
    };

    cache = { data, ts: now };
    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=3600" }
    });
  } catch (err: unknown) {
    console.error("Sheets API error:", err);
    return NextResponse.json({ error: "Failed to fetch sheets data" }, { status: 500 });
  }
}
