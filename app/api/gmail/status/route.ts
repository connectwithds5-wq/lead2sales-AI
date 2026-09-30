import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request:NextRequest){
 const authorization=request.headers.get("authorization");
 if(!authorization?.startsWith("Bearer ")) return NextResponse.json({error:"Authentication required."},{status:401});
 const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return NextResponse.json({error:"Your session has expired. Please sign in again."},{status:401});
 const cid=request.nextUrl.searchParams.get("company_id")||"";
 const {data:member}=await supabase.from("company_members").select("id").eq("company_id",cid).eq("user_id",user.id).maybeSingle();
 if(!member)return NextResponse.json({error:"Access denied."},{status:403});
 const {data}=await supabase.from("email_connections").select("provider,email_address,enabled,updated_at").eq("company_id",cid).eq("provider","google").maybeSingle();
 return NextResponse.json({connected:!!data&&data.enabled,email:data?.email_address||null,updated_at:data?.updated_at||null});
}
