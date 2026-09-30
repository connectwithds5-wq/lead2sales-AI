import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request:NextRequest){
 const authorization=request.headers.get("authorization");
 if(!authorization?.startsWith("Bearer ")) return NextResponse.json({error:"Authentication required."},{status:401});
 const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return NextResponse.json({error:"Your session has expired. Please sign in again."},{status:401});
 const cid=String((await request.json().catch(()=>({}))).company_id||"");
 const {data:member}=await supabase.from("company_members").select("id").eq("company_id",cid).eq("user_id",user.id).maybeSingle();
 if(!member)return NextResponse.json({error:"Access denied."},{status:403});
 await supabase.from("email_connections").update({enabled:false,access_token_encrypted:null,refresh_token_encrypted:null,updated_at:new Date().toISOString()}).eq("company_id",cid).eq("provider","google");
 return NextResponse.json({ok:true});
}
