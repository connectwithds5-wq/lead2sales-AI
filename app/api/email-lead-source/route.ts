import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function slugify(value:string){
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40) || "company";
}

export async function POST(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const inboundDomain=process.env.RESEND_INBOUND_DOMAIN;
  if(!url||!anonKey||!serviceKey||!inboundDomain){
    return NextResponse.json({error:"Lead2Sales email capture is not configured by the platform admin."},{status:500});
  }

  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer ")) return NextResponse.json({error:"Unauthorized"},{status:401});
  const token=auth.slice(7);
  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user) return NextResponse.json({error:"Unauthorized"},{status:401});

  const body:any=await req.json().catch(()=>({}));
  const companyId=String(body.companyId||"");
  if(!companyId) return NextResponse.json({error:"Workspace not found."},{status:400});

  const {data:membership}=await userClient.from("company_members").select("company_id").eq("company_id",companyId).eq("user_id",user.id).maybeSingle();
  if(!membership) return NextResponse.json({error:"You do not have access to this workspace."},{status:403});

  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data:company}=await admin.from("companies").select("name").eq("id",companyId).single();
  if(!company) return NextResponse.json({error:"Workspace not found."},{status:404});

  const {data:existing}=await admin.from("email_lead_sources").select("id,inbound_address,enabled").eq("company_id",companyId).maybeSingle();
  if(existing){
    const enabled=body.enabled!==false;
    const {data:updated,error}=await admin.from("email_lead_sources").update({enabled,updated_at:new Date().toISOString()}).eq("id",existing.id).select("id,inbound_address,enabled").single();
    if(error) return NextResponse.json({error:error.message},{status:500});
    return NextResponse.json({source:updated});
  }

  const local=slugify(company.name)+"-"+companyId.slice(0,8);
  const inboundAddress=local+"@"+inboundDomain.replace(/^@/,"");
  const {data:source,error}=await admin.from("email_lead_sources").insert({
    company_id:companyId,
    inbound_address:inboundAddress,
    enabled:body.enabled!==false
  }).select("id,inbound_address,enabled").single();
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({source});
}
