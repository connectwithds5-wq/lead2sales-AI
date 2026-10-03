"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://lead2sales-ai.vercel.app").replace(/\/$/, "");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: siteUrl + "/update-password",
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder.");
    }
    setLoading(false);
  }

  return <main className="authShell"><div className="authCard">
    <div className="brand"><div className="brandMark">L2</div><div><strong>Lead2Sales</strong><span>AI SALES ENGINE</span></div></div>
    <span className="eyebrow">PASSWORD RECOVERY</span>
    <h1>Forgot your password?</h1>
    <p className="authSub">Enter your account email and we'll send you a secure link to create a new password.</p>
    <form onSubmit={submit}>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required /></label>
      {message&&<div className="message">{message}</div>}
      {error&&<div className="message">{error}</div>}
      <button className="primary full" disabled={loading}>{loading?"Sending…":"Send reset link"}</button>
    </form>
    <Link className="switch" href="/login">← Back to sign in</Link>
  </div></main>;
}
