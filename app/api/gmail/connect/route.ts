import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { googleRedirectUri, signState } from "../../../../lib/gmail";

export async function GET(request:NextRequest){
  const clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId||!process.env.GOOGLE_CLIENT_SECRET) return NextResponse.json({error:"Gmail integration is not configured yet."},{status:503});
  const authorization=request.headers.get("authorization");
  if(!authorization?.startsWith("Bearer ")) return NextResponse.json({error:"Authentication required."},{status:401});
  const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user) return NextResponse.json({error:"Your session has expired. Please sign in again."},{status:401});
  const cid=request.nextUrl.searchParams.get("company_id") || "";
  if(!cid) return NextResponse.json({error:"Company workspace is required."},{status:400});
  const {data:member}=await supabase.from("company_members").select("id").eq("company_id",cid).eq("user_id",user.id).maybeSingle();
  if(!member) return NextResponse.json({error:"You do not have access to this workspace."},{status:403});
  const state=signState({user_id:user.id,company_id:cid,exp:Date.now()+10*60*1000});
  const params=new URLSearchParams({client_id:clientId,redirect_uri:googleRedirectUri(),response_type:"code",access_type:"offline",prompt:"consent",scope:"openid email profile https://www.googleapis.com/auth/gmail.send",state});
  return NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+params.toString());
}
