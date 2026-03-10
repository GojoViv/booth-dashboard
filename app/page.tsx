"use client";

import { useEffect, useState, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Event {
  source: string; date: string; client: string; event_type: string;
  attendant: string; booth: string; hours: string; start_time: string;
  end_time: string; venue: string; payment: string; indoor_outdoor: string;
  backdrop: string; feedback: string; addons: string;
}
interface PayrollRecord {
  attendant: string; client: string; date: string; start: string; end: string;
  address: string; miles: string; hours: string; gas_pay: string;
  total_pay: string; pay_rate: string; city: string;
}
interface Attendant {
  status: string; name: string; has_booth: string; phone: string;
  address: string; availability: string;
}
interface FeedbackRecord {
  client: string; date: string; attendant: string; digitals: string;
  status: string; remarks: string; rebook: string; review_sent: string;
}
interface Confirmation {
  city: string; client: string; date: string; start: string; end: string;
  confirmed_call: string; email_sent: string; email_acked: string;
}
interface EquipmentCheck {
  client: string; date: string; start: string; end: string;
  boothbook_checked: string; props_ready: string; backdrop_ready: string;
  ink_paper: string; equipment_collected: string;
}
interface PostEvent {
  client: string; date: string; feedback_call: string; feedback_email: string;
  feedback_quality: string; issue_resolved: string; review_email_sent: string;
  client_posted_review: string; digitals_confirmed: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TYPE_COLORS: Record<string,string> = {
  Birthday:"#f59e0b", Wedding:"#ec4899", Graduation:"#10b981",
  "Baby Shower":"#8b5cf6", Corporate:"#3b82f6", "Quinceañera":"#ef4444",
  Mitzvah:"#06b6d4", Other:"#6b7280",
};

const MODULES = [
  { id:"events",     label:"Events HQ",       icon:"📅" },
  { id:"preops",     label:"Pre-Event Ops",    icon:"✅" },
  { id:"postops",    label:"Post-Event",       icon:"⭐" },
  { id:"payroll",    label:"Payroll & Miles",  icon:"💰" },
  { id:"roster",     label:"Attendant Roster", icon:"👥" },
  { id:"inventory",  label:"Inventory",        icon:"📦" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s) return null;
  try {
    const c = s.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/,"");
    const d = new Date(c); return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}
function fmtDate(s: string) {
  const d = parseDate(s); if (!d) return s;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function parseCurrency(s: string): number {
  if (!s) return 0;
  const m = s.replace(/[^0-9.]/g,""); const n = parseFloat(m); return isNaN(n) ? 0 : n;
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Card({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{children}</div>;
}
function StatCard({ label, value, sub, color="text-white" }: { label:string; value:string|number; sub?:string; color?:string }) {
  return (
    <Card>
      <div className="text-gray-400 text-xs uppercase tracking-widest">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </Card>
  );
}
function Badge({ label, color }: { label:string; color:string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color+"22", color }}>
      {label}
    </span>
  );
}
function BarChart({ data }: { data: { label:string; count:number; color?:string }[] }) {
  const max = Math.max(...data.map(d=>d.count), 1);
  return (
    <div className="flex flex-col gap-2">
      {[...data].sort((a,b)=>b.count-a.count).map(item=>(
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-28 text-right text-xs text-gray-400 truncate">{item.label}</div>
          <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
            <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
              style={{ width:`${(item.count/max)*100}%`, backgroundColor:item.color||"#3b82f6" }}>
              <span className="text-xs text-white font-semibold">{item.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
function CheckDot({ val }: { val:string }) {
  const v = val.toLowerCase();
  if (v.includes("yes") || v==="y") return <span className="text-emerald-400 text-sm">✓</span>;
  if (v.includes("no") || v==="n") return <span className="text-red-400 text-sm">✗</span>;
  if (v.includes("cancel")) return <span className="text-gray-500 text-sm">—</span>;
  if (v) return <span className="text-yellow-400 text-sm" title={val}>~</span>;
  return <span className="text-gray-700 text-sm">·</span>;
}

// ─── Module: Events HQ ────────────────────────────────────────────────────────

function EventsModule({ events }: { events: Event[] }) {
  const [source,setSource] = useState("All");
  const [year,setYear] = useState("All");
  const [month,setMonth] = useState("All");
  const [type,setType] = useState("All");
  const [attendant,setAttendant] = useState("All");
  const [search,setSearch] = useState("");
  const [tab,setTab] = useState<"overview"|"table"|"attendants">("overview");

  const parsed = useMemo(()=>events.map(e=>({...e, pd:parseDate(e.date)})),[events]);
  const years = useMemo(()=>["All",...Array.from(new Set(parsed.map(e=>e.pd?.getFullYear()).filter(Boolean))).sort().map(String)]
  ,[parsed]);
  const allAttendants = useMemo(()=>["All",...Array.from(new Set(parsed.map(e=>e.attendant).filter(a=>a&&a.length>1))).sort()],[parsed]);
  const allTypes = useMemo(()=>["All",...Array.from(new Set(parsed.map(e=>e.event_type).filter(Boolean))).sort()],[parsed]);

  const filtered = useMemo(()=>parsed.filter(e=>{
    if (source!=="All" && e.source!==source) return false;
    if (e.pd) {
      if (year!=="All" && String(e.pd.getFullYear())!==year) return false;
      if (month!=="All" && MONTHS[e.pd.getMonth()]!==month) return false;
    } else if (year!=="All"||month!=="All") return false;
    if (type!=="All" && e.event_type!==type) return false;
    if (attendant!=="All" && e.attendant!==attendant) return false;
    if (search) {
      const q=search.toLowerCase();
      if (!e.client.toLowerCase().includes(q)&&!e.venue.toLowerCase().includes(q)&&!e.attendant.toLowerCase().includes(q)) return false;
    }
    return true;
  }),[parsed,source,year,month,type,attendant,search]);

  const stats = useMemo(()=>{
    const types:Record<string,number>={}, atts:Record<string,number>={}, monthly:Record<string,number>={};
    let th=0, hc=0, fb=0;
    filtered.forEach(e=>{
      types[e.event_type||"Other"]=(types[e.event_type||"Other"]||0)+1;
      if(e.attendant&&e.attendant.length>1) atts[e.attendant]=(atts[e.attendant]||0)+1;
      if(e.pd){ const k=`${e.pd.getFullYear()}-${String(e.pd.getMonth()+1).padStart(2,"0")} ${MONTHS[e.pd.getMonth()]}`; monthly[k]=(monthly[k]||0)+1; }
      const h=parseFloat(e.hours); if(!isNaN(h)){th+=h;hc++;}
      if(e.feedback&&e.feedback.length>5) fb++;
    });
    const topAtt=Object.entries(atts).sort((a,b)=>b[1]-a[1])[0];
    return { total:filtered.length, types, atts, monthly, avgHours:hc>0?(th/hc).toFixed(1):"—", topAtt:topAtt?`${topAtt[0]} (${topAtt[1]})`:"—", fb };
  },[filtered]);

  const Sel=({val,onChange,opts}:{val:string;onChange:(v:string)=>void;opts:string[]})=>(
    <select value={val} onChange={e=>onChange(e.target.value)}
      className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Sel val={source} onChange={setSource} opts={["All","LA","Dallas"]}/>
        <Sel val={year} onChange={v=>{setYear(v);setMonth("All");}} opts={years}/>
        <Sel val={month} onChange={setMonth} opts={["All",...MONTHS]}/>
        <Sel val={attendant} onChange={setAttendant} opts={allAttendants}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client, venue..."
          className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 w-48"/>
        {(source!=="All"||year!=="All"||month!=="All"||type!=="All"||attendant!=="All"||search)&&(
          <button onClick={()=>{setSource("All");setYear("All");setMonth("All");setType("All");setAttendant("All");setSearch("");}}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2">Clear</button>
        )}
      </div>

      {/* Event Types filter */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Filter by Event Type</div>
        <div className="flex flex-wrap gap-2">
          {allTypes.filter(t=>t!=="All").map(t=>{
            const count = parsed.filter(e=>e.event_type===t).length;
            const color = TYPE_COLORS[t]||"#6b7280";
            const active = type===t;
            return (
              <button key={t} onClick={()=>setType(active?"All":t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                style={{
                  backgroundColor: active ? color+"33" : "transparent",
                  borderColor: active ? color : "#374151",
                  color: active ? color : "#9ca3af",
                }}>
                <span style={{width:6,height:6,borderRadius:"50%",backgroundColor:color,display:"inline-block",flexShrink:0}}/>
                {t}
                <span className="ml-0.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-1">
        {(["overview","table","attendants"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-1.5 text-sm capitalize rounded-lg transition ${tab===t?"bg-blue-600 text-white":"text-gray-400 hover:text-white"}`}>{t}</button>
        ))}
        <span className="ml-auto text-gray-400 text-sm self-center">{stats.total.toLocaleString()} events</span>
      </div>

      {tab==="overview"&&(
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Events" value={stats.total.toLocaleString()} color="text-blue-400"/>
            <StatCard label="Avg Hours/Event" value={stats.avgHours} sub="per booking" color="text-emerald-400"/>
            <StatCard label="Top Attendant" value={stats.topAtt} color="text-yellow-400"/>
            <StatCard label="With Feedback" value={stats.fb} sub="client reviews" color="text-purple-400"/>
          </div>
          <Card><SectionTitle>Monthly Volume</SectionTitle>
            <BarChart data={Object.entries(stats.monthly).sort((a,b)=>a[0].localeCompare(b[0])).map(([l,c])=>({label:l.split(" ")[1]+" "+l.split("-")[0],count:c,color:"#3b82f6"}))}/>
          </Card>
        </div>
      )}

      {tab==="table"&&(
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Client</th>
              <th className="text-left py-2 pr-3">Type</th><th className="text-left py-2 pr-3">Attendant</th>
              <th className="text-left py-2 pr-3">Time</th><th className="text-left py-2 pr-3">Hrs</th>
              <th className="text-left py-2 pr-3">Venue</th><th className="text-left py-2">City</th>
            </tr></thead>
            <tbody>{filtered.slice(0,300).map((e,i)=>(
              <tr key={i} className="border-b border-gray-900 hover:bg-gray-900/50">
                <td className="py-1.5 pr-3 text-gray-300 text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="py-1.5 pr-3 text-white font-medium max-w-[120px] truncate">{e.client||"—"}</td>
                <td className="py-1.5 pr-3">{e.event_type&&<Badge label={e.event_type} color={TYPE_COLORS[e.event_type]||"#6b7280"}/>}</td>
                <td className="py-1.5 pr-3 text-gray-300 text-xs">{e.attendant||"—"}</td>
                <td className="py-1.5 pr-3 text-gray-400 text-xs whitespace-nowrap">{e.start_time}{e.end_time?` – ${e.end_time}`:""}</td>
                <td className="py-1.5 pr-3 text-gray-400 text-xs">{e.hours||"—"}</td>
                <td className="py-1.5 pr-3 text-gray-500 text-xs max-w-[150px] truncate">{e.venue.split("\n")[0]}</td>
                <td className="py-1.5"><span className={`text-xs px-2 py-0.5 rounded-full ${e.source==="LA"?"bg-blue-900/40 text-blue-300":"bg-orange-900/40 text-orange-300"}`}>{e.source}</span></td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length>300&&<p className="text-center text-gray-500 text-sm mt-3">Showing 300 of {filtered.length} — use filters to narrow</p>}
        </div>
      )}

      {tab==="attendants"&&(
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3 w-6">#</th><th className="text-left py-2 pr-6">Attendant</th>
              <th className="text-left py-2 pr-6">Events</th><th className="text-left py-2 pr-6">Share</th>
              <th className="text-left py-2">Specialty</th>
            </tr></thead>
            <tbody>{Object.entries(stats.atts).filter(([k])=>k.length>1).sort((a,b)=>b[1]-a[1]).map(([name,count],i)=>{
              const pct=((count/stats.total)*100).toFixed(1);
              const tm:Record<string,number>={};
              filtered.filter(e=>e.attendant===name).forEach(e=>{tm[e.event_type||"Other"]=(tm[e.event_type||"Other"]||0)+1;});
              const top=Object.entries(tm).sort((a,b)=>b[1]-a[1])[0];
              return (<tr key={name} className="border-b border-gray-900 hover:bg-gray-900/50">
                <td className="py-2 pr-3 text-gray-600 text-xs">{i+1}</td>
                <td className="py-2 pr-6 font-medium text-white">{name}</td>
                <td className="py-2 pr-6 text-blue-400 font-bold text-lg">{count}</td>
                <td className="py-2 pr-6"><div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-800 rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{width:`${Math.min(parseFloat(pct),100)}%`}}/></div>
                  <span className="text-gray-400 text-xs">{pct}%</span>
                </div></td>
                <td className="py-2">{top&&<Badge label={`${top[0]} · ${top[1]}`} color={TYPE_COLORS[top[0]]||"#6b7280"}/>}</td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Module: Pre-Event Ops ────────────────────────────────────────────────────

function PreOpsModule({ confirmations, equipment }: { confirmations:Confirmation[]; equipment:EquipmentCheck[] }) {
  const [tab,setTab] = useState<"confirmations"|"equipment">("confirmations");

  const confStats = useMemo(()=>{
    const callDone = confirmations.filter(c=>c.confirmed_call.toLowerCase().includes("yes")).length;
    const emailSent = confirmations.filter(c=>c.email_sent.toLowerCase().includes("yes")).length;
    const emailAcked = confirmations.filter(c=>c.email_acked.toLowerCase().includes("yes")).length;
    return { total:confirmations.length, callDone, emailSent, emailAcked };
  },[confirmations]);

  const eqStats = useMemo(()=>{
    const allReady = equipment.filter(e=>
      e.props_ready.toLowerCase().includes("yes")&&
      e.backdrop_ready.toLowerCase().includes("yes")&&
      e.ink_paper.toLowerCase().includes("yes")
    ).length;
    return { total:equipment.length, allReady };
  },[equipment]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending Confirmations" value={confStats.total} color="text-blue-400"/>
        <StatCard label="Calls Done" value={confStats.callDone} sub={`of ${confStats.total}`} color="text-emerald-400"/>
        <StatCard label="Emails Sent" value={confStats.emailSent} sub={`of ${confStats.total}`} color="text-yellow-400"/>
        <StatCard label="Email Acknowledged" value={confStats.emailAcked} sub={`of ${confStats.total}`} color="text-purple-400"/>
      </div>

      <div className="flex gap-2">
        {(["confirmations","equipment"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-1.5 text-sm capitalize rounded-lg transition ${tab===t?"bg-blue-600 text-white":"text-gray-400 hover:text-white"}`}>{t}</button>
        ))}
      </div>

      {tab==="confirmations"&&(
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Client</th>
              <th className="text-left py-2 pr-3">City</th><th className="text-left py-2 pr-3">Time</th>
              <th className="text-left py-2 pr-3 text-center">Call</th>
              <th className="text-left py-2 pr-3 text-center">Email Sent</th>
              <th className="text-left py-2 text-center">Acked</th>
            </tr></thead>
            <tbody>{confirmations.slice(0,200).map((c,i)=>(
              <tr key={i} className="border-b border-gray-900 hover:bg-gray-900/50">
                <td className="py-1.5 pr-3 text-gray-300 text-xs whitespace-nowrap">{fmtDate(c.date)}</td>
                <td className="py-1.5 pr-3 text-white font-medium">{c.client}</td>
                <td className="py-1.5 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.city==="LA"?"bg-blue-900/40 text-blue-300":"bg-orange-900/40 text-orange-300"}`}>{c.city||"—"}</span></td>
                <td className="py-1.5 pr-3 text-gray-400 text-xs">{c.start} – {c.end}</td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={c.confirmed_call}/></td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={c.email_sent}/></td>
                <td className="py-1.5 text-center"><CheckDot val={c.email_acked}/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab==="equipment"&&(
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Client</th>
              <th className="text-center py-2 pr-3">BoothBook</th><th className="text-center py-2 pr-3">Props</th>
              <th className="text-center py-2 pr-3">Backdrop</th><th className="text-center py-2 pr-3">Ink/Paper</th>
              <th className="text-center py-2">Equipment</th>
            </tr></thead>
            <tbody>{equipment.map((e,i)=>(
              <tr key={i} className="border-b border-gray-900 hover:bg-gray-900/50">
                <td className="py-1.5 pr-3 text-gray-300 text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="py-1.5 pr-3 text-white font-medium">{e.client}</td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={e.boothbook_checked}/></td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={e.props_ready}/></td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={e.backdrop_ready}/></td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={e.ink_paper}/></td>
                <td className="py-1.5 text-center"><CheckDot val={e.equipment_collected}/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Module: Post-Event Quality ───────────────────────────────────────────────

function PostEventModule({ postEvent, feedback }: { postEvent:PostEvent[]; feedback:FeedbackRecord[] }) {
  const [tab,setTab] = useState<"followup"|"feedback">("followup");

  const stats = useMemo(()=>{
    const reviewsSent = postEvent.filter(p=>p.review_email_sent.toLowerCase().includes("yes")).length;
    const reviewsPosted = postEvent.filter(p=>p.client_posted_review.toLowerCase().includes("yes")).length;
    const digitalsConf = postEvent.filter(p=>p.digitals_confirmed.toLowerCase().includes("yes")).length;
    const rebookYes = feedback.filter(f=>f.rebook.toLowerCase().includes("yes")).length;
    return { total:postEvent.length, reviewsSent, reviewsPosted, digitalsConf, fbTotal:feedback.length, rebookYes };
  },[postEvent,feedback]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Feedback Records" value={stats.fbTotal.toLocaleString()} color="text-blue-400"/>
        <StatCard label="Reviews Sent" value={stats.reviewsSent} sub={`of ${stats.total}`} color="text-emerald-400"/>
        <StatCard label="Reviews Posted" value={stats.reviewsPosted} sub="by clients" color="text-yellow-400"/>
        <StatCard label="Rebook Intent" value={stats.rebookYes} sub="said yes to rebook" color="text-pink-400"/>
      </div>

      <div className="flex gap-2">
        {(["followup","feedback"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-1.5 text-sm capitalize rounded-lg transition ${tab===t?"bg-blue-600 text-white":"text-gray-400 hover:text-white"}`}>{t}</button>
        ))}
      </div>

      {tab==="followup"&&(
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Client</th>
              <th className="text-center py-2 pr-3">Fb Call</th><th className="text-center py-2 pr-3">Fb Email</th>
              <th className="text-center py-2 pr-3">Quality</th><th className="text-center py-2 pr-3">Review Sent</th>
              <th className="text-center py-2 pr-3">Reviewed</th><th className="text-center py-2">Digitals</th>
            </tr></thead>
            <tbody>{postEvent.slice(0,200).map((p,i)=>(
              <tr key={i} className="border-b border-gray-900 hover:bg-gray-900/50">
                <td className="py-1.5 pr-3 text-gray-300 text-xs whitespace-nowrap">{fmtDate(p.date)}</td>
                <td className="py-1.5 pr-3 text-white font-medium">{p.client}</td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={p.feedback_call}/></td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={p.feedback_email}/></td>
                <td className="py-1.5 pr-3 text-center">
                  {p.feedback_quality ? <span className={`text-xs ${p.feedback_quality.toLowerCase().includes("good")?"text-emerald-400":p.feedback_quality.toLowerCase().includes("bad")?"text-red-400":"text-gray-400"}`}>{p.feedback_quality.slice(0,10)}</span> : <span className="text-gray-700">·</span>}
                </td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={p.review_email_sent}/></td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={p.client_posted_review}/></td>
                <td className="py-1.5 text-center"><CheckDot val={p.digitals_confirmed}/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab==="feedback"&&(
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Client</th>
              <th className="text-left py-2 pr-3">Attendant</th><th className="text-left py-2 pr-3">Status</th>
              <th className="text-left py-2 pr-3">Remarks</th><th className="text-center py-2 pr-3">Rebook</th>
              <th className="text-center py-2">Review Sent</th>
            </tr></thead>
            <tbody>{feedback.filter(f=>f.remarks||f.status).slice(0,300).map((f,i)=>(
              <tr key={i} className="border-b border-gray-900 hover:bg-gray-900/50">
                <td className="py-1.5 pr-3 text-gray-300 text-xs whitespace-nowrap">{fmtDate(f.date)}</td>
                <td className="py-1.5 pr-3 text-white font-medium max-w-[120px] truncate">{f.client}</td>
                <td className="py-1.5 pr-3 text-gray-300 text-xs">{f.attendant||"—"}</td>
                <td className="py-1.5 pr-3"><span className={`text-xs ${f.status.toLowerCase().includes("complet")?"text-emerald-400":"text-gray-400"}`}>{f.status||"—"}</span></td>
                <td className="py-1.5 pr-3 text-gray-400 text-xs max-w-[200px] truncate">{f.remarks||"—"}</td>
                <td className="py-1.5 pr-3 text-center"><CheckDot val={f.rebook}/></td>
                <td className="py-1.5 text-center"><CheckDot val={f.review_sent}/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Module: Payroll & Miles ──────────────────────────────────────────────────

function PayrollModule({ payroll }: { payroll:PayrollRecord[] }) {
  const [city,setCity] = useState("All");
  const [attFilter,setAttFilter] = useState("All");

  const attendants = useMemo(()=>["All",...Array.from(new Set(payroll.map(p=>p.attendant).filter(a=>a&&a.length>1))).sort()],[payroll]);

  const filtered = useMemo(()=>payroll.filter(p=>{
    if (city!=="All" && p.city!==city) return false;
    if (attFilter!=="All" && p.attendant!==attFilter) return false;
    return true;
  }),[payroll,city,attFilter]);

  const stats = useMemo(()=>{
    let totalPay=0, totalMiles=0, totalHours=0;
    const byAtt:Record<string,{events:number;pay:number;miles:number}> = {};
    filtered.forEach(p=>{
      totalPay+=parseCurrency(p.total_pay);
      totalMiles+=parseCurrency(p.miles);
      totalHours+=parseCurrency(p.hours);
      if(!byAtt[p.attendant]) byAtt[p.attendant]={events:0,pay:0,miles:0};
      byAtt[p.attendant].events++;
      byAtt[p.attendant].pay+=parseCurrency(p.total_pay);
      byAtt[p.attendant].miles+=parseCurrency(p.miles);
    });
    return { total:filtered.length, totalPay, totalMiles, totalHours, byAtt };
  },[filtered]);

  const Sel=({val,onChange,opts}:{val:string;onChange:(v:string)=>void;opts:string[]})=>(
    <select value={val} onChange={e=>onChange(e.target.value)}
      className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        <Sel val={city} onChange={setCity} opts={["All","LA","Dallas"]}/>
        <Sel val={attFilter} onChange={setAttFilter} opts={attendants}/>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Events Logged" value={stats.total.toLocaleString()} color="text-blue-400"/>
        <StatCard label="Total Payroll" value={stats.totalPay>0?`$${stats.totalPay.toFixed(0)}`:"See records"} color="text-emerald-400"/>
        <StatCard label="Total Miles" value={stats.totalMiles>0?`${stats.totalMiles.toFixed(0)} mi`:"See records"} color="text-yellow-400"/>
        <StatCard label="Total Hours" value={stats.totalHours>0?`${stats.totalHours.toFixed(0)} hrs`:"See records"} color="text-purple-400"/>
      </div>

      <Card>
        <SectionTitle>Attendant Summary</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-4">Attendant</th><th className="text-left py-2 pr-4">Events</th>
              <th className="text-left py-2 pr-4">Total Pay</th><th className="text-left py-2">Miles</th>
            </tr></thead>
            <tbody>{Object.entries(stats.byAtt).filter(([k])=>k&&k.length>1).sort((a,b)=>b[1].events-a[1].events).map(([name,s])=>(
              <tr key={name} className="border-b border-gray-900 hover:bg-gray-900/50">
                <td className="py-2 pr-4 text-white font-medium">{name}</td>
                <td className="py-2 pr-4 text-blue-400 font-bold">{s.events}</td>
                <td className="py-2 pr-4 text-emerald-400">{s.pay>0?`$${s.pay.toFixed(0)}`:"—"}</td>
                <td className="py-2 text-yellow-400">{s.miles>0?`${s.miles.toFixed(0)} mi`:"—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
            <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Attendant</th>
            <th className="text-left py-2 pr-3">Client</th><th className="text-left py-2 pr-3">Time</th>
            <th className="text-left py-2 pr-3">Miles</th><th className="text-left py-2 pr-3">Hours</th>
            <th className="text-left py-2 pr-3">Gas Pay</th><th className="text-left py-2 pr-3">Total Pay</th>
            <th className="text-left py-2">City</th>
          </tr></thead>
          <tbody>{filtered.slice(0,300).map((p,i)=>(
            <tr key={i} className="border-b border-gray-900 hover:bg-gray-900/50">
              <td className="py-1.5 pr-3 text-gray-300 text-xs whitespace-nowrap">{fmtDate(p.date)}</td>
              <td className="py-1.5 pr-3 text-white font-medium">{p.attendant||"—"}</td>
              <td className="py-1.5 pr-3 text-gray-300 text-xs max-w-[120px] truncate">{p.client||"—"}</td>
              <td className="py-1.5 pr-3 text-gray-400 text-xs whitespace-nowrap">{p.start} – {p.end}</td>
              <td className="py-1.5 pr-3 text-yellow-400 text-xs">{p.miles||"—"}</td>
              <td className="py-1.5 pr-3 text-gray-400 text-xs">{p.hours||"—"}</td>
              <td className="py-1.5 pr-3 text-blue-400 text-xs">{p.gas_pay||"—"}</td>
              <td className="py-1.5 pr-3 text-emerald-400 text-xs font-medium">{p.total_pay||"—"}</td>
              <td className="py-1.5"><span className={`text-xs px-2 py-0.5 rounded-full ${p.city==="LA"?"bg-blue-900/40 text-blue-300":"bg-orange-900/40 text-orange-300"}`}>{p.city}</span></td>
            </tr>
          ))}</tbody>
        </table>
        {filtered.length>300&&<p className="text-center text-gray-500 text-sm mt-3">Showing 300 of {filtered.length}</p>}
      </div>
    </div>
  );
}

// ─── Module: Attendant Roster ─────────────────────────────────────────────────

function RosterModule({ attendants }: { attendants:Attendant[] }) {
  const [filter,setFilter] = useState("All");
  const filtered = useMemo(()=>attendants.filter(a=>{
    if (filter==="Active") return a.status.toLowerCase().includes("active")&&!a.status.toLowerCase().includes("inactive");
    if (filter==="Inactive") return a.status.toLowerCase().includes("inactive");
    if (filter==="Has Booth") return a.has_booth.toLowerCase().includes("has");
    return true;
  }),[attendants,filter]);

  const active = attendants.filter(a=>a.status.toLowerCase()==="active").length;
  const hasBooth = attendants.filter(a=>a.has_booth.toLowerCase().includes("has")).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Attendants" value={attendants.length} color="text-blue-400"/>
        <StatCard label="Active" value={active} color="text-emerald-400"/>
        <StatCard label="Inactive" value={attendants.length-active} color="text-gray-400"/>
        <StatCard label="Own a Booth" value={hasBooth} color="text-yellow-400"/>
      </div>

      <div className="flex gap-2">
        {["All","Active","Inactive","Has Booth"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-4 py-1.5 text-sm rounded-lg transition ${filter===f?"bg-blue-600 text-white":"text-gray-400 hover:text-white border border-gray-700"}`}>{f}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((a,i)=>(
          <Card key={i}>
            <div className="flex items-start justify-between">
              <div className="font-semibold text-white text-lg">{a.name.trim()}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${a.status.toLowerCase()==="active"?"bg-emerald-900/50 text-emerald-400":a.status?"bg-gray-800 text-gray-400":"bg-gray-800 text-gray-600"}`}>
                {a.status||"Unknown"}
              </span>
            </div>
            {a.has_booth.toLowerCase().includes("has")&&<div className="text-xs text-yellow-400 mt-1">📷 Has booth</div>}
            {a.phone&&<div className="text-xs text-gray-400 mt-2">📞 {a.phone}</div>}
            {a.address&&<div className="text-xs text-gray-500 mt-1 leading-relaxed">{a.address.split("\n")[0]}</div>}
            {a.availability&&<div className="text-xs text-orange-400 mt-2 leading-relaxed">⚠ {a.availability.slice(0,100)}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Module: Inventory ────────────────────────────────────────────────────────

function InventoryModule() {
  const booths = [
    { name:"Booth A – Sufyaan", backdrops:"Gold, Rose Gold, Silver", printer:"DS40", status:"good", notes:"" },
    { name:"Booth WB2 – Yawer", backdrops:"Gold, Rose Gold", printer:"DS40", status:"good", notes:"'O Baby' & 'Lets Party' neon signs" },
    { name:"Booth WB – Ian", backdrops:"White, Black, Silver, Gold, Champagne, Rose Gold, Green Screen, HBD Neon", printer:"good — jamming issues", status:"warning", notes:"Password: 123654" },
    { name:"Booth F – Vy Tran", backdrops:"Gold, Black", printer:"RX1", status:"warning", notes:"iPad battery bad — needs replacement" },
    { name:"Booth 1 – Cameron", backdrops:"Gold, Silver, Green Screen", printer:"good", status:"warning", notes:"Stands too low — need replacements" },
    { name:"360 Booth", backdrops:"—", printer:"—", status:"good", notes:"" },
    { name:"Glam Booth", backdrops:"—", printer:"—", status:"unknown", notes:"" },
    { name:"DSLR Booth", backdrops:"—", printer:"None", status:"unknown", notes:"No printer" },
    { name:"Digital Booth", backdrops:"—", printer:"—", status:"good", notes:"" },
  ];
  const itemsNeeded = [
    "Ring light + iPad holder (heavy duty) — Booth A",
    "Backdrop stand — Booth A",
    "New stands (current too low) — Booth 1/Cameron",
    "iPad battery replacement — Booth F/Vy Tran",
    "Printer jam fix — Booth WB/Ian",
    "Broken ring light — Booth A",
    "Broken stand — LA Payroll",
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Booths" value={booths.length} color="text-blue-400"/>
        <StatCard label="Good Condition" value={booths.filter(b=>b.status==="good").length} color="text-emerald-400"/>
        <StatCard label="Needs Attention" value={booths.filter(b=>b.status==="warning").length} color="text-yellow-400"/>
        <StatCard label="Items Needed" value={itemsNeeded.length} color="text-red-400"/>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {booths.map((b,i)=>(
          <Card key={i}>
            <div className="flex items-start justify-between">
              <div className="font-semibold text-white">{b.name}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                b.status==="good"?"bg-emerald-900/50 text-emerald-400":
                b.status==="warning"?"bg-yellow-900/50 text-yellow-400":
                "bg-gray-800 text-gray-500"}`}>
                {b.status}
              </span>
            </div>
            {b.backdrops!=="—"&&<div className="text-xs text-gray-400 mt-2">🎨 <span className="text-gray-300">{b.backdrops}</span></div>}
            {b.printer!=="—"&&<div className="text-xs text-gray-400 mt-1">🖨 <span className={b.printer.toLowerCase().includes("jam")?"text-yellow-400":"text-gray-300"}>{b.printer}</span></div>}
            {b.notes&&<div className="text-xs text-gray-500 mt-2 italic">{b.notes}</div>}
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle>Items Needed / Issues</SectionTitle>
        <div className="flex flex-col gap-2">
          {itemsNeeded.map((item,i)=>(
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-red-400 mt-0.5">⚠</span>
              <span className="text-gray-300">{item}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [sheets, setSheets] = useState<{
    payroll:PayrollRecord[]; attendants:Attendant[]; feedback:FeedbackRecord[];
    confirmations:Confirmation[]; equipment:EquipmentCheck[]; post_event:PostEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState("events");

  useEffect(()=>{
    Promise.all([
      fetch("/events.json").then(r=>r.json()),
      fetch("/sheets.json").then(r=>r.json()),
    ]).then(([e,s])=>{ setEvents(e); setSheets(s); setLoading(false); });
  },[]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-gray-400 text-lg animate-pulse">Loading Markybooth...</div>
    </div>
  );

  const current = MODULES.find(m=>m.id===module)!;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">📸 Markybooth</h1>
          <p className="text-gray-500 text-xs">Operations Dashboard · LA &amp; Dallas</p>
        </div>
        <div className="text-gray-500 text-xs">{events.length.toLocaleString()} events tracked</div>
      </div>

      {/* Module Nav */}
      <div className="border-b border-gray-800 px-6 py-0 flex overflow-x-auto">
        {MODULES.map(m=>(
          <button key={m.id} onClick={()=>setModule(m.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition ${
              module===m.id?"border-blue-500 text-white":"border-transparent text-gray-500 hover:text-gray-300"}`}>
            <span>{m.icon}</span><span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Module Content */}
      <div className="px-6 py-6">
        <div className="text-lg font-semibold mb-4">{current.icon} {current.label}</div>
        {module==="events"&&<EventsModule events={events}/>}
        {module==="preops"&&sheets&&<PreOpsModule confirmations={sheets.confirmations} equipment={sheets.equipment}/>}
        {module==="postops"&&sheets&&<PostEventModule postEvent={sheets.post_event} feedback={sheets.feedback}/>}
        {module==="payroll"&&sheets&&<PayrollModule payroll={sheets.payroll}/>}
        {module==="roster"&&sheets&&<RosterModule attendants={sheets.attendants}/>}
        {module==="inventory"&&<InventoryModule/>}
      </div>
    </div>
  );
}
