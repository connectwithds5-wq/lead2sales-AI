// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Config={email:string;host:string;port:number;security:"ssl"|"starttls"|"none";username:string;senderName:string;authMethod:"auto"|"login"|"plain"|"cram-md5"};

const presets:any={
  Custom:{host:"",port:587,security:"starttls",authMethod:"auto"},
  Gmail:{host:"smtp.gmail.com",port:465,security:"ssl",authMethod:"auto"},
  "Microsoft 365":{host:"smtp.office365.com",port:587,security:"starttls",authMethod:"auto"},
  Zoho:{host:"smtp.zoho.com",port:465,security:"ssl",authMethod:"auto"},
  Hostinger:{host:"smtp.hostinger.com",port:465,security:"ssl",authMethod:"auto"},
  GoDaddy:{host:"smtpout.secureserver.net",port:465,security:"ssl",authMethod:"auto"},
};

export default function SmtpSettings(){
 const [provider,setProvider]=useState("Custom");
 const [cfg,setCfg]=useState<Config>({email:"",host:"",port:587,security:"starttls",username:"",senderName:"",authMethod:"auto"});
 const [password,setPassword]=useState(""); const [connected,setConnected]=useState(false); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState(""); const [error,setError]=useState("");
 async function headers(){const s=(await supabase.auth.getSession()).data.session;return s?{Authorization:"Bearer "+s.access_token,"Content-Type":"application/json"}:{"Content-Type":"application/json"};}
 async function load(){const cid=localStorage.getItem("lead2sales_company_id");if(!cid)return;const s=(await supabase.auth.getSession()).data.session;const r=await fetch("/api/smtp?company_id="+encodeURIComponent(cid),{headers:s?{Authorization:"Bearer "+s.access_token}:{} });const d=await r.json().catch(()=>({}));if(r.ok&&d.config){setCfg(d.config);setConnected(!!d.connected);const match=Object.entries(presets).find(([,p]:any)=>p.host===d.config.host&&p.port===d.config.port&&p.security===d.config.security);setProvider(match?String(match[0]):"Custom");}}
 useEffect(()=>{load();},[]);
 function chooseProvider(v:string){setProvider(v);if(v!=="Custom")setCfg(c=>({...c,...presets[v]}));}
 async function saveOrTest(action:"save"|"test"){const cid=localStorage.getItem("lead2sales_company_id");if(!cid)return;setBusy(true);setError("");setMsg("");const r=await fetch("/api/smtp?company_id="+encodeURIComponent(cid),{method:"POST",headers:await headers(),body:JSON.stringify({...cfg,password,action})});const d=await r.json().catch(()=>({}));if(r.ok){setMsg(d.message||"SMTP connection verified.");if(action==="save"){setConnected(true);setPassword("");}}else setError(d.error||"SMTP operation failed.");setBusy(false);}
 async function disconnect(){const cid=localStorage.getItem("lead2sales_company_id");if(!cid)return;setBusy(true);setError("");setMsg("");const r=await fetch("/api/smtp?company_id="+encodeURIComponent(cid),{method:"DELETE",headers:await headers()});if(r.ok){setConnected(false);setPassword("");setMsg("SMTP sending disconnected.");}else{const d=await r.json().catch(()=>({}));setError(d.error||"Could not disconnect SMTP.");}setBusy(false);}
 return <section className="profileCard">
  <div className="profileTitle"><div><h2>SMTP Email Sending</h2><p>Connect any mailbox provider or custom SMTP server. Credentials stay encrypted on the server.</p></div><b className={connected?"ccSuccess":"ccError"}>{connected?"CONNECTED":"NOT CONNECTED"}</b></div>
  <div className="profileGrid">
   <label>Email Provider<select value={provider} onChange={e=>chooseProvider(e.target.value)}>{Object.keys(presets).map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Sender Email<input type="email" value={cfg.email} onChange={e=>setCfg({...cfg,email:e.target.value})} placeholder="sales@example.com"/></label>
   <label>Sender Name<input value={cfg.senderName} onChange={e=>setCfg({...cfg,senderName:e.target.value})} placeholder="Your Company"/></label>
   <label>SMTP Host<input value={cfg.host} onChange={e=>{setProvider("Custom");setCfg({...cfg,host:e.target.value})}} placeholder="smtp.example.com"/></label>
   <label>SMTP Port<input type="number" value={cfg.port} onChange={e=>{setProvider("Custom");setCfg({...cfg,port:Number(e.target.value)})}} placeholder="587"/></label>
   <label>Security<select value={cfg.security} onChange={e=>{setProvider("Custom");setCfg({...cfg,security:e.target.value})}}><option value="starttls">STARTTLS</option><option value="ssl">SSL/TLS</option><option value="none">None</option></select></label>
   <label>SMTP Username<input value={cfg.username} onChange={e=>setCfg({...cfg,username:e.target.value})} placeholder="sales@example.com"/></label>
   <label>SMTP Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={connected?"Leave blank to keep saved password":"Enter mailbox/app password"}/></label>
   <label>Authentication<select value={cfg.authMethod} onChange={e=>setCfg({...cfg,authMethod:e.target.value})}><option value="auto">Auto</option><option value="login">LOGIN</option><option value="plain">PLAIN</option><option value="cram-md5">CRAM-MD5</option></select></label>
  </div>
  <p style={{marginTop:10,fontSize:12,opacity:.75}}>Use the SMTP details supplied by your email host. Port 465 normally uses SSL/TLS; 587 normally uses STARTTLS.</p>
  <div className="profileActions"><button className="ccGhost" disabled={busy} onClick={()=>saveOrTest("test")}>{busy?"Please wait…":"Test Connection"}</button><button className="ccPrimary" disabled={busy} onClick={()=>saveOrTest("save")}>{busy?"Please wait…":"Save SMTP Settings"}</button>{connected&&<button className="ccGhost" disabled={busy} onClick={disconnect}>Disconnect SMTP</button>}</div>
  {error&&<div className="ccError" style={{marginTop:12}}>{error}</div>}{msg&&<div className="ccSuccess" style={{marginTop:12}}>{msg}</div>}
 </section>;
}
