"use client";

import { useMemo, useState } from "react";

type Lead = { id:number; name:string; company:string; requirement:string; status:"New"|"Hot"|"Follow-up"|"Won"; value:number; age:string };
const initialLeads:Lead[] = [
 {id:1,name:"Rajesh Patel",company:"Patel Traders",requirement:"4 CCTV cameras + mobile viewing",status:"Hot",value:42000,age:"2h"},
 {id:2,name:"Amit Shah",company:"Shree Office",requirement:"16 camera IP CCTV system",status:"Follow-up",value:128000,age:"1d"},
 {id:3,name:"Neha Desai",company:"Desai Residence",requirement:"6 cameras with 30-day storage",status:"New",value:68000,age:"3h"},
 {id:4,name:"Kunal Mehta",company:"Mehta Warehouse",requirement:"32 camera surveillance + networking",status:"Won",value:285000,age:"4d"}
];
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);

export default function Home(){
 const [leads,setLeads]=useState(initialLeads),[active,setActive]=useState("Overview"),[show,setShow]=useState(false),[query,setQuery]=useState("");
 const filtered=useMemo(()=>leads.filter(l=>[l.name,l.company,l.requirement].join(" ").toLowerCase().includes(query.toLowerCase())),[leads,query]);
 const pipeline=leads.reduce((s,l)=>s+l.value,0);
 function addLead(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setLeads(p=>[{id:Date.now(),name:String(f.get("name")),company:String(f.get("company")),requirement:String(f.get("requirement")),status:"New",value:Number(f.get("value")||0),age:"now"},...p]);setShow(false);e.currentTarget.reset();}
 return <main className="shell">
  <aside className="sidebar"><div className="brand"><div className="brandMark">L2</div><div><strong>Lead2Sales</strong><span>AI SALES ENGINE</span></div></div>
   <nav>{["Overview","Leads","Quotations","Follow-ups","Analytics"].map(x=><button key={x} className={active===x?"navItem active":"navItem"} onClick={()=>setActive(x)}><span className="navDot"/>{x}</button>)}</nav>
   <div className="sideCard"><span className="eyebrow">MVP MODE</span><strong>Built to recover missed sales.</strong><p>Start free. Upgrade only when revenue proves the workflow.</p></div>
   <div className="profile"><div className="avatar">DD</div><div><strong>Demo Dealer</strong><span>Admin</span></div></div>
  </aside>
  <section className="content"><header className="topbar"><div><span className="eyebrow">SALES COMMAND CENTER</span><h1>{active}</h1></div><div className="topActions"><button className="ghost">Settings</button><button className="primary" onClick={()=>setShow(true)}>+ New Lead</button></div></header>
   <div className="hero"><div><span className="eyebrow">TODAY</span><h2>Turn every enquiry into a next action.</h2><p>Capture the requirement, prepare the quote, and never forget the follow-up.</p></div><div className="heroBadge"><span>Pipeline</span><strong>{money(pipeline)}</strong><small>across active leads</small></div></div>
   <div className="stats">{[["Total Leads",leads.length,"All captured enquiries"],["Hot Leads",leads.filter(l=>l.status==="Hot").length,"Need attention now"],["Follow-ups",leads.filter(l=>l.status==="Follow-up").length,"Due or pending"],["Won",leads.filter(l=>l.status==="Won").length,"Converted customers"]].map((s,i)=><div className={i===1?"stat hot":"stat"} key={s[0] as string}><span>{s[0]}</span><strong>{s[1]}</strong><small>{s[2]}</small></div>)}</div>
   <div className="sectionHead"><div><h3>Lead Pipeline</h3><p>Every lead gets a clear next step.</p></div><input className="search" placeholder="Search leads..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
   <div className="tableCard"><div className="tableHeader"><span>Customer</span><span>Requirement</span><span>Status</span><span>Value</span><span>Age</span><span/></div>
    {filtered.map(l=><div className="tableRow" key={l.id}><div className="customer"><div className="miniAvatar">{l.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><div><strong>{l.name}</strong><small>{l.company}</small></div></div><div className="requirement">{l.requirement}</div><div><span className={"pill "+l.status.toLowerCase().replace("-","")}>{l.status}</span></div><strong>{money(l.value)}</strong><span className="muted">{l.age}</span><button className="rowAction" onClick={()=>alert("Lead: "+l.name+"\nRequirement: "+l.requirement)}>View</button></div>)}
    {!filtered.length&&<div className="empty">No leads match your search.</div>}
   </div>
  </section>
  {show&&<div className="overlay" onClick={()=>setShow(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><div><span className="eyebrow">CAPTURE</span><h2>New Lead</h2></div><button className="close" onClick={()=>setShow(false)}>×</button></div><form onSubmit={addLead}><label>Name<input name="name" required placeholder="Customer name"/></label><label>Company / Site<input name="company" placeholder="Company or residence"/></label><label>Requirement<textarea name="requirement" required placeholder="e.g. 8 cameras, night vision, mobile app..."/></label><label>Estimated value<input name="value" type="number" min="0" placeholder="50000"/></label><button className="primary full">Create Lead</button></form></div></div>}
 </main>;
}