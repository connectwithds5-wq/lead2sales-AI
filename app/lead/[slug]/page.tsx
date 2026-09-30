"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function PublicLeadPage({params}:{params:Promise<{slug:string}>}){
  const [token,setToken]=useState("");
  const [source,setSource]=useState<any>(null);
  const [form,setForm]=useState({name:"",company:"",phone:"",email:"",requirement:""});
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [done,setDone]=useState(false); const [error,setError]=useState("");

  useEffect(()=>{params.then(p=>setToken(p.slug))},[params]);
  useEffect(()=>{if(!token)return;(async()=>{const {data,error}=await supabase.rpc("get_public_lead_source",{p_token:token});const row=Array.isArray(data)?data[0]:data;if(error||!row)setError("This enquiry link is not active.");else setSource(row);setLoading(false)})()},[token]);

  async function submit(e:React.FormEvent){e.preventDefault();setSaving(true);setError("");const {error}=await supabase.rpc("submit_public_lead",{p_token:token,p_name:form.name,p_company_name:form.company,p_phone:form.phone,p_email:form.email,p_requirement:form.requirement});if(error)setError(error.message);else setDone(true);setSaving(false);}
  if(loading)return <main className="publicLead"><div className="publicLeadCard"><p>Loading enquiry form…</p></div></main>;
  if(error&&!source)return <main className="publicLead"><div className="publicLeadCard"><h1>Lead2Sales</h1><p>{error}</p></div></main>;
  if(done)return <main className="publicLead"><div className="publicLeadCard success"><div className="publicLeadIcon">✓</div><h1>Thanks! Your enquiry is received.</h1><p>Our sales team will contact you shortly.</p>{source?.whatsapp_number&&<a className="publicWhatsApp" href={"https://wa.me/"+String(source.whatsapp_number).replace(/\D/g,"")+"?text="+encodeURIComponent(source.whatsapp_message||"Hi, I need a quotation.")} target="_blank" rel="noreferrer">Continue on WhatsApp</a>}</div></main>;
  return <main className="publicLead"><div className="publicLeadCard"><div className="publicLeadBrand"><span className="publicLeadMark">L2</span><div><strong>Lead2Sales</strong><small>QUOTATION REQUEST</small></div></div><h1>Tell us what you need</h1><p>Share your requirement and our team will prepare the right solution for you.</p><form onSubmit={submit}><label>Name *<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name"/></label><label>Company / Site<input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="Company or site name"/></label><label>WhatsApp / Phone *<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91 98xxxxxxx"/></label><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>Requirement *<textarea required value={form.requirement} onChange={e=>setForm({...form,requirement:e.target.value})} placeholder="Example: Need 16 CCTV cameras for a warehouse with 30 days recording." rows={5}/></label>{error&&<div className="message">{error}</div>}<button className="primary full" disabled={saving}>{saving?"Sending…":"Send Enquiry"}</button></form><small className="publicLeadPrivacy">Your enquiry will be shared with the sales team for quotation and follow-up.</small></div></main>;
}
