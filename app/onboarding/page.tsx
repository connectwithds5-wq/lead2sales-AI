"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Onboarding(){
 const router=useRouter(); const [business,setBusiness]=useState(""); const [loading,setLoading]=useState(false); const [msg,setMsg]=useState("");
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{if(!data.session) router.replace("/login");});},[router]);
 async function create(e:React.FormEvent){
  e.preventDefault(); setLoading(true); setMsg("");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){router.replace("/login");return;}
  const {data:existing,error:existingError}=await supabase.from("company_members").select("company_id,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1);
  if(existingError){setMsg(existingError.message);setLoading(false);return;}
  if(existing?.[0]?.company_id){localStorage.setItem("lead2sales_company_id",existing[0].company_id);router.replace("/");return;}
  const companyId=crypto.randomUUID();
  const {error:companyError}=await supabase.from("companies").insert({id:companyId,name:business});
  if(companyError){setMsg(companyError.message);setLoading(false);return;}
  const {error:memberError}=await supabase.from("company_members").insert({company_id:companyId,user_id:user.id,role:"owner"});
  if(memberError){setMsg(memberError.message);setLoading(false);return;}
  localStorage.setItem("lead2sales_company_id",companyId); router.replace("/");
 }
 return <main className="authShell"><div className="authCard"><span className="eyebrow">ONE-TIME SETUP</span><h1>Set up your business</h1><p className="authSub">This workspace keeps your leads and sales data separate from every other dealer.</p><form onSubmit={create}><label>Business name<input value={business} onChange={e=>setBusiness(e.target.value)} placeholder="e.g. SecureTech Solutions" required /></label>{msg&&<div className="message">{msg}</div>}<button className="primary full" disabled={loading}>{loading?"Creating workspace…":"Create workspace"}</button></form></div></main>;
}