import { NextRequest, NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get("code"), state=req.nextUrl.searchParams.get("state");
 if(!code||!state)return NextResponse.redirect(new URL("/?email_connect=error",req.url));
 const clientId=process.env.MICROSOFT_CLIENT_ID!, secret=process.env.MICROSOFT_CLIENT_SECRET!, redirect=process.env.MICROSOFT_REDIRECT_URI!, tenant=process.env.MICROSOFT_TENANT_ID||"common";
 const r=await fetch("https://login.microsoftonline.com/"+tenant+"/oauth2/v2.0/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:secret,code,redirect_uri:redirect,grant_type:"authorization_code",scope:"openid email offline_access Mail.Read"})});
 if(!r.ok)return NextResponse.redirect(new URL("/?email_connect=error",req.url));
 const t:any=await r.json(); const info=JSON.parse(Buffer.from(state,"base64url").toString());
 const me=await fetch("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName",{headers:{Authorization:"Bearer "+t.access_token}});
 const profile:any=await me.json(); const email=profile.mail||profile.userPrincipalName;
 const {createClient}=await import("@supabase/supabase-js"); const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 await admin.from("email_connections").upsert({company_id:info.companyId,provider:"microsoft",email_address:email,access_token_encrypted:t.access_token,refresh_token_encrypted:t.refresh_token||null,expires_at:new Date(Date.now()+(t.expires_in||3600)*1000).toISOString(),provider_account_id:profile.id,enabled:true,updated_at:new Date().toISOString()},{onConflict:"company_id,provider,email_address"});
 return NextResponse.redirect(new URL("/?email_connect=success",req.url));
}