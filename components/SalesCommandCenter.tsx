"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { recommendRequirement } from "../lib/recommendations";
import { resolveCatalogProduct } from "../lib/catalogResolver";


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
 const router=useRouter(); const pathname=usePathname();
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
 const [boqLead,setBoqLead]=useState<Lead|null>(null);
 const [boqItems,setBoqItems]=useState<any[]>([]);
 const [boqLoading,setBoqLoading]=useState(false);
 const [boqSaving,setBoqSaving]=useState(false);
 const [sendClientOpen,setSendClientOpen]=useState(false);
 const [sendChannels,setSendChannels]=useState<("whatsapp"|"email")[]>(["whatsapp","email"]);
 const [sendProceed,setSendProceed]=useState(false);
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
 async function openBoq(lead:Lead){
   setSelectedLead(null); setBoqLead(lead); setBoqLoading(true); setBoqItems([]);
   const cid=localStorage.getItem("lead2sales_company_id");
   if(!cid){setError("Workspace not found.");setBoqLoading(false);return}
   const {data,error:loadError}=await supabase.from("lead_boq_items").select("*").eq("company_id",cid).eq("lead_id",lead.id).order("created_at",{ascending:true});
   if(loadError){setError(loadError.message);setBoqLoading(false);return}
   const requirement=lead.requirement||"";
   // Resolve an explicitly named product/model against the shared master catalogue before
   // falling back to generic engineering rules. Also repair an older saved manual-review row.
   const {data:masterProducts,error:catalogError}=await supabase
     .from("master_catalog_products")
     .select("id,category,subcategory,brand,model,name,specification,unit,attributes")
     .eq("active",true);
   if(catalogError){setError(catalogError.message);setBoqLoading(false);return}
   const catalogMatch=resolveCatalogProduct(requirement,masterProducts||[]);
   const hasOnlyManualReview=Boolean(data?.length) && data!.every((x:any)=>String(x.item_name||"").toLowerCase().startsWith("manual review:"));
   if(data?.length && !catalogMatch || (data?.length && catalogMatch && !hasOnlyManualReview)){
     setBoqItems(data.map((x:any)=>({...x,__persisted:true})));setBoqLoading(false);return
   }
   if(catalogMatch){
     const p=catalogMatch.product;
     // Master catalogue contains technical data, while commercial pricing belongs
     // to the company's activated product catalogue.
     const {data:companyProduct,error:companyProductError}=await supabase
       .from("product_catalog")
       .select("selling_price,cost_price,unit")
       .eq("company_id",cid)
       .eq("master_product_id",p.id)
       .eq("active",true)
       .maybeSingle();
     if(companyProductError){setError(companyProductError.message);setBoqLoading(false);return}
     const sellingPrice=Number(companyProduct?.selling_price||0);
     const priceNote=sellingPrice>0
       ? "Company catalogue price loaded: "+sellingPrice
       : "PRICE NOT CONFIGURED: Activate this product in Product Catalogue and enter Selling Price.";
     setBoqItems([{
       id:crypto.randomUUID(),
       company_id:cid,
       lead_id:lead.id,
       category:p.category||"Other",
       subcategory:p.subcategory||"",
       item_name:p.name,
       specification:p.specification||("Manufacturer: "+(p.brand||"")+" "+(p.model||"")).trim(),
       quantity:catalogMatch.quantity,
       unit:companyProduct?.unit||p.unit||"Nos",
       unit_price:sellingPrice,
       notes:"MASTER CATALOGUE MATCH: "+(p.brand||"")+" "+(p.model||p.name)+" · Exact product selected. "+priceNote,
       master_product_id:p.id,
       verification:"manufacturer_catalogue_match",
       __persisted:false
     }]);
     setBoqLoading(false);
     return;
   }

   const generated=recommendRequirement(requirement).map((x:any)=>{const {reason,review_required,...item}=x;return {id:crypto.randomUUID(),company_id:cid,lead_id:lead.id,...item,unit_price:0,notes:review_required?("MANUAL REVIEW REQUIRED: "+reason):reason,__persisted:false};});
   setBoqItems(generated); setBoqLoading(false);
 }
 async function sendToClient(){
   if(!boqLead)return;
   const missingWhatsapp=sendChannels.includes("whatsapp")&&!String(boqLead.phone||"").trim();
   const missingEmail=sendChannels.includes("email")&&!String(boqLead.email||"").trim();
   if((missingWhatsapp||missingEmail)&&!sendProceed)return;
   const cid=localStorage.getItem("lead2sales_company_id");
   if(!cid){setError("Workspace not found.");return}
   const available=sendChannels.filter(ch=>ch==="whatsapp"?!!String(boqLead.phone||"").trim():!!String(boqLead.email||"").trim());
   if(!available.length){setError("No available customer contact channel to send.");return}
   try{
     const subtotal=boqItems.reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unit_price||0),0);
     const gst=18, tax=subtotal*gst/100, total=subtotal+tax;
     const quoteNo="L2S-"+new Date().getFullYear()+"-"+String(Date.now()).slice(-6);
     const {data:existing}=await supabase.from("quotations").select("id,quotation_no").eq("company_id",cid).eq("lead_id",boqLead.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
     let quoteId=existing?.id||crypto.randomUUID();
     if(existing?.id){
       const {error}=await supabase.from("quotations").update({subtotal,gst_percent:gst,gst_amount:tax,grand_total:total,status:"draft"}).eq("id",quoteId).eq("company_id",cid);
       if(error)throw error;
       await supabase.from("quotation_items").delete().eq("quotation_id",quoteId);
     }else{
       const {error}=await supabase.from("quotations").insert({id:quoteId,company_id:cid,lead_id:boqLead.id,quotation_no:quoteNo,subtotal,gst_percent:gst,gst_amount:tax,grand_total:total,status:"draft"});
       if(error)throw error;
     }
     const itemRows=boqItems.filter(x=>String(x.item_name||"").trim()).map(x=>({quotation_id:quoteId,item_name:x.item_name,specification:x.specification||"",quantity:Number(x.quantity)||0,unit:x.unit||"Nos",unit_price:Number(x.unit_price)||0}));
     if(itemRows.length){const {error}=await supabase.from("quotation_items").insert(itemRows);if(error)throw error}
     const quoteNumber=existing?.quotation_no||quoteNo;
     const printSource=document.querySelector(".ccBoqPrintPaper") as HTMLElement | null;
     if(!printSource) throw new Error("BOQ print preview is not available.");
     const printable=printSource.cloneNode(true) as HTMLElement;
     printable.classList.add("ccBoqPdfCapture");
     document.body.appendChild(printable);
     await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
     const { default: html2pdf } = await import("html2pdf.js");
     const pdfDataUri=await html2pdf().set({
       margin:0,
       filename:"Quotation-"+quoteNumber+".pdf",
       image:{type:"jpeg",quality:0.96},
       html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:printable.scrollWidth,windowHeight:printable.scrollHeight,logging:false},
       jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
     }).from(printable).outputPdf("datauristring");
     printable.remove();
     const filename="Quotation-"+quoteNumber+".pdf";
     let shareUrl="";
     if(available.includes("whatsapp")){
       const shareRes=await fetch("/api/quotation-share",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+(await supabase.auth.getSession()).data.session?.access_token},body:JSON.stringify({quoteId,pdfBase64,filename})});
       const shareData=await shareRes.json().catch(()=>({}));
       if(!shareRes.ok)throw new Error(shareData.error||"Could not create WhatsApp quotation link.");
       shareUrl=shareData.shortUrl||shareData.url||"";
       const msg="Dear "+boqLead.name+",\\n\\nPlease find your quotation "+quoteNumber+" from "+business+".\\n\\nQuotation value: "+money(total)+".\\n\\nPDF: "+shareUrl;
       window.open("https://wa.me/"+String(boqLead.phone).replace(/\\D/g,"")+"?text="+encodeURIComponent(msg),"_blank");
     }
     if(available.includes("email")){
       const token=(await supabase.auth.getSession()).data.session?.access_token;
       const emailRes=await fetch("/api/send-quotation-email",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({quoteId,pdfBase64,filename})});
       const emailData=await emailRes.json().catch(()=>({}));
       if(!emailRes.ok)throw new Error(emailData.error||"Could not send quotation email.");
     }
     setSendClientOpen(false);setSendProceed(false);alert("Quotation "+quoteNumber+" prepared and sent via "+available.map(x=>x==="whatsapp"?"WhatsApp":"Email").join(" + ")+".");
   }catch(e:any){console.error("Send quotation failed:",e);setError(e?.message||"Could not prepare/send quotation.");}
 }

 async function saveBoq(){
   if(!boqLead)return; const cid=localStorage.getItem("lead2sales_company_id"); if(!cid)return;
   setBoqSaving(true);
   const {data:existing,error:existingError}=await supabase.from("lead_boq_items").select("id").eq("company_id",cid).eq("lead_id",boqLead.id);
   if(existingError){setError(existingError.message);setBoqSaving(false);return}
   const currentIds=boqItems.filter(x=>x.__persisted).map(x=>x.id);
   const removed=(existing||[]).map((x:any)=>x.id).filter((id:string)=>!currentIds.includes(id));
   if(removed.length){const {error}=await supabase.from("lead_boq_items").delete().in("id",removed).eq("company_id",cid).eq("lead_id",boqLead.id);if(error){setError(error.message);setBoqSaving(false);return}}
   for(const x of boqItems.filter(x=>x.__persisted)){const {error}=await supabase.from("lead_boq_items").update({item_name:x.item_name,specification:x.specification||"",quantity:Number(x.quantity)||0,unit:x.unit||"Nos",unit_price:Number(x.unit_price)||0,notes:x.notes||null}).eq("id",x.id).eq("company_id",cid).eq("lead_id",boqLead.id);if(error){setError(error.message);setBoqSaving(false);return}}
   const fresh=boqItems.filter(x=>!x.__persisted&&String(x.item_name||"").trim()).map(x=>({id:x.id||crypto.randomUUID(),company_id:cid,lead_id:boqLead.id,category:x.category||"Other",item_name:x.item_name,specification:x.specification||"",quantity:Number(x.quantity)||0,unit:x.unit||"Nos",unit_price:Number(x.unit_price)||0,notes:x.notes||null}));
   if(fresh.length){const {error}=await supabase.from("lead_boq_items").insert(fresh);if(error){setError(error.message);setBoqSaving(false);return}}
   const {data:latest}=await supabase.from("lead_boq_items").select("*").eq("company_id",cid).eq("lead_id",boqLead.id).order("created_at",{ascending:true});
   setBoqItems((latest||[]).map((x:any)=>({...x,__persisted:true}))); setBoqSaving(false);
 }
 async function updateLead(patch:Partial<Lead>){
   if(!selectedLead)return;
   const {data,error:updateError}=await supabase.from("leads").update(patch).eq("id",selectedLead.id).eq("company_id",localStorage.getItem("lead2sales_company_id")||"").select("id,name,company_name,phone,email,requirement,status,estimated_value,created_at,lead_category,next_follow_up_at,source").single();
   if(updateError){setError(updateError.message);return}
   setLeads(leads.map(l=>l.id===selectedLead.id?data as Lead:l));setSelectedLead(data as Lead);
 }

 return <div className="ccAppShell">
   <aside className="ccSidebar">
     <div className="ccBrand"><div className="ccBrandMark">L2S</div><div><b>Lead2Sales</b><small>AI Sales Platform</small></div></div>
     <nav className="ccNav">
       <button className={pathname==="/command-center"?"active":""} onClick={()=>router.push("/command-center")}><span>⌂</span>Command Center</button>
       <button onClick={()=>router.push("/command-center")}><span>◉</span>Leads</button>
       <button onClick={()=>router.push("/company-profile")}><span>🏢</span>Company Profile</button>
       <button onClick={()=>router.push("/products-catalogue")}><span>▦</span>Product Catalogue</button>
       <button onClick={()=>router.push("/command-center")}><span>🧾</span>Quotations</button>
       <button onClick={()=>router.push("/command-center")}><span>📋</span>BOQ / Presales</button>
       <button onClick={()=>router.push("/command-center")}><span>⏰</span>Follow-ups</button>
       <button onClick={()=>router.push("/command-center")}><span>⚡</span>Lead Sources</button>
     </nav>
     <div className="ccSidebarBottom">
       <button onClick={()=>router.push("/company-profile")}><span>⚙</span>Settings</button>
       <div className="ccWorkspaceBadge"><small>WORKSPACE</small><b>{business}</b></div>
     </div>
   </aside>
   <main className="ccMainContent"><div className="ccWrap">
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
   {selectedLead&&<div className="ccModalBackdrop" onClick={()=>setSelectedLead(null)}><div className="ccModal" onClick={e=>e.stopPropagation()}><div className="ccModalHead"><div><span className="ccEyebrow">LEAD WORKSPACE</span><h2>{selectedLead.name}</h2><p>{selectedLead.company_name||"Individual customer"} · {sourceLabel(selectedLead.source)}</p></div><button onClick={()=>setSelectedLead(null)}>×</button></div><div className="ccDetailGrid"><div><b>Requirement</b><p>{selectedLead.requirement||"Not captured"}</p></div><div><b>Contact</b><p>{selectedLead.phone||"—"}<br/>{selectedLead.email||"—"}</p></div><label>Stage<select value={selectedLead.status} onChange={e=>updateLead({status:e.target.value})}>{STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label><label>Category<select value={selectedLead.lead_category||"Other"} onChange={e=>updateLead({lead_category:e.target.value})}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label><label>Estimated value<input type="number" value={selectedLead.estimated_value||0} onChange={e=>updateLead({estimated_value:Number(e.target.value)})}/></label><label>Next follow-up<input type="datetime-local" value={selectedLead.next_follow_up_at?new Date(selectedLead.next_follow_up_at).toISOString().slice(0,16):""} onChange={e=>updateLead({next_follow_up_at:e.target.value?new Date(e.target.value).toISOString():null})}/></label></div><div className="ccModalActions"><button className="ccGhost" onClick={()=>selectedLead.phone&&window.open("https://wa.me/"+selectedLead.phone.replace(/\\D/g,""),"_blank")}>WhatsApp</button><button className="ccGhost" onClick={()=>openBoq(selectedLead)}>📋 BOQ</button><button className="ccPrimary" onClick={()=>openBoq(selectedLead)}>Open BOQ Workspace</button></div></div></div>}
   {boqLead&&<div className="ccModalBackdrop" onClick={()=>!boqSaving&&setBoqLead(null)}><div className="ccModal ccBoqModal" onClick={e=>e.stopPropagation()}><div className="ccModalHead"><div><span className="ccEyebrow">QUOTE · BOQ WORKSPACE</span><h2>{boqLead.name}</h2><p>{boqLead.company_name||"Individual customer"} · {boqLead.lead_category||"Other"}</p></div><button onClick={()=>!boqSaving&&setBoqLead(null)}>×</button></div><div className="ccBoqSummary"><div><span>Requirement</span><b>{boqLead.requirement||"—"}</b></div><div><span>Estimated Value</span><b>{money(Number(boqLead.estimated_value||0))}</b></div><div><span>Items</span><b>{boqItems.length}</b></div></div>{boqLoading?<div className="ccEmpty">Building BOQ…</div>:<><div className="ccBoqHead"><div><b>Bill of Quantities</b><small>Edit quantity, specification and rate before quotation.</small></div><button className="ccGhost" onClick={()=>setBoqItems([...boqItems,{id:crypto.randomUUID(),__persisted:false,category:"Other",item_name:"",specification:"",quantity:1,unit:"Nos",unit_price:0,notes:""}])}>＋ Add Item</button></div><div className="ccBoqTable"><div className="ccBoqRow ccBoqHeader"><span>Item</span><span>Specification</span><span>Qty</span><span>Unit</span><span>Rate</span><span></span></div>{boqItems.map((x,i)=><div className="ccBoqRow" key={x.id||i}><input value={x.item_name||""} placeholder="Item name" onChange={e=>setBoqItems(boqItems.map((r,j)=>j===i?{...r,item_name:e.target.value,notes:""}:r))}/><input value={x.specification||""} placeholder="Specification" onChange={e=>setBoqItems(boqItems.map((r,j)=>j===i?{...r,specification:e.target.value,notes:""}:r))}/><input type="number" min="0" value={x.quantity??0} onChange={e=>setBoqItems(boqItems.map((r,j)=>j===i?{...r,quantity:Number(e.target.value)}:r))}/><input value={x.unit||"Nos"} onChange={e=>setBoqItems(boqItems.map((r,j)=>j===i?{...r,unit:e.target.value}:r))}/><input type="number" min="0" value={x.unit_price??0} onChange={e=>setBoqItems(boqItems.map((r,j)=>j===i?{...r,unit_price:Number(e.target.value)}:r))}/><button className="ccRowDelete" onClick={()=>setBoqItems(boqItems.filter((_,j)=>j!==i))}>Remove</button></div>)}{!boqItems.length&&<div className="ccEmpty">No BOQ items yet. Add an item to start.</div>}</div><div className="ccBoqTotals"><span>Subtotal <b>{money(boqItems.reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unit_price||0),0))}</b></span></div></>}<div className="ccBoqPrintPaper">
  <div className="ccPrintFirstHeader">
    <div className="ccPrintBrand">
      <div><b>{business}</b><small>AI SALES PLATFORM · BOQ / PRE-SALES</small></div>
      <div className="ccPrintMeta"><b>BOQ / PRE-SALES</b><span>Date: {new Date().toLocaleDateString("en-IN")}</span><span>Customer: {boqLead?.name||"Customer"}</span></div>
    </div>
    <hr/>
    <div className="ccPrintBillTo">
      <div><small>PREPARED FOR</small><b>{boqLead?.name||"Customer"}</b><span>{boqLead?.company_name||"Customer site"}</span><span>{boqLead?.phone||""}</span></div>
      <div><small>REQUIREMENT</small><span>{boqLead?.requirement||"BOQ / Presales Requirement"}</span></div>
    </div>
  </div>

  <table className="ccPrintTable">
    <thead>
      <tr className="ccPrintRepeatHeader"><th colSpan={5}>
        <div className="ccPrintCompactHeader">
          <b>{business}</b><span>BOQ / PRE-SALES</span><span>{boqLead?.name||"Customer"}</span>
        </div>
      </th></tr>
      <tr className="ccPrintColumnHeader"><th>#</th><th>Item & Specification</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
    </thead>
    <tbody>{boqItems.filter(x=>String(x.item_name||"").trim()).map((x,i)=><tr key={x.id||i}>
      <td>{i+1}</td><td><b>{x.item_name}</b><small>{x.specification||""}</small></td>
      <td>{x.quantity} {x.unit||"Nos"}</td><td>{money(Number(x.unit_price||0))}</td><td>{money(Number(x.quantity||0)*Number(x.unit_price||0))}</td>
    </tr>)}</tbody>
  </table>

  <div className="ccPrintBottom">
    <div><b>Terms & Conditions</b><p>Prices are based on the current BOQ. Final installation scope will be confirmed after site verification. Warranty and payment terms are subject to the final commercial agreement.</p></div>
    <div className="ccPrintTotals"><span>Subtotal <b>{money(boqItems.reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unit_price||0),0))}</b></span><span>GST (18%) <b>{money(boqItems.reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unit_price||0),0)*.18)}</b></span><strong>Grand Total <b>{money(boqItems.reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unit_price||0),0)*1.18)}</b></strong></div>
  </div>
  <div className="ccPrintSignature">For {business}<br/><b>Authorized Signatory</b></div>
</div><div className="ccModalActions"><button className="ccGhost" onClick={()=>!boqSaving&&setBoqLead(null)}>Close</button><button className="ccGhost" disabled={boqSaving||boqLoading||!boqItems.length} onClick={()=>window.print()}>🖨️ Print Preview</button><button className="ccGhost" disabled={boqSaving||boqLoading||!boqItems.length} onClick={()=>{setSendChannels(["whatsapp","email"]);setSendProceed(false);setSendClientOpen(true)}}>📤 Send to Client</button><button className="ccPrimary" disabled={boqSaving||boqLoading} onClick={saveBoq}>{boqSaving?"Saving…":"Save BOQ Changes"}</button></div></div></div>}{sendClientOpen&&boqLead&&<div className="ccModalBackdrop" onClick={()=>setSendClientOpen(false)}><div className="ccModal ccSendModal" onClick={e=>e.stopPropagation()}><div className="ccModalHead"><div><span className="ccEyebrow">SEND TO CLIENT</span><h2>Choose delivery channel</h2><p>{boqLead.name} · {boqLead.company_name||"Individual customer"}</p></div><button onClick={()=>setSendClientOpen(false)}>×</button></div><div className="ccSendOptions"><label className={sendChannels.includes("whatsapp")?"ccSendOption selected":"ccSendOption"}><input type="checkbox" checked={sendChannels.includes("whatsapp")} onChange={e=>setSendChannels(e.target.checked?[...sendChannels,"whatsapp"]:sendChannels.filter(x=>x!=="whatsapp"))}/><span>🟢</span><div><b>WhatsApp</b><small>{boqLead.phone?boqLead.phone:"Number not found"}</small></div></label><label className={sendChannels.includes("email")?"ccSendOption selected":"ccSendOption"}><input type="checkbox" checked={sendChannels.includes("email")} onChange={e=>setSendChannels(e.target.checked?[...sendChannels,"email"]:sendChannels.filter(x=>x!=="email"))}/><span>✉️</span><div><b>Email</b><small>{boqLead.email?boqLead.email:"Email not found"}</small></div></label></div>{((sendChannels.includes("whatsapp")&&!boqLead.phone)||(sendChannels.includes("email")&&!boqLead.email))&&<div className="ccSendWarning"><b>Contact details missing</b><span>{sendChannels.includes("whatsapp")&&!boqLead.phone?"WhatsApp number not found. ":""}{sendChannels.includes("email")&&!boqLead.email?"Email not found. ":""}Do you want to continue with the available channel?</span><label><input type="checkbox" checked={sendProceed} onChange={e=>setSendProceed(e.target.checked)}/> Yes, send without the missing channel</label></div>}<div className="ccModalActions"><button className="ccGhost" onClick={()=>setSendClientOpen(false)}>Cancel</button><button className="ccPrimary" disabled={!sendChannels.length||((sendChannels.includes("whatsapp")&&!boqLead.phone)||(sendChannels.includes("email")&&!boqLead.email))&&!sendProceed} onClick={sendToClient}>Send</button></div></div></div>}
   {error&&<div className="ccError">{error}</div>}
 </div></main></div>
}
