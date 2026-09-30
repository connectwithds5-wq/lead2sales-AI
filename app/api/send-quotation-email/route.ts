import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    if (!apiKey || !from) {
      return NextResponse.json(
        { error: "Email service is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel." },
        { status: 500 }
      );
    }
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
