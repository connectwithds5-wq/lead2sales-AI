"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Lead = {
  id:string; name:string; company_name:string|null; phone:string|null; email:string|null;
  requirement:string; status:string; estimated_value:number; created_at:string;
  lead_category:string|null; next_follow_up_at?:string|null; source?:string|null;
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
 const router=useRouter();
 const [leads,setLeads]=useState<Lead[]>([]);
 const [quotes,setQuotes]=useState<any[]>([]);
 const [business,setBusiness]=useState("Your Workspace");
 const [view,setView]=useState("overview");
 const [sourceFilter,setSourceFilter]=useState("all");
 const [stageFilter,setStageFilter]=useState("all");
 const [categoryFilter,setCategoryFilter]=useState("All");
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [showNewLead,setShowNewLead]=useState(false);
 const [selectedLead,setSelectedLead]=useState<Lead|null>(null);
 const [savingLead,setSavingLead]=useState(false);
 const [newLead,setNewLead]=useState({name:"",company_name:"",phone:"",email:"",requirement:"",estimated_value:"",source:"manual",lead_category:"Other",status:"new",next_follow_up_at:""});

 async function load(){
   setLoading(true); setError("");
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){router.replace("/login");return}
   const cid=localStorage.getItem("lead2sales_company_id");
   if(!cid){router.replace("/onboarding");return}
   if(!cid){setError("Workspace not found.");setLoading(false);return}
   const [{data:co},{data:leadData,error:leadError},{data:quoteData}]=await Promise.all([
     supabase.from("companies").select("name").eq("id",cid).maybeSingle(),
     supabase.from("leads").select("id,name,company_name,phone,email,requirement,status,estimated_value,created_at,lead_category,next_follow_up_at,source").eq("company_id",cid).order("created_at",{ascending:false}),
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
     (stageFilter==="all"||l.status===stageFilter) &&
     (categoryFilter==="All"||l.lead_category===categoryFilter) &&
     [l.name,l.company_name||"",l.email||"",l.phone||"",l.requirement].join(" ").toLowerCase().includes(search.toLowerCase());
 }),[leads,sourceFilter,stageFilter,categoryFilter,search]);

 const sourceCounts=useMemo(()=>Object.fromEntries(SOURCES.map(s=>[s.key,leads.filter(l=>sourceKey(l.source)===s.key).length])),[leads]);
 const pipeline=leads.filter(l=>!["won","lost"].includes(l.status)).reduce((a,l)=>a+Number(l.estimated_value||0),0);
 const won=leads.filter(l=>l.status==="won");
 const followups=leads.filter(l=>l.next_follow_up_at && new Date(l.next_follow_up_at)<=new Date());
 const quoted=quotes.reduce((a,q)=>a+Number(q.grand_total||0),0);
 const active=leads.filter(l=>!["won","lost"].includes(l.status));
 async function createLead(){
   const cid=localStorage.getItem("lead2sales_company_id");
   if(!cid||!newLead.name.trim()||!newLead.requirement.trim()){setError("Name and requirement are required.");return}
   setSavingLead(true); setError("");
   const payload={id:crypto.randomUUID(),company_id:cid,name:newLead.name.trim(),company_name:newLead.company_name.trim()||null,phone:newLead.phone.trim()||null,email:newLead.email.trim().toLowerCase()||null,requirement:newLead.requirement.trim(),estimated_value:Number(newLead.estimated_value||0),source:newLead.source,lead_category:newLead.lead_category,status:newLead.status,next_follow_up_at:newLead.next_follow_up_at?new Date(newLead.next_follow_up_at).toISOString():null};
   const {data,error:insertError}=await supabase.from("leads").insert(payload).select("id,name,company_name,phone,email,requirement,status,estimated_value,created_at,lead_category,next_follow_up_at,source").single();
   if(insertError)setError(insertError.message); else {setLeads([data as Lead,...leads]);setShowNewLead(false);setNewLead({name:"",company_name:"",phone:"",email:"",requirement:"",estimated_value:"",source:"manual",lead_category:"Other",status:"new",next_follow_up_at:""});}
   setSavingLead(false);
 }
 async function updateLead(patch:Partial<Lead>){
   if(!selectedLead)return;
   const {data,error:updateError}=await supabase.from("leads").update(patch).eq("id",selectedLead.id).eq("company_id",localStorage.getItem("lead2sales_company_id")||"").select("id,name,company_name,phone,email,requirement,status,estimated_value,created_at,lead_category,next_follow_up_at,source").single();
   if(updateError){setError(updateError.message);return}
   setLeads(leads.map(l=>l.id===selectedLead.id?data as Lead:l));setSelectedLead(data as Lead);
 }

 return <div className="ccWrap">
   <div className="ccHero">
     <div>
       <span className="ccEyebrow">LEAD2SALES · SALES COMMAND CENTER</span>
       <h1>Every enquiry. One flow. One next action.</h1>
       <p>Capture leads from every channel, qualify them, quote faster and keep follow-ups visible.</p>
     </div>
     <div className="ccHeroActions">
       <button className="ccPrimary" onClick={()=>setShowNewLead(true)}>＋ New Lead</button>
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
       <div className="ccStageStrip">{STAGES.map(s=><button key={s.key} className={s.cls} onClick={()=>setStageFilter(stageFilter===s.key?"all":s.key)}><b>{leads.filter(l=>l.status===s.key).length}</b><span>{s.label}</span></button>)}</div>
       <div className="ccLeadList">
         {loading?<div className="ccEmpty">Loading leads…</div>:filtered.slice(0,12).map(l=><div className="ccLeadRow" key={l.id}>
           <div className="ccAvatar">{l.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div>
           <div className="ccLeadIdentity"><b>{l.name}</b><small>{l.company_name||"Individual customer"} · {sourceLabel(l.source)}</small></div>
           <div className="ccRequirement"><b>{l.lead_category||"Other"}</b><span>{l.requirement||"Requirement not captured yet"}</span></div>
           <span className={"ccStatus "+(l.status||"new")}>{(l.status||"new").replace("_"," ")}</span>
           <strong>{money(Number(l.estimated_value||0))}</strong>
           <div className="ccActions"><button onClick={()=>setSelectedLead(l)}>Open</button><button onClick={()=>l.phone&&window.open("https://wa.me/"+l.phone.replace(/\D/g,""),"_blank")}>WhatsApp</button></div>
         </div>)}{!loading&&!filtered.length&&<div className="ccEmpty">No matching leads.</div>}
       </div>
     </section>

     <aside className="ccPanel ccActionPanel">
       <div className="ccSectionHead compact"><div><span className="ccEyebrow">TODAY</span><h2>Next actions</h2></div></div>
       <div className="ccActionCard ccActionHot"><span>🔥</span><div><b>Hot leads</b><small>{leads.filter(l=>l.status==="hot").length} need attention</small></div><strong>→</strong></div>
       <button className="ccActionCard ccActionFollow" onClick={()=>setSelectedLead(followups[0]||null)}><span>⏰</span><div><b>Follow-ups due</b><small>{followups.length} need action</small></div><strong>→</strong></button>
       <button className="ccActionCard ccActionQuote" onClick={()=>router.push("/?quotationHistory=1")}><span>🧾</span><div><b>Quotation queue</b><small>{quotes.filter(q=>["draft","sent"].includes(q.status)).length} open quotes</small></div><strong>→</strong></button>
       <div className="ccActionCard ccActionInbox"><span>📥</span><div><b>Unprocessed inbound</b><small>Email / API / future channels</small></div><strong>→</strong></div>
       <div className="ccMiniFlow"><b>Recommended operating rule</b><span>Every new lead must end this cycle with an owner, stage, next action and follow-up date.</span></div>
     </aside>
   </div>

   <div className="ccSectionHead"><div><span className="ccEyebrow">BUSINESS CATEGORIES</span><h2>What customers are asking for</h2></div></div>
   <div className="ccCategoryGrid">{CATEGORIES.map(c=>{const count=leads.filter(l=>l.lead_category===c).length;return <button key={c} className="ccCategoryCard" onClick={()=>setCategoryFilter(c)}><span>{c}</span><b>{count}</b><small>{count===1?"lead":"leads"}</small></button>})}</div>

   {view==="sources"&&<div className="ccModalBackdrop" onClick={()=>setView("overview")}><div className="ccModal" onClick={e=>e.stopPropagation()}><div className="ccModalHead"><div><span className="ccEyebrow">SOURCE CENTER</span><h2>Connect every lead channel</h2><p>Turn each channel into a controlled Lead2Sales source.</p></div><button onClick={()=>setView("overview")}>×</button></div><div className="ccIntegrationGrid">{SOURCES.map(s=><div className="ccIntegration" key={s.key}><span className={"ccSourceIcon "+s.cls}>{s.icon}</span><div><b>{s.label}</b><small>{s.desc}</small></div><button className="ccGhost" onClick={()=>{if(s.key==="email"||s.key==="whatsapp"||s.key==="website")router.push("/?leadSources=1");else alert(s.label+" connector is planned in the source roadmap.")}}>{s.key==="email"||s.key==="whatsapp"||s.key==="website"?"Configure":"Plan connector"}</button></div>)}</div><div className="ccRoadmap"><b>Source roadmap</b><span>Phase 1: Email + Website + WhatsApp · Phase 2: Meta + Instagram · Phase 3: Google Ads + API/ERP + imports · Phase 4: Calls, AI chat and advanced routing.</span></div></div></div>}
   {showNewLead&&<div className="ccModalBackdrop" onClick={()=>setShowNewLead(false)}><div className="ccModal" onClick={e=>e.stopPropagation()}><div className="ccModalHead"><div><span className="ccEyebrow">CAPTURE · NEW LEAD</span><h2>Add enquiry</h2><p>This writes directly to the live lead pipeline.</p></div><button onClick={()=>setShowNewLead(false)}>×</button></div><div className="ccFormGrid"><input placeholder="Customer name *" value={newLead.name} onChange={e=>setNewLead({...newLead,name:e.target.value})}/><input placeholder="Company / site" value={newLead.company_name} onChange={e=>setNewLead({...newLead,company_name:e.target.value})}/><input placeholder="Phone" value={newLead.phone} onChange={e=>setNewLead({...newLead,phone:e.target.value})}/><input placeholder="Email" type="email" value={newLead.email} onChange={e=>setNewLead({...newLead,email:e.target.value})}/><select value={newLead.source} onChange={e=>setNewLead({...newLead,source:e.target.value})}>{SOURCES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select><select value={newLead.lead_category} onChange={e=>setNewLead({...newLead,lead_category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><select value={newLead.status} onChange={e=>setNewLead({...newLead,status:e.target.value})}>{STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select><input type="number" placeholder="Estimated value ₹" value={newLead.estimated_value} onChange={e=>setNewLead({...newLead,estimated_value:e.target.value})}/><input type="datetime-local" value={newLead.next_follow_up_at} onChange={e=>setNewLead({...newLead,next_follow_up_at:e.target.value})}/><textarea className="ccFullField" placeholder="Customer requirement *" value={newLead.requirement} onChange={e=>setNewLead({...newLead,requirement:e.target.value})}/></div><div className="ccModalActions"><button className="ccGhost" onClick={()=>setShowNewLead(false)}>Cancel</button><button className="ccPrimary" disabled={savingLead} onClick={createLead}>{savingLead?"Saving…":"Save Lead"}</button></div></div></div>}
   {selectedLead&&<div className="ccModalBackdrop" onClick={()=>setSelectedLead(null)}><div className="ccModal" onClick={e=>e.stopPropagation()}><div className="ccModalHead"><div><span className="ccEyebrow">LEAD WORKSPACE</span><h2>{selectedLead.name}</h2><p>{selectedLead.company_name||"Individual customer"} · {sourceLabel(selectedLead.source)}</p></div><button onClick={()=>setSelectedLead(null)}>×</button></div><div className="ccDetailGrid"><div><b>Requirement</b><p>{selectedLead.requirement||"Not captured"}</p></div><div><b>Contact</b><p>{selectedLead.phone||"—"}<br/>{selectedLead.email||"—"}</p></div><label>Stage<select value={selectedLead.status} onChange={e=>updateLead({status:e.target.value})}>{STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label><label>Category<select value={selectedLead.lead_category||"Other"} onChange={e=>updateLead({lead_category:e.target.value})}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label><label>Estimated value<input type="number" value={selectedLead.estimated_value||0} onChange={e=>updateLead({estimated_value:Number(e.target.value)})}/></label><label>Next follow-up<input type="datetime-local" value={selectedLead.next_follow_up_at?new Date(selectedLead.next_follow_up_at).toISOString().slice(0,16):""} onChange={e=>updateLead({next_follow_up_at:e.target.value?new Date(e.target.value).toISOString():null})}/></label></div><div className="ccModalActions"><button className="ccGhost" onClick={()=>selectedLead.phone&&window.open("https://wa.me/"+selectedLead.phone.replace(/\\D/g,""),"_blank")}>WhatsApp</button><button className="ccPrimary" onClick={()=>router.push("/?lead="+selectedLead.id)}>Open full workspace</button></div></div></div>}
   {error&&<div className="ccError">{error}</div>}
 </div>
}
