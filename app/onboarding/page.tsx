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
  const {data:company,error}=await supabase.from("companies").insert({name:business}).select("id").single();
  if(error){setMsg(error.message);setLoading(false);return;}
  const {error:memberError}=await supabase.from("company_members").insert({company_id:company.id,user_id:user.id,role:"owner"});
  if(memberError){setMsg(memberError.message);setLoading(false);return;}
  localStorage.setItem("lead2sales_company_id",company.id); router.replace("/");
 }
 return <main className="authShell"><div className="authCard"><span className="eyebrow">ONE-TIME SETUP</span><h1>Set up your business</h1><p className="authSub">This workspace keeps your leads and sales data separate from every other dealer.</p><form onSubmit={create}><label>Business name<input value={business} onChange={e=>setBusiness(e.target.value)} placeholder="e.g. SecureTech Solutions" required /></label>{msg&&<div className="message">{msg}</div>}<button className="primary full" disabled={loading}>{loading?"Creating workspace…":"Create workspace"}</button></form></div></main>;
}