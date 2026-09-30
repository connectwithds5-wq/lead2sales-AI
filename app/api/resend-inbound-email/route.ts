import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { recommendRequirement } from "../../../../lib/recommendations";

export const runtime = "nodejs";

function verifyWebhook(payload:string, req:NextRequest, secret:string){
  const id=req.headers.get("svix-id")||"";
  const ts=req.headers.get("svix-timestamp")||"";
  const signatures=req.headers.get("svix-signature")||"";
  const age=Math.abs(Date.now()/1000-Number(ts));
  if(!id||!ts||!signatures||!Number.isFinite(age)||age>300) return false;
  const rawSecret=secret.replace(/^whsec_/,"");
  const key=Buffer.from(rawSecret,"base64");
  const expected=createHmac("sha256",key).update(id+"."+ts+"."+payload).digest("base64");
  return signatures.split(" ").some(s=>{const v=s.startsWith("v1,")?s.slice(3):"";try{return v.length===expected.length&&timingSafeEqual(Buffer.from(v),Buffer.from(expected));}catch{return false;}});
}

function classify(text:string){const s=text.toLowerCase();if(/cctv|camera|surveillance|nvr|dvr/.test(s))return "CCTV";if(/access control|door access|biometric|attendance|boom barrier/.test(s))return "Access Control";if(/fire alarm|smoke detector|heat detector/.test(s))return "Fire Alarm";if(/wifi|wi-fi|wireless|access point/.test(s))return "Wi-Fi";if(/firewall|router|switch|lan|network|cat6|fiber|networking/.test(s))return "Networking";if(/server|storage|nas|san|backup/.test(s))return "Server & Storage";if(/solar|inverter|panel/.test(s))return "Solar";if(/intercom|ip phone|telephone/.test(s))return "Communication";return "Other";}
function extractEmail(v:string){const m=v.match(/<([^>]+)>/)||v.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);return m?(m[1]||m[0]).trim().toLowerCase():"";}
function extractName(v:string,email:string){const m=v.match(/^"?([^"<]+?)"?\s*</);if(m?.[1])return m[1].trim();return email?email.split("@")[0].replace(/[._-]+/g," ").replace(/\b\w/g,x=>x.toUpperCase()):"Email Enquiry";}
function extractPhone(t:string){const m=t.match(/(?:\+?91[\s.-]?)?[6-9]\d{9}\b/);return m?m[0].replace(/[^\d+]/g,""):"";}
function extractValue(t:string){const m=t.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i);return m?Number(m[1].replace(/,/g,"")):0;}

export async function POST(req:NextRequest){
  const secret=process.env.RESEND_WEBHOOK_SECRET, resendKey=process.env.RESEND_API_KEY, url=process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret||!resendKey||!url||!serviceKey)return NextResponse.json({error:"Inbound email is not configured."},{status:500});
  const payload=await req.text();
  if(!verifyWebhook(payload,req,secret))return new NextResponse("Invalid webhook signature",{status:400});
  const event:any=JSON.parse(payload);
  if(event?.type!=="email.received")return NextResponse.json({ok:true});
  const emailId=String(event?.data?.email_id||"");
  const recipient=String(event?.data?.to?.[0]||"").toLowerCase();
  if(!emailId||!recipient)return NextResponse.json({ok:true});

  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data:source}=await admin.from("email_lead_sources").select("company_id,enabled").eq("inbound_address",recipient).maybeSingle();
  if(!source?.enabled)return NextResponse.json({ok:true});
  const {data:dup}=await admin.from("email_lead_events").select("id").eq("email_id",emailId).maybeSingle();
  if(dup)return NextResponse.json({ok:true,duplicate:true});

  const response=await fetch("https://api.resend.com/emails/receiving/"+encodeURIComponent(emailId),{headers:{Authorization:"Bearer "+resendKey}});
  if(!response.ok)return NextResponse.json({error:"Could not retrieve received email."},{status:502});
  const detail:any=await response.json();
  const fromRaw=String(detail.from||event.data.from||"");
  const senderEmail=extractEmail(fromRaw);
  const subject=String(detail.subject||event.data.subject||"").trim();
  const body=String(detail.text||detail.html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const requirement=[subject,body].filter(Boolean).join(" — ").slice(0,10000);
  const leadId=crypto.randomUUID();
  const {error:leadError}=await admin.from("leads").insert({id:leadId,company_id:source.company_id,name:extractName(fromRaw,senderEmail),company_name:null,phone:extractPhone(requirement)||null,email:senderEmail||null,requirement,status:"new",estimated_value:extractValue(requirement),source:"email",lead_category:classify(requirement)});
  if(leadError)return NextResponse.json({error:leadError.message},{status:500});

  const recs=recommendRequirement(requirement);
  if(recs.length){
    const {data:catalog}=await admin.from("product_catalog").select("*").eq("company_id",source.company_id).eq("active",true);
    const boq=recs.map((x:any)=>{const matches=(catalog||[]).filter((p:any)=>p.category===x.category&&(!x.subcategory||!p.subcategory||p.subcategory===x.subcategory));const priced=matches.filter((p:any)=>Number(p.selling_price||0)>0);const pool=priced.length?priced:matches;const match=pool.find((p:any)=>String(p.name).toLowerCase().includes(String(x.item_name).toLowerCase().replace("ip ","")))||pool[0];const {reason,review_required,...item}=x;return {id:crypto.randomUUID(),...item,company_id:source.company_id,lead_id:leadId,unit_price:match?Number(match.selling_price||0):0,notes:review_required?"MANUAL REVIEW REQUIRED: "+reason:reason};});
    await admin.from("lead_boq_items").insert(boq);
  }
  await admin.from("email_lead_events").insert({company_id:source.company_id,email_id:emailId,message_id:event?.data?.message_id||detail.message_id||null,from_email:senderEmail||null,subject:subject||null,received_at:detail.created_at||new Date().toISOString(),lead_id:leadId});
  return NextResponse.json({ok:true,lead_id:leadId});
}
