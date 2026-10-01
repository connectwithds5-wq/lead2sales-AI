"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Lead = {
  id:string; name:string; company_name:string|null; phone:string|null; email:string|null;
  requirement:string; status:string; estimated_value:number; created_at:string;
  lead_category:string|null; source?:string|null;
};

const SOURCES = [
  { key:"email", label:"Email", icon:"✉", cls:"sourceEmail", desc:"Inbound emails become leads automatically" },
  { key:"whatsapp", label:"WhatsApp", icon:"◉", cls:"sourceWhatsApp", desc:"WhatsApp enquiries and campaigns" },
  { key:"website", label:"Website", icon:"⌂", cls:"sourceWebsite", desc:"Public form, landing page or website widget" },
  { key:"instagram", label:"Instagram", icon:"◎", cls:"sourceInstagram", desc:"Instagram DM / social enquiries" },
  { key:"facebook", label:"Facebook / Meta", icon:"f", cls:"sourceFacebook", desc:"Meta lead forms and campaigns" },
  { key:"google_ads", label:"Google Ads", icon:"G", cls:"sourceGoogle", desc:"Search and lead-form campaigns" },
  { key:"phone", label:"Phone / Call", icon:"☎", cls:"sourcePhone", desc:"Call, missed call or sales callback" },
  { key:"referral", label:"Referral", icon:"↗", cls:"sourceReferral", desc:"Partner, customer or employee referral" },
  { key:"walk_in", label:"Walk-in", icon:"↘", cls:"sourceWalkin", desc:"Physical enquiry or showroom visit" },
  { key:"manual", label:"Manual", icon:"+", cls:"sourceManual", desc:"Salesperson-created lead" },
  { key:"api", label:"API / Import", icon:"⇄", cls:"sourceApi", desc:"CSV, ERP, webhook or future integrations" },
];

const CATEGORIES = ["CCTV","Networking","Access Control","Fire Alarm","Wi-Fi","Server & Storage","Solar","Communication","Other"];
const STAGES = [
  {key:"new",label:"New",cls:"stageNew"},
  {key:"contacted",label:"Contacted",cls:"stageContacted"},
  {key:"qualified",label:"Qualified",cls:"stageQualified"},
  {key:"proposal",label:"Proposal",cls:"stageProposal"},
  {key:"negotiation",label:"Negotiation",cls:"stageNegotiation"},
  {key:"won",label:"Won",cls:"stageWon"},
  {key:"lost",label:"Lost",cls:"stageLost"},
];

function money(n:number){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0)}
function sourceLabel(value?:string|null){return SOURCES.find(s=>s.key===value)?.label || (value ? value.replace(/_/g," ") : "Unknown")}
function sourceKey(value?:string|null){const v=(value||"manual").toLowerCase().replace(/\s+/g,"_"); if(v==="web"||v==="web_form"||v==="website_form")return "website"; if(v==="gmail"||v==="mail")return "email"; if(v==="wa")return "whatsapp"; return SOURCES.some(s=>s.key===v)?v:"manual"}

export default function SalesCommandCenter(){
 const [leads,setLeads]=useState<Lead[]>([]);
 const [quotes,setQuotes]=useState<any[]>([]);
 const [business,setBusiness]=useState("Your Workspace");
 const [view,setView]=useState("overview");
 const [sourceFilter,setSourceFilter]=useState("all");
 const [categoryFilter,setCategoryFilter]=useState("All");
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");

 async function load(){
   setLoading(true); setError("");
   const cid=localStorage.getItem("lead2sales_company_id");
   if(!cid){setError("Workspace not found.");setLoading(false);return}
   const [{data:co},{data:leadData,error:leadError},{data:quoteData}]=await Promise.all([
     supabase.from("companies").select("name").eq("id",cid).maybeSingle(),
     supabase.from("leads").select("id,name,company_name,phone,email,requirement,status,estimated_value,created_at,lead_category,source").eq("company_id",cid).order("created_at",{ascending:false}),
     supabase.from("quotations").select("id,status,grand_total,created_at").eq("company_id",cid).order("created_at",{ascending:false})
   ]);
   if(co?.name)setBusiness(co.name);
   if(leadError)setError(leadError.message); else setLeads((leadData||[]) as Lead[]);
   setQuotes(quoteData||[]);
   setLoading(false);
 }
 useEffect(()=>{void load()},[]);

 const filtered=useMemo(()=>leads.filter(l=>{
   const src=sourceKey(l.source);
   return (sourceFilter==="all"||src===sourceFilter) &&
     (categoryFilter==="All"||l.lead_category===categoryFilter) &&
     [l.name,l.company_name||"",l.email||"",l.phone||"",l.requirement].join(" ").toLowerCase().includes(search.toLowerCase());
 }),[leads,sourceFilter,categoryFilter,search]);

 const sourceCounts=useMemo(()=>Object.fromEntries(SOURCES.map(s=>[s.key,leads.filter(l=>sourceKey(l.source)===s.key).length])),[leads]);
 const pipeline=leads.reduce((a,l)=>a+Number(l.estimated_value||0),0);
 const won=leads.filter(l=>l.status==="won");
 const followups=leads.filter(l=>l.next_follow_up_at && new Date(l.next_follow_up_at)<=new Date());
 const quoted=quotes.reduce((a,q)=>a+Number(q.grand_total||0),0);
 const active=leads.filter(l=>!["won","lost"].includes(l.status));

 return <div className="ccWrap">
   <div className="ccHero">
     <div>
       <span className="ccEyebrow">LEAD2SALES · SALES COMMAND CENTER</span>
       <h1>Every enquiry. One flow. One next action.</h1>
       <p>Capture leads from every channel, qualify them, quote faster and keep follow-ups visible.</p>
     </div>
     <div className="ccHeroActions">
       <button className="ccPrimary" onClick={()=>window.location.href="/?newLead=1"}>＋ New Lead</button>
       <button className="ccGhost" onClick={()=>setView("sources")}>⚡ Connect Sources</button>
     </div>
   </div>

   <div className="ccKpis">
     <div className="ccKpi"><span>All Leads</span><b>{leads.length}</b><small>Across every channel</small></div>
     <div className="ccKpi ccKpiBlue"><span>Active Pipeline</span><b>{money(pipeline)}</b><small>{active.length} open opportunities</small></div>
     <div className="ccKpi ccKpiGreen"><span>Won</span><b>{won.length}</b><small>{money(won.reduce((a,l)=>a+Number(l.estimated_value||0),0))} closed value</small></div>
     <div className="ccKpi ccKpiOrange"><span>Action Needed</span><b>{followups.length}</b><small>Follow-ups due / overdue</small></div>
     <div className="ccKpi ccKpiPurple"><span>Quoted</span><b>{money(quoted)}</b><small>{quotes.length} quotations</small></div>
   </div>

   <div className="ccFlow">
     {[
       ["01","CAPTURE","Email · WhatsApp · Website · Ads · Calls","flowBlue"],
       ["02","QUALIFY","AI requirement + category + priority","flowPurple"],
       ["03","QUOTE","BOQ · pricing · quotation · email","flowOrange"],
       ["04","FOLLOW UP","Tasks · reminders · WhatsApp · email","flowGreen"],
       ["05","CLOSE","Won · Lost · customer history","flowDark"]
     ].map((x,i)=><div className="ccFlowStep" key={x[1]}><span className={"ccFlowNo "+x[3]}>{x[0]}</span><div><b>{x[1]}</b><small>{x[2]}</small></div>{i<4&&<i>→</i>}</div>)}
   </div>

   <div className="ccSectionHead">
     <div><span className="ccEyebrow">INBOUND UNIVERSE</span><h2>Where your leads come from</h2><p>Every source gets its own identity, but all leads enter the same pipeline.</p></div>
     <button className="ccGhost" onClick={()=>setView("sources")}>Manage all sources →</button>
   </div>
   <div className="ccSourceGrid">
     {SOURCES.map(s=><button key={s.key} className={"ccSourceCard "+s.cls+(sourceFilter===s.key?" selected":"")} onClick={()=>{setSourceFilter(sourceFilter===s.key?"all":s.key);setView("leads")}}>
       <span className="ccSourceIcon">{s.icon}</span><span className="ccSourceText"><b>{s.label}</b><small>{s.desc}</small></span><strong>{sourceCounts[s.key]||0}</strong>
     </button>)}
   </div>

   <div className="ccMainGrid">
     <section className="ccPanel ccPipelinePanel">
       <div className="ccSectionHead compact"><div><span className="ccEyebrow">LIVE PIPELINE</span><h2>Lead workspace</h2></div><div className="ccFilters">
         <input placeholder="Search name, company, phone..." value={search} onChange={e=>setSearch(e.target.value)}/>
         <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option>All</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
       </div></div>
       <div className="ccStageStrip">{STAGES.map(s=><button key={s.key} className={s.cls} onClick={()=>setSearch(s.label)}><b>{leads.filter(l=>l.status===s.key).length}</b><span>{s.label}</span></button>)}</div>
       <div className="ccLeadList">
         {loading?<div className="ccEmpty">Loading leads…</div>:filtered.slice(0,12).map(l=><div className="ccLeadRow" key={l.id}>
           <div className="ccAvatar">{l.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div>
           <div className="ccLeadIdentity"><b>{l.name}</b><small>{l.company_name||"Individual customer"} · {sourceLabel(l.source)}</small></div>
           <div className="ccRequirement"><b>{l.lead_category||"Other"}</b><span>{l.requirement||"Requirement not captured yet"}</span></div>
           <span className={"ccStatus "+(l.status||"new")}>{(l.status||"new").replace("_"," ")}</span>
           <strong>{money(Number(l.estimated_value||0))}</strong>
           <div className="ccActions"><button onClick={()=>window.location.href="/?lead="+l.id}>Open</button><button onClick={()=>l.phone&&window.open("https://wa.me/"+l.phone.replace(/\D/g,""),"_blank")}>WhatsApp</button></div>
         </div>)}{!loading&&!filtered.length&&<div className="ccEmpty">No matching leads.</div>}
       </div>
     </section>

     <aside className="ccPanel ccActionPanel">
       <div className="ccSectionHead compact"><div><span className="ccEyebrow">TODAY</span><h2>Next actions</h2></div></div>
       <div className="ccActionCard ccActionHot"><span>🔥</span><div><b>Hot leads</b><small>{leads.filter(l=>l.status==="hot").length} need attention</small></div><strong>→</strong></div>
       <div className="ccActionCard ccActionFollow"><span>⏰</span><div><b>Follow-ups due</b><small>{followups.length} need action</small></div><strong>→</strong></div>
       <div className="ccActionCard ccActionQuote"><span>🧾</span><div><b>Quotation queue</b><small>{quotes.filter(q=>["draft","sent"].includes(q.status)).length} open quotes</small></div><strong>→</strong></div>
       <div className="ccActionCard ccActionInbox"><span>📥</span><div><b>Unprocessed inbound</b><small>Email / API / future channels</small></div><strong>→</strong></div>
       <div className="ccMiniFlow"><b>Recommended operating rule</b><span>Every new lead must end this cycle with an owner, stage, next action and follow-up date.</span></div>
     </aside>
   </div>

   <div className="ccSectionHead"><div><span className="ccEyebrow">BUSINESS CATEGORIES</span><h2>What customers are asking for</h2></div></div>
   <div className="ccCategoryGrid">{CATEGORIES.map(c=>{const count=leads.filter(l=>l.lead_category===c).length;return <button key={c} className="ccCategoryCard" onClick={()=>setCategoryFilter(c)}><span>{c}</span><b>{count}</b><small>{count===1?"lead":"leads"}</small></button>})}</div>

   {view==="sources"&&<div className="ccModalBackdrop" onClick={()=>setView("overview")}><div className="ccModal" onClick={e=>e.stopPropagation()}><div className="ccModalHead"><div><span className="ccEyebrow">SOURCE CENTER</span><h2>Connect every lead channel</h2><p>Turn each channel into a controlled Lead2Sales source.</p></div><button onClick={()=>setView("overview")}>×</button></div><div className="ccIntegrationGrid">{SOURCES.map(s=><div className="ccIntegration" key={s.key}><span className={"ccSourceIcon "+s.cls}>{s.icon}</span><div><b>{s.label}</b><small>{s.desc}</small></div><button className="ccGhost" onClick={()=>{if(s.key==="email"||s.key==="whatsapp"||s.key==="website")window.location.href="/?leadSources=1";else alert(s.label+" connector is planned in the source roadmap.")}}>{s.key==="email"||s.key==="whatsapp"||s.key==="website"?"Configure":"Plan connector"}</button></div>)}</div><div className="ccRoadmap"><b>Source roadmap</b><span>Phase 1: Email + Website + WhatsApp · Phase 2: Meta + Instagram · Phase 3: Google Ads + API/ERP + imports · Phase 4: Calls, AI chat and advanced routing.</span></div></div></div>}
   {error&&<div className="ccError">{error}</div>}
 </div>
}
