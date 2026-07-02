"use client";

import { useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { signIn, signUp, signOut, resetPaper, STARTING_CASH, cloudEnabled } from "@/lib/accounts";
import { Aurora } from "@/components/landing/Aurora";
import { usd } from "@/lib/format";
import { Wallet, Person, Mail, Lock, Eye, EyeOff, Zap } from "@/components/icons";

export function AccountView() {
  const { user, ready } = useAccount();

  return (
    <div className="relative overflow-hidden">
      {/* branded backdrop */}
      <div className="hero-mesh absolute inset-0 -z-20 animate-gradient-pan opacity-80" />
      <Aurora className="-z-10 opacity-50" />
      <div className="grid-overlay absolute inset-0 -z-10 opacity-40" />

      <div className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-[440px] flex-col justify-center px-4 py-12">
        {!ready ? (
          <div className="py-20 text-center text-sm text-faint">Loading…</div>
        ) : user ? (
          <Profile />
        ) : (
          <AuthForms />
        )}

        <p className="mt-5 text-center text-2xs leading-relaxed text-faint">
          {cloudEnabled ? (
            <>Secure cloud account — your login and paper portfolio sync to any device.</>
          ) : (
            <>Device-local account — stored only in this browser, password hashed, never sent anywhere.</>
          )}
        </p>
      </div>
    </div>
  );
}

function AuthForms() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (m: "signup" | "signin") => {
    setMode(m);
    setError("");
    setNotice("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const res =
      mode === "signup" ? await signUp(name, email, password) : await signIn(email, password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Something went wrong.");
    else if ("needsConfirm" in res && res.needsConfirm) {
      setNotice("Almost there — check your email for a confirmation link, then sign in.");
      setMode("signin");
    }
  };

  return (
    <div className="glossy animate-rise rounded-3xl p-7 sm:p-8">
      {/* brand */}
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-deep shadow-glow">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 16c3-1 4-9 7-9s2 6 5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="5" cy="16" r="1.6" fill="#22D3EE" />
          </svg>
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-ink">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "signup"
            ? `Start paper trading with ${usd(STARTING_CASH)} of virtual cash.`
            : "Sign in to your paper-trading account."}
        </p>
      </div>

      {/* sliding tab switcher */}
      <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-border bg-base/70 p-1" role="tablist">
        <span
          aria-hidden="true"
          className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-primary shadow-glow transition-transform duration-300 ease-out ${
            mode === "signup" ? "translate-x-0" : "translate-x-[calc(100%+4px)]"
          }`}
          style={{ left: 4 }}
        />
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`relative z-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300 ${
              mode === m ? "text-white" : "text-muted hover:text-ink"
            }`}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      {/* form — keyed so mode switches crossfade smoothly */}
      <form key={mode} onSubmit={submit} className="animate-fade-up space-y-3.5">
        {mode === "signup" && (
          <Field icon={<Person size={15} />} label="Full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Trader"
              autoComplete="name"
              required
              className="peer w-full rounded-xl border border-border bg-base/70 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-faint transition-all duration-200 focus:border-primary/60 focus:shadow-glow focus:outline-none"
            />
          </Field>
        )}
        <Field icon={<Mail size={15} />} label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="peer w-full rounded-xl border border-border bg-base/70 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-faint transition-all duration-200 focus:border-primary/60 focus:shadow-glow focus:outline-none"
          />
        </Field>
        <Field icon={<Lock size={15} />} label="Password">
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "6+ characters" : "••••••••"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            className="peer w-full rounded-xl border border-border bg-base/70 py-2.5 pl-10 pr-11 text-sm text-ink placeholder:text-faint transition-all duration-200 focus:border-primary/60 focus:shadow-glow focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            aria-label={showPass ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-ink"
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </Field>

        {error && (
          <p className="animate-fade-up rounded-xl border border-down/40 bg-down/10 px-3 py-2.5 text-xs text-down">
            {error}
          </p>
        )}
        {notice && (
          <p className="animate-fade-up rounded-xl border border-up/40 bg-up/10 px-3 py-2.5 text-xs text-up">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-300 hover:brightness-110 disabled:opacity-60"
        >
          <span className="flex items-center justify-center gap-2">
            {busy && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </span>
        </button>
      </form>

      {/* benefits */}
      <ul className="mt-6 grid grid-cols-3 gap-2 border-t border-border/60 pt-5 text-center">
        {[
          { icon: <Wallet size={14} />, text: `${usd(STARTING_CASH)} virtual` },
          { icon: <Zap size={14} />, text: "Live prices" },
          { icon: <Person size={14} />, text: cloudEnabled ? "Any device" : "Private" },
        ].map((b, i) => (
          <li key={i} className="flex flex-col items-center gap-1.5 text-2xs text-muted">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-accent ring-1 ring-border">
              {b.icon}
            </span>
            {b.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-2xs font-semibold uppercase tracking-wide text-faint">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint transition-colors peer-focus:text-primary">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

function Profile() {
  const { user } = useAccount();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!user) return null;

  const positions = Object.keys(user.paper.positions).length;

  return (
    <div className="glossy animate-rise rounded-3xl p-7 sm:p-8">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-deep font-mono text-xl font-bold text-white shadow-glow ring-2 ring-primary/30">
          {user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink">{user.name}</h1>
          <p className="text-sm text-muted">{user.email}</p>
          <p className="mt-0.5 text-2xs text-faint">
            Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            {cloudEnabled && <span className="ml-1.5 rounded bg-up/15 px-1.5 py-0.5 font-semibold text-up">Cloud</span>}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border/60 bg-base/40 p-3.5">
          <div className="text-2xs uppercase tracking-wide text-faint">Paper cash</div>
          <div className="tnum mt-0.5 font-mono text-lg font-bold text-ink">{usd(user.paper.cash)}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-base/40 p-3.5">
          <div className="text-2xs uppercase tracking-wide text-faint">Open positions</div>
          <div className="tnum mt-0.5 font-mono text-lg font-bold text-ink">{positions}</div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <a
          href="/paper"
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-300 hover:brightness-110"
        >
          <Wallet size={15} />
          Open paper portfolio
        </a>
        <div className="flex gap-2.5">
          {confirmReset ? (
            <>
              <button
                onClick={() => {
                  resetPaper();
                  setConfirmReset(false);
                }}
                className="flex-1 rounded-xl bg-down px-3 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
              >
                Yes, wipe it
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm text-muted transition-colors hover:text-ink"
              >
                Keep
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmReset(true)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-warn/50 hover:text-warn"
              >
                Reset paper account
              </button>
              <button
                onClick={() => void signOut()}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-ink"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
