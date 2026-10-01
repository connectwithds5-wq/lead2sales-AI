import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PUT(request:NextRequest){
 const authorization=request.headers.get("authorization");
 if(!authorization?.startsWith("Bearer ")) return NextResponse.json({error:"Authentication required."},{status:401});
 const authClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await authClient.auth.getUser();
 if(error||!user)return NextResponse.json({error:"Your session has expired. Please sign in again."},{status:401});
 const body=await request.json().catch(()=>null);
 const cid=String(body?.company_id||"");
 if(!cid)return NextResponse.json({error:"Company workspace is required."},{status:400});
 const {data:member}=await authClient.from("company_members").select("id").eq("company_id",cid).eq("user_id",user.id).maybeSingle();
 if(!member)return NextResponse.json({error:"Access denied."},{status:403});
 const payload={
  name:String(body?.name||"").trim(),
  legal_name:String(body?.legal_name||"").trim()||null,
  address:String(body?.address||"").trim()||null,
  phone:String(body?.phone||"").trim()||null,
  email:String(body?.email||"").trim().toLowerCase()||null,
  gst_number:String(body?.gst_number||"").trim().toUpperCase()||null,
  logo_url:String(body?.logo_url||"").trim()||null
 };
 if(!payload.name)return NextResponse.json({error:"Company name is required."},{status:400});
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!serviceKey)return NextResponse.json({error:"Server database configuration is missing."},{status:503});
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey);
 const {data,error:dbError}=await admin.from("companies").update(payload).eq("id",cid).select("id,name,legal_name,address,phone,email,gst_number,logo_url").single();
 if(dbError)return NextResponse.json({error:dbError.message},{status:500});
 return NextResponse.json({ok:true,company:data});
}