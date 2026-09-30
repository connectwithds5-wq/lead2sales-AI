"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type EmailLeadSource = { id:string; inbound_address:string; enabled:boolean };

type LeadSource = {
  id: string;
  slug: string;
  public_token: string;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  enabled: boolean;
};

export default function LeadSources({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<LeadSource | null>(null);
  const [slug, setSlug] = useState("");
  const [wa, setWa] = useState("");
  const [msg, setMsg] = useState("Hi, I need a quotation.");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [emailSource, setEmailSource] = useState<EmailLeadSource|null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);

  async function load() {
    const cid = localStorage.getItem("lead2sales_company_id");
    if (!cid) {
      setError("Workspace not found. Please sign in again.");
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("lead_capture_sources")
      .select("id,slug,public_token,whatsapp_number,whatsapp_message,enabled")
      .eq("company_id", cid)
      .maybeSingle();

    const { data: emailData } = await supabase.from("email_lead_sources").select("id,inbound_address,enabled").eq("company_id", cid).maybeSingle();
    if (emailData) { setEmailSource(emailData as EmailLeadSource); setEmailEnabled(Boolean(emailData.enabled)); }

    if (loadError) {
      setError(loadError.message);
    } else if (data) {
      setSource(data as LeadSource);
      setSlug(data.slug || "");
      setWa(data.whatsapp_number || "");
      setMsg(data.whatsapp_message || "Hi, I need a quotation.");
      setEnabled(Boolean(data.enabled));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    const cid = localStorage.getItem("lead2sales_company_id");
    if (!cid) return;

    setSaving(true);
    setError("");

    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug) {
      setError("Please enter a valid source name.");
      setSaving(false);
      return;
    }

    const payload = {
      company_id: cid,
      slug: cleanSlug,
      whatsapp_number: wa.replace(/\D/g, ""),
      whatsapp_message: msg.trim() || "Hi, I need a quotation.",
      enabled,
    };

    const result = source
      ? await supabase
          .from("lead_capture_sources")
          .update({
            slug: payload.slug,
            whatsapp_number: payload.whatsapp_number,
            whatsapp_message: payload.whatsapp_message,
            enabled: payload.enabled,
          })
          .eq("id", source.id)
          .eq("company_id", cid)
      : await supabase
          .from("lead_capture_sources")
          .insert(payload)
          .select("id,slug,public_token,whatsapp_number,whatsapp_message,enabled")
          .single();

    if (result.error) {
      setError(result.error.message);
    } else {
      const nextSource = (result.data || source) as LeadSource;
      if (nextSource) {
        setSource(nextSource);
        setSlug(nextSource.slug);
        setWa(nextSource.whatsapp_number || "");
        setMsg(nextSource.whatsapp_message || "Hi, I need a quotation.");
        setEnabled(Boolean(nextSource.enabled));
      } else {
        await load();
      }
    }

    setSaving(false);
  }

  const token = source?.public_token || "";
  const url =
    typeof window !== "undefined" && token
      ? window.location.origin + "/lead/" + token
      : token
        ? "/lead/" + token
        : "Save this source to generate the secure public link.";

  async function saveEmailSource() {
    const cid = localStorage.getItem("lead2sales_company_id");
    if (!cid || !token) return;
    setEmailSaving(true);
    setError("");
    const domain = process.env.NEXT_PUBLIC_RESEND_INBOUND_DOMAIN || "";
    const suggested = emailSource?.inbound_address || (domain ? "leads-" + token.slice(0, 18) + "@" + domain : "");
    if (!suggested) { setError("Set NEXT_PUBLIC_RESEND_INBOUND_DOMAIN in Vercel first, or enter an inbound address."); setEmailSaving(false); return; }
    const result = emailSource
      ? await supabase.from("email_lead_sources").update({ inbound_address:suggested, enabled:emailEnabled, updated_at:new Date().toISOString() }).eq("id",emailSource.id).eq("company_id",cid).select("id,inbound_address,enabled").single()
      : await supabase.from("email_lead_sources").insert({company_id:cid,inbound_address:suggested,enabled:emailEnabled}).select("id,inbound_address,enabled").single();
    if (result.error) setError(result.error.message);
    else if (result.data) setEmailSource(result.data as EmailLeadSource);
    setEmailSaving(false);
  }

  function copyLink() {
    if (!token) return;
    void navigator.clipboard.writeText(url);
    alert("Secure enquiry link copied.");
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="catalogModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <div>
            <span className="eyebrow">LEAD CAPTURE</span>
            <h2>Lead Sources</h2>
            <p>One secure public link for website, QR code and social profiles.</p>
          </div>
          <button className="close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <div className="catalogForm">
            <label>
              Secure public enquiry URL
              <input value={url} readOnly />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="ghost" type="button" onClick={copyLink} disabled={!token}>
                Copy Link
              </button>
              <a className="ghost" href={token ? url : "#"} target="_blank" rel="noreferrer">
                Open Public Form
              </a>
            </div>

            <label>
              Source name / slug
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="website-enquiry" />
            </label>

            <label>
              WhatsApp number for this business
              <input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="9198XXXXXXXX" />
            </label>

            <label>
              WhatsApp prefilled message
              <input value={msg} onChange={(e) => setMsg(e.target.value)} />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 18 }}
              />
              Accept new public enquiries
            </label>

            {error && <div className="message">{error}</div>}


            <div className="masterHint" style={{ marginTop: 12 }}>
              <b>📧 Email → Automatic Lead</b><br />
              Forward customer enquiry emails to the inbound address below. Lead2Sales will create the lead, classify it, and generate the initial BOQ automatically.
            </div>
            <label>
              Lead2Sales inbound email
              <input value={emailSource?.inbound_address || (process.env.NEXT_PUBLIC_RESEND_INBOUND_DOMAIN ? "leads-" + token.slice(0,18) + "@" + process.env.NEXT_PUBLIC_RESEND_INBOUND_DOMAIN : "")} readOnly placeholder="Configure Resend inbound domain" />
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:10 }}>
              <input type="checkbox" checked={emailEnabled} onChange={e=>setEmailEnabled(e.target.checked)} style={{width:18}} />
              Create leads from incoming emails
            </label>
            <button className="ghost" type="button" onClick={saveEmailSource} disabled={emailSaving || !token}>
              {emailSaving ? "Saving…" : "Enable Email Lead Capture"}
            </button>
\n            <button className="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Lead Source"}
            </button>

            <div className="masterHint">
              <b>Email setup:</b><br /> Add a Resend inbound domain in Vercel as NEXT_PUBLIC_RESEND_INBOUND_DOMAIN, then create a Resend webhook for email.received pointing to /api/resend-inbound-email. Also add RESEND_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY in Vercel.\n            </div>\n\n            <div className="masterHint">\n              <b>Security:</b><br />
              The public URL contains a random source token, not your company ID. The token is generated by the database and cannot be reassigned through the dashboard. Every submitted lead is attached to the source's locked workspace.
            </div>

            <div className="masterHint">
              <b>Use this link on:</b><br />
              Website button · QR code · Instagram bio · Google Business · email signature · WhatsApp campaigns.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
