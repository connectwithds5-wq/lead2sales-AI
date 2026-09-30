import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { encryptToken } from "../../../../../lib/oauth-crypto";
export const runtime="nodejs";
function readState(s:string){const [p,sig]=s.split(".");if(!p||!sig||!process.env.OAUTH_STATE_SECRET)return null;const ok=createHmac("sha256",process.env.OAUTH_STATE_SECRET).update(p).digest("base64url")===sig;if(!ok)return null;const v=JSON.parse(Buffer.from(p,"base64url").toString());return v.exp>Date.now()?v:null;}
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get("code"), state=req.nextUrl.searchParams.get("state"), info=state?readState(state):null;
 if(!code||!info)return NextResponse.redirect(new URL("/?email_connect=error",req.url));
 const tenant=process.env.MICROSOFT_TENANT_ID||"common";
 const r=await fetch("https://login.microsoftonline.com/"+tenant+"/oauth2/v2.0/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.MICROSOFT_CLIENT_ID!,client_secret:process.env.MICROSOFT_CLIENT_SECRET!,code,redirect_uri:process.env.MICROSOFT_REDIRECT_URI!,grant_type:"authorization_code",scope:"openid email offline_access Mail.Read"})});
 if(!r.ok)return NextResponse.redirect(new URL("/?email_connect=error",req.url)); const t:any=await r.json();
 const me=await fetch("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName",{headers:{Authorization:"Bearer "+t.access_token}}); const profile:any=await me.json(); const email=profile.mail||profile.userPrincipalName;
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 await admin.from("email_connections").upsert({company_id:info.companyId,provider:"microsoft",email_address:email,access_token_encrypted:encryptToken(t.access_token),refresh_token_encrypted:t.refresh_token?encryptToken(t.refresh_token):null,expires_at:new Date(Date.now()+(t.expires_in||3600)*1000).toISOString(),provider_account_id:profile.id,enabled:true,updated_at:new Date().toISOString()},{onConflict:"company_id,provider,email_address"});
 return NextResponse.redirect(new URL("/?email_connect=success",req.url));
}