"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
 async function restoreWorkspace(userId:string){const {data,error}=await supabase.from("company_members").select("company_id,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(1);if(error) throw error;const companyId=data?.[0]?.company_id;if(companyId){localStorage.setItem("lead2sales_company_id",companyId);return true;}return false;}


  const router=useRouter();
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [name,setName]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{supabase.auth.getSession().then(async({data})=>{if(data.session){try{const restored=await restoreWorkspace(data.session.user.id);router.replace(restored?"/":"/onboarding");}catch{router.replace("/onboarding");}}});},[router]);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setLoading(true); setMessage("");
    if(mode==="signup"){
      if(password!==confirmPassword){ setMessage("Passwords do not match."); setLoading(false); return; }
      const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:(process.env.NEXT_PUBLIC_SITE_URL||"https://lead2sales-ai-retro-team1.vercel.app").replace(/\/$/,"")+"/"}});
      if(error) setMessage(error.message);
      else if(data.user){ if(data.session){ router.replace("/onboarding"); } else { setMessage("Account created. Check your email to confirm your account, then sign in."); } }
    } else {
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error) setMessage(error.message); else { try { const restored=await restoreWorkspace(data.user.id); router.replace(restored?"/":"/onboarding"); } catch(e:any){ setMessage(e?.message||"Could not load your workspace."); } }
    }
    setLoading(false);
  }

  return <main className="authShell"><div className="authCard">
    <div className="brand"><div className="brandMark">L2</div><div><strong>Lead2Sales</strong><span>AI SALES ENGINE</span></div></div>
    <span className="eyebrow">{mode==="login"?"WELCOME BACK":"START FREE"}</span>
    <h1>{mode==="login"?"Sign in to your sales command center":"Create your dealer account"}</h1>
    <p className="authSub">{mode==="login"?"Manage leads, quotes and follow-ups in one place.":"Start free. Build your first lead pipeline without paying for infrastructure."}</p>
    <form onSubmit={submit}>
      {mode==="signup"&&<label>Business / owner name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name or business" required /></label>}
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required /></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 6 characters" minLength={6} required /></label>
      {mode==="signup"&&<label>Confirm Password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" minLength={6} required /></label>}
      {message&&<div className="message">{message}</div>}
      <button className="primary full" disabled={loading}>{loading?"Please wait…":mode==="login"?"Sign in":"Create free account"}</button>
    </form>
    <button className="switch" onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("")}}>{mode==="login"?"Need an account? Create one":"Already have an account? Sign in"}</button>
  </div></main>;
}