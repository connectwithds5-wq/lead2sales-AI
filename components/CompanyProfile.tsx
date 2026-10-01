"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type CompanyForm={name:string;legal_name:string;address:string;phone:string;email:string;gst_number:string;logo_url:string};
const emptyForm:CompanyForm={name:"",legal_name:"",address:"",phone:"",email:"",gst_number:"",logo_url:""};

function ProfileField({label,field,value,type="text",placeholder,onChange}:{label:string;field:keyof CompanyForm;value:string;type?:string;placeholder?:string;onChange:(field:keyof CompanyForm,value:string)=>void}){
 return <label>{label}<input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(field,e.target.value)}/></label>;
}

export default function CompanyProfile(){
 const router=useRouter();
 const [form,setForm]=useState<CompanyForm>(emptyForm);
 const [saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[msg,setMsg]=useState(""),[error,setError]=useState("");
 useEffect(()=>{(async()=>{const cid=localStorage.getItem("lead2sales_company_id");if(!cid){router.replace("/onboarding");return;}const {data,error}=await supabase.from("companies").select("id,name,legal_name,address,phone,email,gst_number,logo_url").eq("id",cid).single();if(error){setError(error.message);setLoading(false);return;}setForm({name:data?.name||"",legal_name:data?.legal_name||"",address:data?.address||"",phone:data?.phone||"",email:data?.email||"",gst_number:data?.gst_number||"",logo_url:data?.logo_url||""});setLoading(false);})()},[router]);
 const set=(field:keyof CompanyForm,value:string)=>setForm(prev=>({...prev,[field]:value}));
 async function save(){const cid=localStorage.getItem("lead2sales_company_id");if(!cid)return;if(!form.name.trim()){setError("Company name is required.");return;}setSaving(true);setError("");setMsg("");const {error}=await supabase.from("companies").update({name:form.name.trim(),legal_name:form.legal_name.trim()||null,address:form.address.trim()||null,phone:form.phone.trim()||null,email:form.email.trim().toLowerCase()||null,gst_number:form.gst_number.trim().toUpperCase()||null,logo_url:form.logo_url.trim()||null}).eq("id",cid);if(error)setError(error.message);else setMsg("Company profile saved successfully.");setSaving(false);}
 if(loading)return <div className="appPageShell"><main className="appPageMain"><div className="profileCard">Loading company profile…</div></main></div>;
 return <div className="appPageShell"><aside className="appPageSide"><div className="ccBrand"><div className="ccBrandMark">L2S</div><div><b>Lead2Sales</b><small>AI Sales Platform</small></div></div><nav className="ccNav">
   <button onClick={()=>router.push("/command-center")}>⌂ Command Center</button><button className="active">🏢 Company Profile</button><button onClick={()=>router.push("/products-catalogue")}>▦ Product Catalogue</button><button onClick={()=>router.push("/command-center")}>◉ Leads</button><button onClick={()=>router.push("/command-center")}>🧾 Quotations</button><button onClick={()=>router.push("/command-center")}>📋 BOQ / Presales</button><button onClick={()=>router.push("/command-center")}>⏰ Follow-ups</button><button onClick={()=>router.push("/command-center")}>⚡ Lead Sources</button>
 </nav></aside><main className="appPageMain"><div className="appPageHeader"><div><span className="ccEyebrow">WORKSPACE · COMPANY</span><h1>Company Profile</h1><p>Complete company master data used across leads, quotations, BOQ documents and client communication.</p></div><button className="ccGhost" onClick={()=>router.push("/command-center")}>← Command Center</button></div>
 <section className="profileCard"><div className="profileTitle"><div><h2>Company Identity</h2><p>These details appear in quotations and client-facing documents.</p></div></div><div className="profileGrid"><ProfileField label="Company / Brand Name" field="name" value={form.name} placeholder="Synergy DataNetworks" onChange={set}/><ProfileField label="Legal / Registered Name" field="legal_name" value={form.legal_name} placeholder="Legal entity name" onChange={set}/></div></section>
 <section className="profileCard"><div className="profileTitle"><div><h2>Contact & Address</h2><p>Keep client communication and document contact details complete.</p></div></div><div className="profileGrid"><ProfileField label="Company Email" field="email" value={form.email} type="email" placeholder="sales@company.com" onChange={set}/><ProfileField label="Company Phone" field="phone" value={form.phone} type="tel" placeholder="+91 98765 43210" onChange={set}/><label>Registered / Office Address<textarea className="ccFullField" rows={4} value={form.address} placeholder="Complete office address" onChange={e=>set("address",e.target.value)}/></label></div></section>
 <section className="profileCard"><div className="profileTitle"><div><h2>Tax & Branding</h2><p>Used for quotations, invoices and company branding.</p></div></div><div className="profileGrid"><ProfileField label="GST Number" field="gst_number" value={form.gst_number} placeholder="GSTIN" onChange={set}/><ProfileField label="Company Logo URL" field="logo_url" value={form.logo_url} placeholder="https://..." onChange={set}/></div>{form.logo_url&&<div style={{marginTop:16}}><small>Logo preview</small><div style={{marginTop:8}}><img src={form.logo_url} alt="Company logo" style={{maxWidth:180,maxHeight:70,objectFit:"contain"}}/></div></div>}</section>
 <section className="profileCard"><div className="profileActions"><button className="ccPrimary" disabled={saving} onClick={save}>{saving?"Saving…":"Save Complete Company Profile"}</button></div>{error&&<div className="ccError">{error}</div>}{msg&&<div className="ccSuccess">{msg}</div>}</section>
 </main></div>;
}