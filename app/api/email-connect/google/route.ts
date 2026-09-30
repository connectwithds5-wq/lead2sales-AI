import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, secret=process.env.OAUTH_STATE_SECRET;
 if(!secret)return NextResponse.json({error:"Google email integration is not configured."},{status:500});
 const auth=req.headers.get("authorization")||"", companyId=String((await req.json().catch(()=>({}))).companyId||"");
 if(!auth.startsWith("Bearer ")||!companyId)return NextResponse.json({error:"Unauthorized"},{status:401});
 const c=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user}}=await c.auth.getUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:m}=await c.from("company_members").select("company_id").eq("company_id",companyId).eq("user_id",user.id).maybeSingle();
 if(!m)return NextResponse.json({error:"Workspace access denied."},{status:403});
 const payload=Buffer.from(JSON.stringify({companyId,userId:user.id,exp:Date.now()+10*60*1000})).toString("base64url");
 const sig=createHmac("sha256",secret).update(payload).digest("base64url"); const state=payload+"."+sig;
 const p=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:process.env.GOOGLE_REDIRECT_URI!,response_type:"code",access_type:"offline",prompt:"consent",scope:"openid email https://www.googleapis.com/auth/gmail.readonly",state});
 return NextResponse.json({url:"https://accounts.google.com/o/oauth2/v2/auth?"+p.toString()});
}