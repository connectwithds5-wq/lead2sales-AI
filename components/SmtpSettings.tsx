"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Config = { email:string; host:string; port:number; secure:boolean; username:string; senderName:string };

export default function SmtpSettings(){
  const [cfg,setCfg]=useState<Config>({email:"",host:"smtpout.secureserver.net",port:465,secure:true,username:"",senderName:""});
  const [password,setPassword]=useState("");
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const [error,setError]=useState("");

  async function headers(){
    const s=(await supabase.auth.getSession()).data.session;
    return s?{Authorization:"Bearer "+s.access_token,"Content-Type":"application/json"}:{"Content-Type":"application/json"};
  }
  async function load(){
    const cid=localStorage.getItem("lead2sales_company_id"); if(!cid)return;
    const s=(await supabase.auth.getSession()).data.session;
    const r=await fetch("/api/smtp?company_id="+encodeURIComponent(cid),{headers:s?{Authorization:"Bearer "+s.access_token}:{}});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.config){setCfg({...cfg,...d.config});setConnected(!!d.connected);}
  }
  useEffect(()=>{load();},[]);

  async function saveOrTest(action:"save"|"test"){
    const cid=localStorage.getItem("lead2sales_company_id"); if(!cid)return;
    setBusy(true);setError("");setMsg("");
    const h=await headers();
    const r=await fetch("/api/smtp?company_id="+encodeURIComponent(cid),{method:"POST",headers:h,body:JSON.stringify({...cfg,password,action})});
    const d=await r.json().catch(()=>({}));
    if(r.ok){setMsg(d.message||"SMTP connection verified.");if(action==="save"){setConnected(true);setPassword("");}}
    else setError(d.error||"SMTP operation failed.");
    setBusy(false);
  }
  async function disconnect(){
    const cid=localStorage.getItem("lead2sales_company_id"); if(!cid)return;
    setBusy(true);setError("");setMsg("");
    const h=await headers();
    const r=await fetch("/api/smtp?company_id="+encodeURIComponent(cid),{method:"DELETE",headers:h});
    if(r.ok){setConnected(false);setPassword("");setMsg("SMTP sending disconnected.");}else{const d=await r.json().catch(()=>({}));setError(d.error||"Could not disconnect SMTP.");}
    setBusy(false);
  }

  return <section className="profileCard">
    <div className="profileTitle"><div><h2>SMTP Email Sending</h2><p>Send BOQ and quotation emails directly from your company mailbox without Gmail.</p></div><b className={connected?"ccSuccess":"ccError"}>{connected?"CONNECTED":"NOT CONNECTED"}</b></div>
    <div className="profileGrid">
      <label>Sender Email<input type="email" value={cfg.email} onChange={e=>setCfg({...cfg,email:e.target.value})} placeholder="sales@allakuniversal.com"/></label>
      <label>Sender Name<input value={cfg.senderName} onChange={e=>setCfg({...cfg,senderName:e.target.value})} placeholder="AL LAK Universal"/></label>
      <label>SMTP Host<input value={cfg.host} onChange={e=>setCfg({...cfg,host:e.target.value})} placeholder="smtpout.secureserver.net"/></label>
      <label>SMTP Port<input type="number" value={cfg.port} onChange={e=>setCfg({...cfg,port:Number(e.target.value)})}/></label>
      <label>SMTP Username<input value={cfg.username} onChange={e=>setCfg({...cfg,username:e.target.value})} placeholder="sales@allakuniversal.com"/></label>
      <label>SMTP Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={connected?"Leave blank to keep saved password":"GoDaddy mailbox password"}/></label>
      <label><input type="checkbox" checked={cfg.secure} onChange={e=>setCfg({...cfg,secure:e.target.checked})}/> Use SSL / secure SMTP</label>
    </div>
    <div className="profileActions">
      <button className="ccGhost" disabled={busy} onClick={()=>saveOrTest("test")}>{busy?"Please wait…":"Test Connection"}</button>
      <button className="ccPrimary" disabled={busy} onClick={()=>saveOrTest("save")}>{busy?"Please wait…":"Save SMTP Settings"}</button>
      {connected&&<button className="ccGhost" disabled={busy} onClick={disconnect}>Disconnect SMTP</button>}
    </div>
    {error&&<div className="ccError" style={{marginTop:12}}>{error}</div>}
    {msg&&<div className="ccSuccess" style={{marginTop:12}}>{msg}</div>}
  </section>;
}
