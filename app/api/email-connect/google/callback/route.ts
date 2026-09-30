import { NextRequest, NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get("code"), state=req.nextUrl.searchParams.get("state");
 if(!code||!state)return NextResponse.redirect(new URL("/?email_connect=error",req.url));
 const clientId=process.env.GOOGLE_CLIENT_ID!, secret=process.env.GOOGLE_CLIENT_SECRET!, redirect=process.env.GOOGLE_REDIRECT_URI!;
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:secret,redirect_uri:redirect,grant_type:"authorization_code"})});
 if(!r.ok)return NextResponse.redirect(new URL("/?email_connect=error",req.url));
 const t:any=await r.json(); const info=JSON.parse(Buffer.from(state,"base64url").toString());
 const me=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile",{headers:{Authorization:"Bearer "+t.access_token}});
 const profile:any=await me.json();
 const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY!, db=process.env.NEXT_PUBLIC_SUPABASE_URL!;
 const {createClient}=await import("@supabase/supabase-js"); const admin=createClient(db,adminKey,{auth:{persistSession:false}});
 await admin.from("email_connections").upsert({company_id:info.companyId,provider:"google",email_address:profile.emailAddress,access_token_encrypted:t.access_token,refresh_token_encrypted:t.refresh_token||null,expires_at:new Date(Date.now()+(t.expires_in||3600)*1000).toISOString(),provider_account_id:profile.emailAddress,enabled:true,updated_at:new Date().toISOString()},{onConflict:"company_id,provider,email_address"});
 return NextResponse.redirect(new URL("/?email_connect=success",req.url));
}