// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const nodemailer=require("nodemailer");
import { decryptToken, encryptToken } from "../../../lib/gmail";

async function getContext(request:NextRequest){
 const authorization=request.headers.get("authorization");
 if(!authorization?.startsWith("Bearer "))return{error:"Authentication required.",status:401 as const};
 const auth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await auth.auth.getUser(); if(error||!user)return{error:"Your session has expired. Please sign in again.",status:401 as const};
 const companyId=request.nextUrl.searchParams.get("company_id")||""; if(!companyId)return{error:"Company workspace is required.",status:400 as const};
 const {data:member}=await auth.from("company_members").select("id").eq("company_id",companyId).eq("user_id",user.id).maybeSingle(); if(!member)return{error:"Access denied.",status:403 as const};
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY; if(!serviceKey)return{error:"Server database configuration is missing.",status:503 as const};
 return{admin:createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey),companyId};
}
function normalizeConfig(body:any){
 const host=String(body?.host||"").trim(),port=Number(body?.port||587),username=String(body?.username||"").trim(),email=String(body?.email||"").trim().toLowerCase(),senderName=String(body?.senderName||"").trim();
 const security=["ssl","starttls","none"].includes(String(body?.security))?String(body.security):"starttls";
 const authMethod=["auto","login","plain","cram-md5"].includes(String(body?.authMethod))?String(body.authMethod):"auto";
 if(!host||!Number.isInteger(port)||port<1||port>65535||!username||!email)throw new Error("SMTP host, port, username and sender email are required.");
 return{host,port,username,email,senderName,security,authMethod};
}
function transportFor(c:any,password:string){
 const t:any={host:c.host,port:c.port,secure:c.security==="ssl",connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000};
 if(c.security==="starttls")t.requireTLS=true; if(c.security==="none")t.ignoreTLS=true;
 if(c.authMethod!=="auto")t.authMethod=c.authMethod.toUpperCase();
 t.auth={user:c.username,pass:password}; return nodemailer.createTransport(t);
}
export async function GET(request:NextRequest){
 try{const ctx=await getContext(request);if("error"in ctx)return NextResponse.json({error:ctx.error},{status:ctx.status});
 const {data,error}=await ctx.admin.from("email_connections").select("email_address,smtp_host,smtp_port,smtp_secure,smtp_security,smtp_auth_method,smtp_username,sender_name,enabled,updated_at").eq("company_id",ctx.companyId).eq("provider","smtp").maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});
 const security=data?.smtp_security||(data?.smtp_secure?"ssl":"starttls"),authMethod=data?.smtp_auth_method||"auto";
 return NextResponse.json({connected:!!data&&data.enabled,config:data?{email:data.email_address,host:data.smtp_host,port:data.smtp_port,security,username:data.smtp_username,senderName:data.sender_name,authMethod}:null,updated_at:data?.updated_at||null},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not load SMTP settings."},{status:500});}
}
export async function POST(request:NextRequest){
 try{const ctx=await getContext(request);if("error"in ctx)return NextResponse.json({error:ctx.error},{status:ctx.status});const body=await request.json().catch(()=>({}));const c=normalizeConfig(body);const password=String(body?.password||"");const action=String(body?.action||"save");let finalPassword=password;
 if(!finalPassword){const {data:existing}=await ctx.admin.from("email_connections").select("smtp_password_encrypted").eq("company_id",ctx.companyId).eq("provider","smtp").maybeSingle();if(existing?.smtp_password_encrypted)finalPassword=decryptToken(existing.smtp_password_encrypted);}
 if(!finalPassword)return NextResponse.json({error:"SMTP password is required."},{status:400});
 const transport=transportFor(c,finalPassword);await transport.verify();transport.close();
 if(action==="test")return NextResponse.json({ok:true,message:"SMTP connection verified successfully."});
 const now=new Date().toISOString();const {error}=await ctx.admin.from("email_connections").upsert({company_id:ctx.companyId,provider:"smtp",email_address:c.email,smtp_host:c.host,smtp_port:c.port,smtp_secure:c.security==="ssl",smtp_security:c.security,smtp_auth_method:c.authMethod,smtp_username:c.username,smtp_password_encrypted:encryptToken(finalPassword),sender_name:c.senderName||null,enabled:true,updated_at:now},{onConflict:"company_id,provider"});
 if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true,message:"SMTP settings saved successfully."});
 }catch(e){console.error("SMTP settings error:",e);return NextResponse.json({error:e instanceof Error?e.message:"SMTP connection failed. Check the SMTP settings."},{status:502});}
}
export async function DELETE(request:NextRequest){
 try{const ctx=await getContext(request);if("error"in ctx)return NextResponse.json({error:ctx.error},{status:ctx.status});const {error}=await ctx.admin.from("email_connections").update({enabled:false,smtp_password_encrypted:null,updated_at:new Date().toISOString()}).eq("company_id",ctx.companyId).eq("provider","smtp");if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not disconnect SMTP."},{status:500});}
}
