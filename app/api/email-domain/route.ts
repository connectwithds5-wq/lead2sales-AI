import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function auth(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { error: "Authentication required.", status: 401 as const };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const apiKey = process.env.RESEND_API_KEY;
  if (!supabaseUrl || !supabaseKey || !apiKey) return { error: "Email service is not configured.", status: 500 as const };
  const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: "Your session has expired. Please sign in again.", status: 401 as const };
  return { supabase, apiKey };
}

async function resend(path: string, apiKey: string, init?: RequestInit) {
  return fetch("https://api.resend.com" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const a = await auth(request);
    if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
    const response = await resend("/domains", a.apiKey);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || "Could not load sending domains." }, { status: 502 });
    return NextResponse.json({ ok: true, domains: data?.data || [] });
  } catch (error) {
    console.error("Email domain list failed:", error);
    return NextResponse.json({ error: "Could not load sending domains." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const a = await auth(request);
    if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "create");
    const domain = String(body?.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (action === "create") {
      if (!domain || !domain.includes(".") || domain.includes("@")) return NextResponse.json({ error: "Enter a valid business domain, such as example.com." }, { status: 400 });
      if (["gmail.com","googlemail.com","outlook.com","hotmail.com","live.com","yahoo.com","icloud.com"].includes(domain)) {
        return NextResponse.json({ error: "Public mailbox domains cannot be verified for sending. Use a domain your business controls, such as yourcompany.com." }, { status: 400 });
      }
      const response = await resend("/domains", a.apiKey, { method: "POST", body: JSON.stringify({ name: domain }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json({ error: data?.message || "Could not add the domain." }, { status: 502 });
      return NextResponse.json({ ok: true, domain: data });
    }
    if (action === "verify") {
      const id = String(body?.id || "");
      if (!id) return NextResponse.json({ error: "Domain ID is required." }, { status: 400 });
      const response = await resend("/domains/" + encodeURIComponent(id) + "/verify", a.apiKey, { method: "POST", body: JSON.stringify({}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json({ error: data?.message || "Domain verification failed." }, { status: 502 });
      return NextResponse.json({ ok: true, domain: data });
    }
    return NextResponse.json({ error: "Unsupported domain action." }, { status: 400 });
  } catch (error) {
    console.error("Email domain action failed:", error);
    return NextResponse.json({ error: "Could not update sending domain." }, { status: 500 });
  }
}
