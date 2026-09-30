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
  const [emailAddress, setEmailAddress] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailProvisioning, setEmailProvisioning] = useState(false);
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
    if (emailData) {
      setEmailSource(emailData as EmailLeadSource);
      setEmailAddress(emailData.inbound_address || "");
      setEmailEnabled(Boolean(emailData.enabled));
    }

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
    if (!cid) return;
    setEmailProvisioning(true);
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Session expired. Please sign in again.");
      setEmailProvisioning(false);
      return;
    }
    const response = await fetch("/api/email-lead-source", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: cid, enabled: emailEnabled }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error || "Could not provision email lead capture.");
    else if (result.source) {
      setEmailSource(result.source as EmailLeadSource);
      setEmailAddress(result.source.inbound_address);
      setEmailEnabled(Boolean(result.source.enabled));
    }
    setEmailProvisioning(false);
  }

  async function connectMailbox(provider:"google"|"microsoft"){
    const cid=localStorage.getItem("lead2sales_company_id");
    if(!cid)return;
    setError("");
    const {data}=await supabase.auth.getSession();
    const token=data.session?.access_token;
    if(!token){setError("Session expired. Please sign in again.");return;}
    const r=await fetch("/api/email-connect/"+provider,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({companyId:cid})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setError(j.error||"Could not start email connection.");return;}
    window.location.href=j.url;
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
              Connect the business mailbox once. Lead2Sales will watch new incoming mail and turn relevant enquiries into leads, categories and initial BOQs.
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="ghost" type="button" onClick={()=>void connectMailbox("google")}>Connect Gmail</button>
              <button className="ghost" type="button" onClick={()=>void connectMailbox("microsoft")}>Connect Outlook / Microsoft 365</button>
            </div>
            <label>
              Your Lead2Sales inbound email
              <input value={emailAddress || "Click Enable to generate your address"} readOnly />
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:10 }}>
              <input type="checkbox" checked={emailEnabled} onChange={e=>setEmailEnabled(e.target.checked)} style={{width:18}} />
              Create leads from incoming emails
            </label>
            <button className="ghost" type="button" onClick={saveEmailSource} disabled={emailProvisioning}>
              {emailProvisioning ? "Creating…" : emailAddress ? "Update Email Lead Capture" : "Enable Email Lead Capture"}
            </button>

            <button className="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Lead Source"}
            </button>

            <div className="masterHint">
              <b>Security:</b><br />
              Customers never see or enter Resend API keys, Supabase service keys, or webhook secrets. Those stay on Lead2Sales infrastructure. Each workspace gets its own receiving address and incoming emails are locked to that workspace.
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
