"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const empty={name:"",legal_name:"",address:"",phone:"",email:"",gst_number:"",logo_url:""};

type ProfileFieldProps={label:string;value:string;placeholder?:string;onChange:(value:string)=>void};
function ProfileField({label,value,placeholder,onChange}:ProfileFieldProps){
 return <label className="profileField">{label}<input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;
}

export default function CompanyProfile(){
 const router=useRouter();
 const [form,setForm]=useState(empty);
 const [saving,setSaving]=useState(false);
 const [loading,setLoading]=useState(true);
 const [msg,setMsg]=useState("");
 const [gmail,setGmail]=useState<{connected:boolean;email:string|null}>({connected:false,email:null});
 const [gmailLoading,setGmailLoading]=useState(false);

 async function loadGmailStatus(cid:string,accessToken:string){
   const sr=await fetch("/api/gmail/status?company_id="+encodeURIComponent(cid),{headers:{Authorization:"Bearer "+accessToken},cache:"no-store"});
   if(sr.ok){const sd=await sr.json();setGmail({connected:!!sd.connected,email:sd.email||null});return sd;}
   return null;
 }

 useEffect(()=>{(async()=>{
   const cid=localStorage.getItem("lead2sales_company_id");
   if(!cid){router.replace("/onboarding");return;}
   const params=new URLSearchParams(window.location.search);
   const emailState=params.get("email");
   if(emailState==="google_connected") setMsg("Gmail connected successfully. You can now send quotations from Gmail.");
   else if(emailState==="google_error") setMsg("Gmail connection could not be completed. Please try Connect Gmail again.");
   else if(emailState==="google_cancelled") setMsg("Gmail connection was cancelled.");
   const {data,error}=await supabase.from("companies").select("id,name,legal_name,address,phone,email,gst_number,logo_url").eq("id",cid).single();
   if(error)setMsg(error.message); else if(data)setForm({...empty,...data});
   const {data:{session}}=await supabase.auth.getSession();
   if(session?.access_token) await loadGmailStatus(cid,session.access_token);
   setLoading(false);
 })()},[router]);

 function set(k:keyof typeof empty,v:string){setForm(x=>({...x,[k]:v}))}

 async function connectGmail(){
   const cid=localStorage.getItem("lead2sales_company_id");
   const {data:{session}}=await supabase.auth.getSession();
   if(!cid||!session?.access_token)return;
   setGmailLoading(true);setMsg("");
   const r=await fetch("/api/gmail/connect?company_id="+encodeURIComponent(cid),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const d=await r.json().catch(()=>({}));
   if(!r.ok||!d.url){setMsg(d.error||"Could not start Gmail connection.");setGmailLoading(false);return;}
   window.location.href=d.url;
 }

 async function disconnectGmail(){
   const cid=localStorage.getItem("lead2sales_company_id");
   const {data:{session}}=await supabase.auth.getSession();
   if(!cid||!session?.access_token)return;
   setGmailLoading(true);setMsg("");
   const r=await fetch("/api/gmail/disconnect",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({company_id:cid})});
   if(r.ok)setGmail({connected:false,email:null}); else {const d=await r.json().catch(()=>({}));setMsg(d.error||"Could not disconnect Gmail.");}
   setGmailLoading(false);
 }

 async function save(){
   const cid=localStorage.getItem("lead2sales_company_id");if(!cid)return;
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token){setMsg("Your session has expired. Please sign in again.");return;}
   setSaving(true);setMsg("");
   const payload={company_id:cid,name:form.name.trim(),legal_name:form.legal_name.trim()||null,address:form.address.trim()||null,phone:form.phone.trim()||null,email:form.email.trim().toLowerCase()||null,gst_number:form.gst_number.trim().toUpperCase()||null,logo_url:form.logo_url.trim()||null};
   try{
     const controller=new AbortController();
     const timer=setTimeout(()=>controller.abort(),10000);
     const r=await fetch("/api/company-profile",{method:"PUT",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:controller.signal,cache:"no-store"});
     clearTimeout(timer);
     const d=await r.json().catch(()=>({}));
     if(!r.ok) throw new Error(d.error||"Could not save company profile.");
     if(d.company)setForm({...empty,...d.company});
     setMsg("Company profile saved successfully.");
   }catch(e){setMsg(e instanceof Error?(e.name==="AbortError"?"Saving timed out. Please try again.":e.message):"Could not save company profile.");}
   finally{setSaving(false);}
 }

 return <div className="appPageShell"><aside className="appPageSide"><div className="ccBrand"><div className="ccBrandMark">L2S</div><div><b>Lead2Sales</b><small>AI Sales Platform</small></div></div><nav className="ccNav"><button onClick={()=>router.push("/command-center")}>⌂ Command Center</button><button onClick={()=>router.push("/command-center")}>◉ Leads</button><button className="active">🏢 Company Profile</button><button onClick={()=>router.push("/products-catalogue")}>▦ Product Catalogue</button><button onClick={()=>router.push("/command-center")}>🧾 Quotations</button><button onClick={()=>router.push("/command-center")}>📋 BOQ / Presales</button><button onClick={()=>router.push("/command-center")}>⏰ Follow-ups</button><button onClick={()=>router.push("/command-center")}>⚡ Lead Sources</button></nav></aside><main className="appPageMain"><div className="appPageHeader"><div><span className="ccEyebrow">WORKSPACE · COMPANY MASTER</span><h1>Company Profile</h1><p>One source of truth for quotations, BOQs, emails, documents and client communication.</p></div><button className="ccGhost" onClick={()=>router.push("/command-center")}>← Command Center</button></div>{loading?<section className="profileCard">Loading company profile…</section>:<><section className="profileCard"><div className="profileTitle"><div><h2>Company Information</h2><p>Basic identity and official communication details.</p></div></div><div className="profileGrid"><ProfileField label="Display / Trading Name" value={form.name} placeholder="Your company name" onChange={v=>set("name",v)}/><ProfileField label="Legal Company Name" value={form.legal_name} placeholder="Registered legal name" onChange={v=>set("legal_name",v)}/><ProfileField label="Official Email" value={form.email} placeholder="sales@company.com" onChange={v=>set("email",v)}/><ProfileField label="Primary Phone" value={form.phone} placeholder="+91 …" onChange={v=>set("phone",v)}/><label className="profileField profileWide">Registered Office / Address<textarea value={form.address} placeholder="Complete company address" onChange={e=>set("address",e.target.value)}/></label><ProfileField label="GSTIN" value={form.gst_number} placeholder="GST registration number" onChange={v=>set("gst_number",v)}/></div></section><section className="profileCard"><div className="profileTitle"><div><h2>Branding</h2><p>Used later on quotation, proposal and other generated documents.</p></div></div><div className="profileGrid"><label className="profileField profileWide">Company Logo URL<input value={form.logo_url} placeholder="https://…" onChange={e=>set("logo_url",e.target.value)}/></label></div>{form.logo_url&&<img className="companyLogoPreview" src={form.logo_url} alt="Company logo preview" />}</section><section className="profileCard"><div className="profileTitle"><div><h2>Gmail Sending</h2><p>Connect the company Gmail account to send quotations directly through Gmail. The connection uses Google's <code>gmail.send</code> permission for sending mail.</p></div></div><div className="profileActions">{gmail.connected?<><div className="ccSuccess">Connected: {gmail.email}</div><button className="ccGhost" disabled={gmailLoading} onClick={disconnectGmail}>{gmailLoading?"Disconnecting…":"Disconnect Gmail"}</button></>:<button className="ccPrimary" disabled={gmailLoading} onClick={connectGmail}>{gmailLoading?"Opening Google…":"Connect Gmail"}</button>}</div></section><div className="profileActions"><button className="ccPrimary" disabled={saving} onClick={save}>{saving?"Saving…":"Save Company Profile"}</button></div>{msg&&<div className={msg.includes("successfully")?"ccSuccess":"ccError"}>{msg}</div>}</>}</main></div>;
}