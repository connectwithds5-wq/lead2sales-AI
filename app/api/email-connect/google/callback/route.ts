import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
function readState(s:string){const [p,sig]=s.split(".");if(!p||!sig||!process.env.OAUTH_STATE_SECRET)return null;const ok=createHmac("sha256",process.env.OAUTH_STATE_SECRET).update(p).digest("base64url")===sig;if(!ok)return null;const v=JSON.parse(Buffer.from(p,"base64url").toString());return v.exp>Date.now()?v:null;}
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get("code"), state=req.nextUrl.searchParams.get("state"), info=state?readState(state):null;
 if(!code||!info)return NextResponse.redirect(new URL("/?email_connect=error",req.url));
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:process.env.GOOGLE_REDIRECT_URI!,grant_type:"authorization_code"})});
 if(!r.ok)return NextResponse.redirect(new URL("/?email_connect=error",req.url)); const t:any=await r.json();
 const me=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile",{headers:{Authorization:"Bearer "+t.access_token}}); const profile:any=await me.json();
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 await admin.from("email_connections").upsert({company_id:info.companyId,provider:"google",email_address:profile.emailAddress,access_token_encrypted:t.access_token,refresh_token_encrypted:t.refresh_token||null,expires_at:new Date(Date.now()+(t.expires_in||3600)*1000).toISOString(),provider_account_id:profile.emailAddress,enabled:true,updated_at:new Date().toISOString()},{onConflict:"company_id,provider,email_address"});
 return NextResponse.redirect(new URL("/?email_connect=success",req.url));
}