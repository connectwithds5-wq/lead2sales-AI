import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken, base64Url, mimeHeader } from "../../../lib/gmail";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    // Gmail OAuth is the primary sender when the company has connected Gmail.
    // Resend is only a fallback, so its sender/domain must not block Gmail.
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }

    const body = await request.json();
    const quoteId = String(body?.quoteId || "");
    const pdfBase64 = String(body?.pdfBase64 || "");
    const filename = String(body?.filename || "quotation.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");

    if (!quoteId || !pdfBase64) {
      return NextResponse.json({ error: "Quotation and PDF are required." }, { status: 400 });
    }

    // Vercel Functions have a 4.5 MB request-body limit, so reject oversized PDFs
    // with a clear message instead of allowing a generic 413 error.
    if (pdfBase64.length > 4_000_000) {
      return NextResponse.json(
        { error: "The generated PDF is too large for direct email sending. Please use Print / Save PDF or contact support." },
        { status: 413 }
      );
    }

    const { data: quotation, error: quoteError } = await supabase
      .from("quotations")
      .select("id, quotation_no, grand_total, company_id, lead_id, leads(name,email,company_name)")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quotation) {
      return NextResponse.json({ error: "Quotation not found or you do not have access to it." }, { status: 404 });
    }

    const lead = Array.isArray(quotation.leads) ? quotation.leads[0] : quotation.leads;
    const recipient = String(lead?.email || "").trim();
    if (!recipient) {
      return NextResponse.json({ error: "Customer has no email address. Add the customer's email in the lead first." }, { status: 400 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("name,legal_name,email,phone,address,gst_number")
      .eq("id", quotation.company_id)
      .single();

    const companyName = company?.legal_name || company?.name || "Lead2Sales";
    const customerName = lead?.name || "Customer";
    const total = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(quotation.grand_total || 0));

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1f2937;line-height:1.6">
        <h2 style="margin-bottom:8px">${escapeHtml(companyName)}</h2>
        <p>Dear ${escapeHtml(customerName)},</p>
        <p>Please find attached our quotation <strong>${escapeHtml(quotation.quotation_no)}</strong> for your requirement.</p>
        <p><strong>Quotation Value:</strong> ${escapeHtml(total)}</p>
        <p>We would be happy to discuss any changes or answer your questions.</p>
        <p>Regards,<br><strong>${escapeHtml(companyName)}</strong>${company?.phone ? `<br>${escapeHtml(company.phone)}` : ""}${company?.email ? `<br>${escapeHtml(company.email)}` : ""}</p>
      </div>
    `;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: gmail } = await admin.from("email_connections").select("id,email_address,access_token_encrypted,refresh_token_encrypted,expires_at,enabled").eq("company_id",quotation.company_id).eq("provider","google").eq("enabled",true).maybeSingle();
      if (gmail?.refresh_token_encrypted || gmail?.access_token_encrypted) {
        try {
          let accessToken = gmail.access_token_encrypted ? decryptToken(gmail.access_token_encrypted) : "";
          if (!gmail.expires_at || new Date(gmail.expires_at).getTime() < Date.now()+60000) {
            if (!gmail.refresh_token_encrypted) throw new Error("Gmail connection needs to be reconnected.");
            const rr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||"",client_secret:process.env.GOOGLE_CLIENT_SECRET||"",refresh_token:decryptToken(gmail.refresh_token_encrypted),grant_type:"refresh_token"})});
            const rt=await rr.json().catch(()=>({}));
            if(!rr.ok||!rt.access_token) throw new Error(rt.error_description||"Could not refresh Gmail access.");
            accessToken=rt.access_token;
            await admin.from("email_connections").update({access_token_encrypted:encryptToken(accessToken),expires_at:new Date(Date.now()+Number(rt.expires_in||3600)*1000).toISOString(),updated_at:new Date().toISOString()}).eq("id",gmail.id);
          }
          const boundary="l2s_"+crypto.randomUUID().replace(/-/g,"");
          const mime=[`From: ${mimeHeader(companyName)} <${gmail.email_address}>`,`To: ${recipient}`,`Subject: ${mimeHeader(`Quotation ${quotation.quotation_no} — ${companyName}`)}`,"MIME-Version: 1.0",`Content-Type: multipart/mixed; boundary="${boundary}"`,"",`--${boundary}`,"Content-Type: text/html; charset=UTF-8","Content-Transfer-Encoding: 8bit","",html,"",`--${boundary}`,"Content-Type: application/pdf; name="+filename,"Content-Disposition: attachment; filename="+filename,"Content-Transfer-Encoding: base64","",pdfBase64.match(/.{1,76}/g)?.join("\r\n")||pdfBase64,"",`--${boundary}--`].join("\r\n");
          const gr=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({raw:base64Url(mime)})});
          const gd=await gr.json().catch(()=>({}));
          if(!gr.ok) throw new Error(gd?.error?.message||"Gmail rejected the message.");
          return NextResponse.json({ok:true,id:gd?.id||null,to:recipient,provider:"gmail"});
        } catch(e) { console.error("Gmail send failed:",e); }
      }
    }

    if (!apiKey || !from) {
      return NextResponse.json(
        { error: "No email sender is connected. Connect Gmail in Company Settings or configure a verified Resend sender domain." },
        { status: 500 }
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        ...(company?.email ? { reply_to: company.email } : {}),
        subject: `Quotation ${quotation.quotation_no} — ${companyName}`,
        html,
        attachments: [
          {
            content: pdfBase64,
            filename,
            content_type: "application/pdf",
          },
        ],
      }),
    });

    const resendData = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      console.error("Resend email failed:", resendData);
      return NextResponse.json(
        { error: resendData?.message || resendData?.error || "Email provider rejected the message." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, id: resendData?.id || null, to: recipient });
  } catch (error) {
    console.error("Quotation email route failed:", error);
    return NextResponse.json({ error: "Could not send quotation email." }, { status: 500 });
  }
}
