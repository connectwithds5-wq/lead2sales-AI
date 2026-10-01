import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ quoteId: string }> }
) {
  try {
    const quoteId = String((await context.params)?.quoteId || "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!quoteId || !supabaseUrl || !serviceKey) {
      return new NextResponse("Quotation link is unavailable.", { status: 404 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: quote, error } = await admin
      .from("quotations")
      .select("id,company_id,quotation_no")
      .eq("id", quoteId)
      .single();

    if (error || !quote) {
      return new NextResponse("Quotation not found.", { status: 404 });
    }

    const filename = `Quotation-${String(quote.quotation_no).replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
    const path = `${quote.company_id}/${quote.id}/${filename}`;

    const { data: signed, error: signedError } = await admin
      .storage
      .from("quotation-pdfs")
      .createSignedUrl(path, 7 * 24 * 60 * 60);

    if (signedError || !signed?.signedUrl) {
      return new NextResponse("Quotation PDF is unavailable.", { status: 404 });
    }

    return NextResponse.redirect(signed.signedUrl, 302);
  } catch {
    return new NextResponse("Quotation link is unavailable.", { status: 500 });
  }
}
