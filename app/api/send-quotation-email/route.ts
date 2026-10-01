import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import PDFDocument from "pdfkit";
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

    if (!quoteId) {
      return NextResponse.json({ error: "Quotation is required." }, { status: 400 });
    }


    const { data: quotation, error: quoteError } = await supabase
      .from("quotations")
      .select("id, quotation_no, grand_total, subtotal, gst_percent, gst_amount, company_id, lead_id, leads(name,email,company_name)")
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

    const { data: quotationItems, error: itemError } = await supabase
      .from("quotation_items")
      .select("item_name,specification,quantity,unit,unit_price")
      .eq("quotation_id", quotation.id)
      .order("created_at", { ascending: true });

    if (itemError) {
      return NextResponse.json({ error: "Could not load quotation items." }, { status: 500 });
    }

    // Generate the attachment on the server. This avoids browser canvas/print
    // rendering entirely, which can produce a blank PDF in some browsers.
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 42 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const companyName = company?.legal_name || company?.name || "Lead2Sales";
      const customerName = lead?.name || "Customer";
      const money = (value: number) => "INR " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);

      doc.fontSize(20).font("Helvetica-Bold").text(companyName);
      doc.fontSize(9).font("Helvetica").fillColor("#666").text("QUOTATION");
      doc.moveDown(0.7);
      doc.fillColor("#111").fontSize(12).font("Helvetica-Bold").text("Quotation No: " + quotation.quotation_no);
      doc.fontSize(10).font("Helvetica").text("Date: " + new Date().toLocaleDateString("en-IN"));
      doc.moveDown(0.8);

      doc.fontSize(11).font("Helvetica-Bold").text("Customer");
      doc.fontSize(10).font("Helvetica").text(customerName);
      if (lead?.company_name) doc.text(String(lead.company_name));
      if (recipient) doc.text(recipient);
      if (company?.phone) doc.text(String(company.phone));
      if (company?.address) doc.text(String(company.address));
      doc.moveDown(1);

      const tableX = 42;
      const col = [250, 130, 45, 65, 75];
      const headers = ["Item / Specification", "Specification", "Qty", "Unit", "Amount"];
      let y = doc.y;
      const rowH = 30;

      const drawHeader = () => {
        doc.save().fillColor("#111").rect(tableX, y, col.reduce((a,b)=>a+b,0), rowH).fill().restore();
        let x = tableX;
        headers.forEach((h,i) => {
          doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8).text(h, x+5, y+10, { width: col[i]-10 });
          x += col[i];
        });
        y += rowH;
      };
      const drawRow = (item: any) => {
        if (y > 735) { doc.addPage(); y = 42; drawHeader(); }
        const amount = Number(item.quantity || 0) * Number(item.unit_price || 0);
        const text = String(item.item_name || "") + (item.specification ? "\n" + String(item.specification) : "");
        let x = tableX;
        [text, String(item.specification || ""), String(item.quantity || 0), String(item.unit || "Nos"), money(amount)].forEach((v,i) => {
          doc.fillColor("#111").font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
            .text(v, x+5, y+7, { width: col[i]-10, height: rowH-8, ellipsis: true });
          x += col[i];
        });
        doc.strokeColor("#ccc").moveTo(tableX, y+rowH).lineTo(tableX+col.reduce((a,b)=>a+b,0), y+rowH).stroke();
        y += rowH;
      };

      drawHeader();
      (quotationItems || []).forEach(drawRow);

      y += 15;
      const subtotal = Number(quotation.subtotal || 0);
      const gstAmount = Number(quotation.gst_amount || 0);
      const total = Number(quotation.grand_total || 0);
      doc.font("Helvetica").fontSize(10).fillColor("#111");
      doc.text("Subtotal: " + money(subtotal), 390, y, { width: 160, align: "right" });
      y += 17;
      doc.text("GST (" + Number(quotation.gst_percent || 0) + "%): " + money(gstAmount), 390, y, { width: 160, align: "right" });
      y += 22;
      doc.font("Helvetica-Bold").fontSize(13).text("Grand Total: " + money(total), 340, y, { width: 210, align: "right" });
      y += 45;
      doc.font("Helvetica").fontSize(8).fillColor("#666").text("Generated by Lead2Sales", 42, y);
      doc.end();
    });

    const generatedPdfBase64 = pdfBuffer.toString("base64");
    const finalPdfBase64 = generatedPdfBase64;
    const finalFilename = filename || ("Quotation-" + quotation.quotation_no + ".pdf");

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
    let gmailConnected = false;
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: gmail } = await admin.from("email_connections").select("id,email_address,access_token_encrypted,refresh_token_encrypted,expires_at,enabled").eq("company_id",quotation.company_id).eq("provider","google").eq("enabled",true).maybeSingle();
      if (gmail) {
        gmailConnected = true;
        try {
          if (!gmail.refresh_token_encrypted && !gmail.access_token_encrypted) throw new Error("Gmail connection is incomplete. Please reconnect Gmail in Company Profile.");
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
          const mime=[`From: ${mimeHeader(companyName)} <${gmail.email_address}>`,`To: ${recipient}`,`Subject: ${mimeHeader(`Quotation ${quotation.quotation_no} — ${companyName}`)}`,"MIME-Version: 1.0",`Content-Type: multipart/mixed; boundary="${boundary}"`,"",`--${boundary}`,"Content-Type: text/html; charset=UTF-8","Content-Transfer-Encoding: 8bit","",html,"",`--${boundary}`,"Content-Type: application/pdf; name="+finalFilename,"Content-Disposition: attachment; finalFilename="+finalFilename,"Content-Transfer-Encoding: base64","",finalPdfBase64.match(/.{1,76}/g)?.join("\r\n")||finalPdfBase64,"",`--${boundary}--`].join("\r\n");
          const gr=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({raw:base64Url(mime)})});
          const gd=await gr.json().catch(()=>({}));
          if(!gr.ok) throw new Error(gd?.error?.message||"Gmail rejected the message.");
          return NextResponse.json({ok:true,id:gd?.id||null,to:recipient,provider:"gmail"});
        } catch(e) {
          console.error("Gmail send failed:",e);
          return NextResponse.json({ error: e instanceof Error ? e.message : "Gmail could not send the quotation. Please reconnect Gmail." }, { status: 502 });
        }
      }
    }

    if (gmailConnected) {
      return NextResponse.json({ error: "Gmail is connected but could not send the quotation. Please reconnect Gmail in Company Profile." }, { status: 502 });
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
            content: finalPdfBase64,
            finalFilename,
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
