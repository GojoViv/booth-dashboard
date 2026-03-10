"use client";

import { useEffect, useState, useMemo } from "react";

interface Event {
  source: string;
  date: string;
  client: string;
  event_type: string;
  attendant: string;
  booth: string;
  hours: string;
  start_time: string;
  end_time: string;
  venue: string;
  payment: string;
  indoor_outdoor: string;
  backdrop: string;
  feedback: string;
  addons: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const EVENT_TYPE_COLORS: Record<string, string> = {
  "Birthday": "#f59e0b",
  "Wedding": "#ec4899",
  "Graduation": "#10b981",
  "Baby Shower": "#8b5cf6",
  "Corporate": "#3b82f6",
  "Quinceañera": "#ef4444",
  "Mitzvah": "#06b6d4",
  "Other": "#6b7280",
};

function parseEventDate(dateStr: string): Date | null {
  try {
    const cleaned = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/, "");
    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch { return null; }
}

function getWeekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <div className="text-gray-400 text-xs uppercase tracking-widest">{label}</div>
      <div className={`text-3xl font-bold ${color || "text-white"}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
    </div>
  );
}

function BarChart({ data }: { data: { label: string; count: number; color?: string }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.sort((a,b) => b.count - a.count).map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-28 text-right text-xs text-gray-400 truncate">{item.label}</div>
          <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%`, backgroundColor: item.color || "#3b82f6" }}
            >
              <span className="text-xs text-white font-semibold">{item.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const [sourceFilter, setSourceFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [weekFilter, setWeekFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [attendantFilter, setAttendantFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overview"|"events"|"attendants">("overview");

  useEffect(() => {
    fetch("/events.json")
      .then(r => r.json())
      .then(data => { setAllEvents(data); setLoading(false); });
  }, []);

  const parsedEvents = useMemo(() => allEvents.map(e => ({
    ...e,
    parsedDate: parseEventDate(e.date),
  })), [allEvents]);

  const years = useMemo(() => {
    const s = new Set<string>();
    parsedEvents.forEach(e => { if (e.parsedDate) s.add(String(e.parsedDate.getFullYear())); });
    return ["All", ...Array.from(s).sort()];
  }, [parsedEvents]);

  const weeks = useMemo(() => {
    if (yearFilter === "All") return ["All"];
    const s = new Set<string>();
    parsedEvents.forEach(e => {
      if (e.parsedDate && String(e.parsedDate.getFullYear()) === yearFilter) {
        s.add(String(getWeekNumber(e.parsedDate)));
      }
    });
    return ["All", ...Array.from(s).sort((a,b) => Number(a)-Number(b)).map(w => `Week ${w}`)];
  }, [parsedEvents, yearFilter]);

  const allAttendants = useMemo(() => {
    const s = new Set<string>();
    parsedEvents.forEach(e => { if (e.attendant && e.attendant.length > 1) s.add(e.attendant); });
    return ["All", ...Array.from(s).sort()];
  }, [parsedEvents]);

  const allTypes = useMemo(() => {
    const s = new Set<string>();
    parsedEvents.forEach(e => { if (e.event_type) s.add(e.event_type); });
    return ["All", ...Array.from(s).sort()];
  }, [parsedEvents]);

  const filtered = useMemo(() => {
    return parsedEvents.filter(e => {
      if (sourceFilter !== "All" && e.source !== sourceFilter) return false;
      if (e.parsedDate) {
        const yr = String(e.parsedDate.getFullYear());
        const mo = MONTHS[e.parsedDate.getMonth()];
        const wk = `Week ${getWeekNumber(e.parsedDate)}`;
        if (yearFilter !== "All" && yr !== yearFilter) return false;
        if (monthFilter !== "All" && mo !== monthFilter) return false;
        if (weekFilter !== "All" && wk !== weekFilter) return false;
      } else {
        if (yearFilter !== "All" || monthFilter !== "All" || weekFilter !== "All") return false;
      }
      if (typeFilter !== "All" && e.event_type !== typeFilter) return false;
      if (attendantFilter !== "All" && e.attendant !== attendantFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.client.toLowerCase().includes(q) && !e.venue.toLowerCase().includes(q) && !e.attendant.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [parsedEvents, sourceFilter, yearFilter, monthFilter, weekFilter, typeFilter, attendantFilter, search]);

  const stats = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    const attendantCounts: Record<string, number> = {};
    const monthlyCounts: Record<string, number> = {};
    let totalHours = 0;
    let hoursCount = 0;
    let withFeedback = 0;

    filtered.forEach(e => {
      typeCounts[e.event_type || "Other"] = (typeCounts[e.event_type || "Other"] || 0) + 1;
      if (e.attendant && e.attendant.length > 1) {
        attendantCounts[e.attendant] = (attendantCounts[e.attendant] || 0) + 1;
      }
      if (e.parsedDate) {
        const key = `${e.parsedDate.getFullYear()}-${String(e.parsedDate.getMonth()+1).padStart(2,"0")} ${MONTHS[e.parsedDate.getMonth()]}`;
        monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
      }
      const h = parseFloat(e.hours);
      if (!isNaN(h)) { totalHours += h; hoursCount++; }
      if (e.feedback && e.feedback.length > 5) withFeedback++;
    });

    const topAttendant = Object.entries(attendantCounts).sort((a,b) => b[1]-a[1])[0];
    const topType = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0];

    return {
      total: filtered.length,
      typeCounts,
      attendantCounts,
      monthlyCounts,
      avgHours: hoursCount > 0 ? (totalHours / hoursCount).toFixed(1) : "—",
      topAttendant: topAttendant ? `${topAttendant[0]} (${topAttendant[1]})` : "—",
      topType: topType ? `${topType[0]} (${topType[1]})` : "—",
      withFeedback,
    };
  }, [filtered]);

  const SelectEl = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-gray-400 text-lg animate-pulse">Loading events...</div>
    </div>
  );

  const hasFilters = sourceFilter !== "All" || yearFilter !== "All" || monthFilter !== "All" || weekFilter !== "All" || typeFilter !== "All" || attendantFilter !== "All" || search;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">📸 BoothOS Dashboard</h1>
          <p className="text-gray-500 text-sm">Photo Booth Events · LA &amp; Dallas</p>
        </div>
        <div className="text-gray-400 text-sm font-medium">{stats.total.toLocaleString()} events</div>
      </div>

      <div className="px-6 py-4 border-b border-gray-800 flex flex-wrap gap-3 items-center">
        <SelectEl value={sourceFilter} onChange={v => setSourceFilter(v)} options={["All","LA","Dallas"]} />
        <SelectEl value={yearFilter} onChange={v => { setYearFilter(v); setMonthFilter("All"); setWeekFilter("All"); }} options={years} />
        <SelectEl value={monthFilter} onChange={v => setMonthFilter(v)} options={["All", ...MONTHS]} />
        <SelectEl value={weekFilter} onChange={v => setWeekFilter(v)} options={weeks} />
        <SelectEl value={typeFilter} onChange={v => setTypeFilter(v)} options={allTypes} />
        <SelectEl value={attendantFilter} onChange={v => setAttendantFilter(v)} options={allAttendants} />
        <input
          type="text"
          placeholder="Search client, venue..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 w-48"
        />
        {hasFilters && (
          <button
            onClick={() => { setSourceFilter("All"); setYearFilter("All"); setMonthFilter("All"); setWeekFilter("All"); setTypeFilter("All"); setAttendantFilter("All"); setSearch(""); }}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="px-6 pt-4 flex gap-1 border-b border-gray-800">
        {(["overview","events","attendants"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition ${
              activeTab === tab ? "bg-gray-900 text-white border border-b-0 border-gray-800" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-6 py-6">
        {activeTab === "overview" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Events" value={stats.total.toLocaleString()} color="text-blue-400" />
              <StatCard label="Avg Hours / Event" value={stats.avgHours} sub="per booking" color="text-emerald-400" />
              <StatCard label="Top Attendant" value={stats.topAttendant} color="text-yellow-400" />
              <StatCard label="With Feedback" value={stats.withFeedback} sub="client reviews" color="text-purple-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Event Types</h2>
                <BarChart data={Object.entries(stats.typeCounts).map(([label, count]) => ({
                  label, count, color: EVENT_TYPE_COLORS[label] || "#6b7280"
                }))} />
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Monthly Volume</h2>
                <BarChart data={Object.entries(stats.monthlyCounts)
                  .sort((a,b) => a[0].localeCompare(b[0]))
                  .map(([label, count]) => ({ label: label.split(" ")[1] + " " + label.split("-")[0], count, color: "#3b82f6" }))} />
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Top 10 Attendants</h2>
              <BarChart data={Object.entries(stats.attendantCounts)
                .filter(([k]) => k.length > 1)
                .sort((a,b) => b[1]-a[1])
                .slice(0, 10)
                .map(([label, count]) => ({ label, count, color: "#8b5cf6" }))} />
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 pr-4">Date</th>
                    <th className="text-left py-3 pr-4">Client</th>
                    <th className="text-left py-3 pr-4">Type</th>
                    <th className="text-left py-3 pr-4">Attendant</th>
                    <th className="text-left py-3 pr-4">Time</th>
                    <th className="text-left py-3 pr-4">Hrs</th>
                    <th className="text-left py-3 pr-4">Venue</th>
                    <th className="text-left py-3">City</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 250).map((e, i) => (
                    <tr key={i} className="border-b border-gray-900 hover:bg-gray-900/50 transition">
                      <td className="py-2 pr-4 text-gray-300 whitespace-nowrap text-xs">
                        {e.parsedDate ? `${MONTHS[e.parsedDate.getMonth()]} ${e.parsedDate.getDate()}, ${e.parsedDate.getFullYear()}` : e.date}
                      </td>
                      <td className="py-2 pr-4 text-white font-medium max-w-32 truncate">{e.client || "—"}</td>
                      <td className="py-2 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                          backgroundColor: (EVENT_TYPE_COLORS[e.event_type] || "#6b7280") + "22",
                          color: EVENT_TYPE_COLORS[e.event_type] || "#9ca3af"
                        }}>
                          {e.event_type || "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-300 text-xs">{e.attendant || "—"}</td>
                      <td className="py-2 pr-4 text-gray-400 whitespace-nowrap text-xs">{e.start_time}{e.end_time ? ` – ${e.end_time}` : ""}</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{e.hours || "—"}</td>
                      <td className="py-2 pr-4 text-gray-500 max-w-40 truncate text-xs">{e.venue.split("\n")[0] || "—"}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${e.source === "LA" ? "bg-blue-900/40 text-blue-300" : "bg-orange-900/40 text-orange-300"}`}>
                          {e.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 250 && (
              <p className="text-center text-gray-500 text-sm mt-4">Showing 250 of {filtered.length} — use filters to narrow down</p>
            )}
          </div>
        )}

        {activeTab === "attendants" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 pr-6 w-8">#</th>
                  <th className="text-left py-3 pr-6">Attendant</th>
                  <th className="text-left py-3 pr-6">Events</th>
                  <th className="text-left py-3 pr-6">Share</th>
                  <th className="text-left py-3">Specialty</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.attendantCounts)
                  .filter(([k]) => k.length > 1)
                  .sort((a,b) => b[1]-a[1])
                  .map(([name, count], i) => {
                    const pct = ((count / stats.total) * 100).toFixed(1);
                    const typesForAttendant: Record<string,number> = {};
                    filtered.filter(e => e.attendant === name).forEach(e => {
                      typesForAttendant[e.event_type || "Other"] = (typesForAttendant[e.event_type || "Other"] || 0) + 1;
                    });
                    const topT = Object.entries(typesForAttendant).sort((a,b) => b[1]-a[1])[0];
                    return (
                      <tr key={name} className="border-b border-gray-900 hover:bg-gray-900/50 transition">
                        <td className="py-3 pr-6 text-gray-600 text-xs">{i+1}</td>
                        <td className="py-3 pr-6 font-medium text-white">{name}</td>
                        <td className="py-3 pr-6 text-blue-400 font-bold text-lg">{count}</td>
                        <td className="py-3 pr-6">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-800 rounded-full h-2">
                              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                            </div>
                            <span className="text-gray-400 text-xs">{pct}%</span>
                          </div>
                        </td>
                        <td className="py-3">
                          {topT && (
                            <span className="px-2 py-0.5 rounded-full text-xs" style={{
                              backgroundColor: (EVENT_TYPE_COLORS[topT[0]] || "#6b7280") + "22",
                              color: EVENT_TYPE_COLORS[topT[0]] || "#9ca3af"
                            }}>
                              {topT[0]} · {topT[1]}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
