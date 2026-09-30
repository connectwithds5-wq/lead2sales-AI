import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { recommendRequirement } from "../../../../lib/recommendations";

export const runtime = "nodejs";

function classify(text: string) {
  const s = text.toLowerCase();
  if (/cctv|camera|surveillance|nvr|dvr/.test(s)) return "CCTV";
  if (/access control|door access|biometric|attendance|boom barrier/.test(s)) return "Access Control";
  if (/fire alarm|smoke detector|heat detector/.test(s)) return "Fire Alarm";
  if (/wifi|wi-fi|wireless|access point/.test(s)) return "Wi-Fi";
  if (/firewall|router|switch|lan|network|cat6|fiber|networking/.test(s)) return "Networking";
  if (/server|storage|nas|san|backup/.test(s)) return "Server & Storage";
  if (/solar|inverter|panel/.test(s)) return "Solar";
  if (/intercom|ip phone|telephone/.test(s)) return "Communication";
  return "Other";
}

function extractEmail(value: string) {
  const m = value.match(/<([^>]+)>/) || value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? (m[1] || m[0]).trim().toLowerCase() : "";
}

function extractName(value: string, email: string) {
  const m = value.match(/^"?([^"<]+?)"?\s*</);
  if (m?.[1]) return m[1].trim();
  return email ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, x => x.toUpperCase()) : "Email Enquiry";
}

function extractPhone(text: string) {
  const m = text.match(/(?:\+?91[\s.-]?)?[6-9]\d{9}\b/);
  return m ? m[0].replace(/[^\d+]/g, "") : "";
}

function extractValue(text: string) {
  const m = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!resendKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Email receiving is not configured." }, { status: 500 });
  }

  const payload = await req.text();
  const resend = new Resend(resendKey);

  let event: any;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") || "",
        timestamp: req.headers.get("svix-timestamp") || "",
        signature: req.headers.get("svix-signature") || "",
      },
      webhookSecret,
    });
  } catch {
    return new NextResponse("Invalid webhook signature", { status: 400 });
  }

  if (event?.type !== "email.received") return NextResponse.json({ ok: true });

  const emailId = event?.data?.email_id;
  const recipient = String(event?.data?.to?.[0] || "").toLowerCase();
  if (!emailId || !recipient) return NextResponse.json({ ok: true });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: source } = await admin.from("email_lead_sources").select("id,company_id,enabled,inbound_address").eq("inbound_address", recipient).maybeSingle();
  if (!source?.enabled) return NextResponse.json({ ok: true });

  const { data: existing } = await admin.from("email_lead_events").select("id,lead_id").eq("email_id", emailId).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  const received = await resend.emails.receiving.get(emailId);
  if (received.error || !received.data) {
    return NextResponse.json({ error: received.error?.message || "Could not retrieve received email." }, { status: 500 });
  }

  const detail: any = received.data;
  const fromRaw = String(detail.from || event.data.from || "");
  const senderEmail = extractEmail(fromRaw);
  const name = extractName(fromRaw, senderEmail);
  const subject = String(detail.subject || event.data.subject || "").trim();
  const body = String(detail.text || detail.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const requirement = [subject, body].filter(Boolean).join(" — ").slice(0, 10000);
  const phone = extractPhone(requirement);
  const estimatedValue = extractValue(requirement);
  const leadCategory = classify(requirement);
  const leadId = crypto.randomUUID();

  const { error: leadError } = await admin.from("leads").insert({
    id: leadId,
    company_id: source.company_id,
    name,
    company_name: null,
    phone: phone || null,
    email: senderEmail || null,
    requirement,
    status: "new",
    estimated_value: estimatedValue,
    source: "email",
    lead_category: leadCategory,
  });
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });

  const recs = recommendRequirement(requirement);
  if (recs.length) {
    const { data: catalog } = await admin.from("product_catalog").select("*").eq("company_id", source.company_id).eq("active", true);
    const boq = recs.map((x: any) => {
      const matches = (catalog || []).filter((p: any) => p.category === x.category && (!x.subcategory || !p.subcategory || p.subcategory === x.subcategory));
      const priced = matches.filter((p: any) => Number(p.selling_price || 0) > 0);
      const pool = priced.length ? priced : matches;
      const match = pool.find((p: any) => String(p.name).toLowerCase().includes(String(x.item_name).toLowerCase().replace("ip ", ""))) || pool[0];
      const { reason, review_required, ...boqItem } = x;
      return {
        id: crypto.randomUUID(),
        ...boqItem,
        company_id: source.company_id,
        lead_id: leadId,
        unit_price: match ? Number(match.selling_price || 0) : 0,
        notes: review_required ? "MANUAL REVIEW REQUIRED: " + reason : reason,
      };
    });
    await admin.from("lead_boq_items").insert(boq);
  }

  await admin.from("email_lead_events").insert({
    company_id: source.company_id,
    email_id: emailId,
    message_id: event?.data?.message_id || detail.message_id || null,
    from_email: senderEmail || null,
    subject: subject || null,
    received_at: detail.created_at || new Date().toISOString(),
    lead_id: leadId,
  });

  return NextResponse.json({ ok: true, lead_id: leadId, category: leadCategory });
}
