import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
 const auth=req.nextUrl.searchParams.get("token"), companyId=req.nextUrl.searchParams.get("companyId");
 if(!auth||!companyId)return NextResponse.json({error:"Missing authorization context."},{status:400});
 const c=createClient(url,key,{global:{headers:{Authorization:"Bearer "+auth}},auth:{persistSession:false}});
 const {data:{user}}=await c.auth.getUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:m}=await c.from("company_members").select("company_id").eq("company_id",companyId).eq("user_id",user.id).maybeSingle();
 if(!m)return NextResponse.json({error:"Workspace access denied."},{status:403});
 const clientId=process.env.GOOGLE_CLIENT_ID, redirect=process.env.GOOGLE_REDIRECT_URI;
 if(!clientId||!redirect)return NextResponse.json({error:"Google email integration is not configured by the platform admin."},{status:500});
 const state=Buffer.from(JSON.stringify({companyId,userId:user.id})).toString("base64url");
 const p=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:"code",access_type:"offline",prompt:"consent",scope:"openid email https://www.googleapis.com/auth/gmail.readonly",state});
 return NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+p.toString());
}