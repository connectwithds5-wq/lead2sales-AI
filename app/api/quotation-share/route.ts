import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!supabaseUrl||!anonKey||!serviceKey)return NextResponse.json({error:"Storage service is not configured."},{status:500});
    const auth=request.headers.get("authorization");
    if(!auth?.startsWith("Bearer "))return NextResponse.json({error:"Authentication required."},{status:401});
    const client=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user)return NextResponse.json({error:"Your session has expired."},{status:401});
    const body=await request.json();
    const quoteId=String(body?.quoteId||"");
    const pdfBase64=String(body?.pdfBase64||"");
    const filename=String(body?.filename||"quotation.pdf").replace(/[^a-zA-Z0-9._-]/g,"_");
    if(!quoteId||!pdfBase64)return NextResponse.json({error:"Quotation and PDF are required."},{status:400});
    if(pdfBase64.length>8_000_000)return NextResponse.json({error:"Quotation PDF is too large."},{status:413});
    const {data:quote,error:qError}=await client.from("quotations").select("id,company_id").eq("id",quoteId).single();
    if(qError||!quote)return NextResponse.json({error:"Quotation not found."},{status:404});
    const admin=createClient(supabaseUrl,serviceKey);
    const bucket="quotation-pdfs";
    const {data:buckets}=await admin.storage.listBuckets();
    if(!buckets?.some((b:any)=>b.name===bucket)){
      const {error:createError}=await admin.storage.createBucket(bucket,{public:false});
      if(createError && !String(createError.message||"").toLowerCase().includes("already exists"))throw createError;
    }
    const bytes=Buffer.from(pdfBase64,"base64");
    const path=quote.company_id+"/"+quoteId+"/"+filename;
    const {error:uploadError}=await admin.storage.from(bucket).upload(path,bytes,{contentType:"application/pdf",upsert:true});
    if(uploadError)throw uploadError;
    const {data:signed,error:signedError}=await admin.storage.from(bucket).createSignedUrl(path,7*24*60*60);
    if(signedError||!signed?.signedUrl)throw signedError||new Error("Could not create download link.");
    return NextResponse.json({ok:true,url:signed.signedUrl,expiresIn:7*24*60*60});
  }catch(error:any){console.error("Quotation share failed:",error);return NextResponse.json({error:error?.message||"Could not create quotation share link."},{status:500});}
}
