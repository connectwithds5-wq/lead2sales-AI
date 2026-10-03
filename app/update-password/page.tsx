"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UpdatePassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated successfully. Redirecting to login…");
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/login"), 1200);
    }
    setLoading(false);
  }

  return <main className="authShell"><div className="authCard">
    <div className="brand"><div className="brandMark">L2</div><div><strong>Lead2Sales</strong><span>AI SALES ENGINE</span></div></div>
    <span className="eyebrow">NEW PASSWORD</span>
    <h1>Set a new password</h1>
    <p className="authSub">Choose a new password for your Lead2Sales account.</p>
    {!ready ? (
      <div className="message">Open this page using the password reset link from your email. If the link has expired, request a new one.</div>
    ) : (
      <form onSubmit={submit}>
        <label>New Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 6 characters" minLength={6} required /></label>
        <label>Confirm Password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" minLength={6} required /></label>
        {error&&<div className="message">{error}</div>}
        {message&&<div className="message">{message}</div>}
        <button className="primary full" disabled={loading}>{loading?"Updating…":"Update password"}</button>
      </form>
    )}
    <Link className="switch" href="/login">← Back to sign in</Link>
  </div></main>;
}
