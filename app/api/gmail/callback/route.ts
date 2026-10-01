import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptToken, googleRedirectUri, verifyState } from "../../../../lib/gmail";

export async function GET(request:NextRequest){
  const state=verifyState(request.nextUrl.searchParams.get("state")||"");
  const code=request.nextUrl.searchParams.get("code")||"";
  const error=request.nextUrl.searchParams.get("error");
  const base=process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const profilePath="/company-profile";
  if(error) return NextResponse.redirect(base+profilePath+"?email=google_cancelled");
  if(!state||!code) return NextResponse.redirect(base+profilePath+"?email=google_error");
  const clientId=process.env.GOOGLE_CLIENT_ID, clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  if(!clientId||!clientSecret) return NextResponse.redirect(base+profilePath+"?email=google_not_configured");
  try{
    const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:googleRedirectUri(),grant_type:"authorization_code"})});
    const tokens=await tokenRes.json();
    if(!tokenRes.ok||!tokens.access_token) throw new Error(tokens.error_description||"Google token exchange failed.");
    const profileRes=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+tokens.access_token}});
    const profile=await profileRes.json();
    if(!profileRes.ok||!profile.email) throw new Error("Could not read the Gmail account.");
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!serviceKey) throw new Error("Server database configuration is missing.");
    const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey);
    const {error:dbError}=await supabase.from("email_connections").upsert({
      company_id:state.company_id,provider:"google",email_address:String(profile.email).toLowerCase(),
      access_token_encrypted:encryptToken(tokens.access_token),
      refresh_token_encrypted:tokens.refresh_token?encryptToken(tokens.refresh_token):null,
      expires_at:new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString(),
      provider_account_id:profile.sub||null,enabled:true,updated_at:new Date().toISOString()
    },{onConflict:"company_id,provider"});
    if(dbError) throw dbError;
    return NextResponse.redirect(base+profilePath+"?email=google_connected");
  }catch(e){
    console.error("Gmail OAuth callback failed:",e);
    return NextResponse.redirect(base+profilePath+"?email=google_error");
  }
}