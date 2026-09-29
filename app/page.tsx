"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useRouter } from "next/navigation";

type Lead={id:string;name:string;company_name:string|null;requirement:string;status:string;estimated_value:number;created_at:string};

const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);

export default function Home(){
 const router=useRouter(); const [leads,setLeads]=useState<Lead[]>([]); const [business,setBusiness]=useState("Your Workspace"); const [active,setActive]=useState("Overview"); const [show,setShow]=useState(false); const [query,setQuery]=useState(""); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 async function load(){
  setLoading(true);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){router.replace("/login");return;}
  const cid=localStorage.getItem("lead2sales_company_id");
  if(!cid){router.replace("/onboarding");return;}
  const {data:company}=await supabase.from("companies").select("name").eq("id",cid).single(); if(company)setBusiness(company.name);
  const {data,error}=await supabase.from("leads").select("id,name,company_name,requirement,status,estimated_value,created_at").eq("company_id",cid).order("created_at",{ascending:false});
  if(error)setError(error.message); else setLeads((data||[]) as Lead[]);
  setLoading(false);
 }
 useEffect(()=>{load()},[]);
 const filtered=useMemo(()=>leads.filter(l=>[l.name,l.company_name||"",l.requirement].join(" ").toLowerCase().includes(query.toLowerCase())),[leads,query]);
 const pipeline=leads.reduce((s,l)=>s+Number(l.estimated_value||0),0);
 async function addLead(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const cid=localStorage.getItem("lead2sales_company_id");const {data:{user}}=await supabase.auth.getUser();if(!cid||!user)return;const f=new FormData(e.currentTarget);const {error}=await supabase.from("leads").insert({company_id:cid,name:String(f.get("name")),company_name:String(f.get("company")||"")||null,phone:String(f.get("phone")||"")||null,requirement:String(f.get("requirement")),estimated_value:Number(f.get("value")||0),created_by:user.id,source:"manual"});if(error)setError(error.message);else{setShow(false);e.currentTarget.reset();load();}}
 async function signOut(){await supabase.auth.signOut();localStorage.removeItem("lead2sales_company_id");router.replace("/login");}
 return <main className="shell"><aside className="sidebar"><div className="brand"><div className="brandMark">L2</div><div><strong>Lead2Sales</strong><span>AI SALES ENGINE</span></div></div><nav>{["Overview","Leads","Quotations","Follow-ups","Analytics"].map(x=><button key={x} className={active===x?"navItem active":"navItem"} onClick={()=>setActive(x)}><span className="navDot"/>{x}</button>)}</nav><div className="sideCard"><span className="eyebrow">FREE MVP</span><strong>Recover missed sales.</strong><p>Your workspace is connected to a secure cloud database.</p></div><div className="profile"><div className="avatar">DD</div><div><strong>{business}</strong><span onClick={signOut} style={{cursor:"pointer"}}>Sign out</span></div></div></aside>
 <section className="content"><header className="topbar"><div><span className="eyebrow">SALES COMMAND CENTER</span><h1>{active}</h1></div><div className="topActions"><button className="ghost" onClick={signOut}>Sign out</button><button className="primary" onClick={()=>setShow(true)}>+ New Lead</button></div></header>
 <div className="hero"><div><span className="eyebrow">TODAY</span><h2>Turn every enquiry into a next action.</h2><p>Capture the requirement, prepare the quote, and never forget the follow-up.</p></div><div className="heroBadge"><span>Pipeline</span><strong>{money(pipeline)}</strong><small>across {leads.length} leads</small></div></div>
 <div className="stats">{[["Total Leads",leads.length,"All captured enquiries"],["Hot Leads",leads.filter(l=>l.status==="hot").length,"Need attention now"],["Follow-ups",leads.filter(l=>l.status==="follow_up").length,"Due or pending"],["Won",leads.filter(l=>l.status==="won").length,"Converted customers"]].map((s,i)=><div className={i===1?"stat hot":"stat"} key={s[0] as string}><span>{s[0]}</span><strong>{s[1]}</strong><small>{s[2]}</small></div>)}</div>
 <div className="sectionHead"><div><h3>Lead Pipeline</h3><p>Every lead gets a clear next step.</p></div><input className="search" placeholder="Search leads..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
 <div className="tableCard"><div className="tableHeader"><span>Customer</span><span>Requirement</span><span>Status</span><span>Value</span><span>Created</span><span/></div>{loading?<div className="empty">Loading your leads…</div>:filtered.map(l=><div className="tableRow" key={l.id}><div className="customer"><div className="miniAvatar">{l.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><div><strong>{l.name}</strong><small>{l.company_name||"Individual customer"}</small></div></div><div className="requirement">{l.requirement}</div><div><span className={"pill "+l.status.replace("_","")}>{l.status.replace("_"," ")}</span></div><strong>{money(Number(l.estimated_value))}</strong><span className="muted">{new Date(l.created_at).toLocaleDateString("en-IN")}</span><button className="rowAction" onClick={()=>alert("Lead: "+l.name+"\nRequirement: "+l.requirement)}>View</button></div>)}{!loading&&!filtered.length&&<div className="empty">No leads yet. Add your first enquiry.</div>}</div>{error&&<div className="message pageMessage">{error}</div>}</section>
 {show&&<div className="overlay" onClick={()=>setShow(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><div><span className="eyebrow">CAPTURE</span><h2>New Lead</h2></div><button className="close" onClick={()=>setShow(false)}>×</button></div><form onSubmit={addLead}><label>Name<input name="name" required placeholder="Customer name"/></label><label>Company / Site<input name="company" placeholder="Company or residence"/></label><label>Phone<input name="phone" placeholder="+91..."/></label><label>Requirement<textarea name="requirement" required placeholder="e.g. 8 cameras, night vision, mobile app..."/></label><label>Estimated value<input name="value" type="number" min="0" placeholder="50000"/></label><button className="primary full">Save Lead</button></form></div></div>}</main>;
}