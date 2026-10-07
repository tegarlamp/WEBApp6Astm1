import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Hexagon, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/khtt";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate(from, { replace: true });
  }, [loading, isAuthenticated, from, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Username atau password salah.";
      setError(String(msg));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10" data-testid="login-page">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "46px 46px" }}
        />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Brand — clickable, returns to landing/home */}
        <div className="mb-8 flex flex-col items-center text-center">
          <button
            type="button"
            data-testid="login-brand-home"
            onClick={() => navigate("/")}
            aria-label="Kembali ke Beranda"
            className="group flex flex-col items-center rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500 shadow-lg shadow-cyan-500/20 transition-transform duration-200 group-hover:scale-105">
              <Hexagon className="h-8 w-8 text-zinc-950" strokeWidth={2.5} />
            </div>
            <h1 className="font-heading mt-4 text-xl font-bold leading-snug tracking-tight text-zinc-50 transition-colors group-hover:text-cyan-300">Laboratorium Product Development</h1>
          </button>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Internal Access
          </p>
        </div>

        {/* Card */}
        <form onSubmit={onSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl backdrop-blur" data-testid="login-form">
          <h2 className="font-heading text-lg font-semibold text-zinc-50">Masuk ke akun</h2>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">Gunakan kredensial admin untuk melanjutkan.</p>

          {error && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2.5 font-mono text-[12px] text-red-300" data-testid="login-error" role="alert">
              {error}
            </div>
          )}

          <label className="mt-5 block">
            <span className="font-mono text-[11px] tracking-wider text-zinc-400">USERNAME</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 focus-within:border-cyan-500">
              <User className="h-4 w-4 text-zinc-500" />
              <input
                data-testid="login-username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="h-11 flex-1 bg-transparent font-mono text-sm text-zinc-50 outline-none placeholder:text-zinc-600"
              />
            </div>
          </label>

          <label className="mt-4 block">
            <span className="font-mono text-[11px] tracking-wider text-zinc-400">PASSWORD</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 focus-within:border-cyan-500">
              <Lock className="h-4 w-4 text-zinc-500" />
              <input
                data-testid="login-password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 flex-1 bg-transparent font-mono text-sm text-zinc-50 outline-none placeholder:text-zinc-600"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} data-testid="login-toggle-password" className="text-zinc-500 hover:text-zinc-300" aria-label="Toggle password visibility">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            data-testid="login-submit"
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-500 font-mono text-sm font-bold tracking-widest text-zinc-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> MASUK…</> : "MASUK"}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] tracking-wider text-zinc-600">
          © 2026 Laboratorium Product Development · Authorized personnel only
        </p>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            data-testid="login-back-home"
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-zinc-500 transition-colors hover:text-cyan-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Beranda
          </button>
        </div>
      </div>
    </div>
  );
}
