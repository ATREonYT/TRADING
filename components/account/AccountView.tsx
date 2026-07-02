"use client";

import { useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { signIn, signUp, signOut, resetPaper, STARTING_CASH, cloudEnabled } from "@/lib/accounts";
import { usd } from "@/lib/format";
import { Wallet } from "@/components/icons";

export function AccountView() {
  const { user, ready } = useAccount();
  if (!ready) return <div className="px-6 py-20 text-center text-sm text-faint">Loading…</div>;
  return (
    <div className="mx-auto max-w-[560px] px-4 py-10 lg:px-6">
      {user ? <Profile /> : <AuthForms />}
      {cloudEnabled ? (
        <p className="mt-6 rounded-lg border border-border bg-surface/50 px-3 py-2 text-2xs leading-relaxed text-faint">
          <span className="font-semibold text-up">Cloud account.</span> Your login and paper portfolio
          are stored securely and sync to any device you sign in from.
        </p>
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-surface/50 px-3 py-2 text-2xs leading-relaxed text-faint">
          <span className="font-semibold text-muted">Device-local account.</span> Helix has no server —
          your account and paper portfolio are stored only in this browser (password salted &amp; hashed,
          never sent anywhere). Clearing site data deletes the account.
        </p>
      )}
    </div>
  );
}

function AuthForms() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

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
      setNotice("Almost there — check your email for a confirmation link, then sign in here.");
      setMode("signin");
    }
  };

  return (
    <div className="glossy animate-rise rounded-2xl p-6">
      {/* tabs */}
      <div className="mb-5 grid grid-cols-2 rounded-lg border border-border bg-base p-1">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
              setNotice("");
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-primary text-white" : "text-muted hover:text-ink"
            }`}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <h1 className="text-lg font-bold text-ink">
        {mode === "signup" ? "Start paper trading" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "signup"
          ? `Free practice account with ${usd(STARTING_CASH)} of virtual cash.`
          : "Sign in to your practice account on this device."}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        {mode === "signup" && (
          <Field label="Name" value={name} onChange={setName} placeholder="Alex Trader" autoComplete="name" />
        )}
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder={mode === "signup" ? "6+ characters" : "••••••••"}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />

        {error && (
          <p className="animate-fade-up rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}
        {notice && (
          <p className="animate-fade-up rounded-lg border border-up/40 bg-up/10 px-3 py-2 text-xs text-up">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? "One moment…" : mode === "signup" ? `Create account · get ${usd(STARTING_CASH)}` : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function Profile() {
  const { user } = useAccount();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!user) return null;

  const positions = Object.keys(user.paper.positions).length;

  return (
    <div className="glossy animate-rise rounded-2xl p-6">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-deep font-mono text-lg font-bold text-white">
          {user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink">{user.name}</h1>
          <p className="text-sm text-muted">{user.email}</p>
          <p className="text-2xs text-faint">
            Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/60 bg-base/40 p-3">
          <div className="text-2xs uppercase tracking-wide text-faint">Paper cash</div>
          <div className="tnum font-mono text-lg font-bold text-ink">{usd(user.paper.cash)}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-base/40 p-3">
          <div className="text-2xs uppercase tracking-wide text-faint">Open positions</div>
          <div className="tnum font-mono text-lg font-bold text-ink">{positions}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href="/paper"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02]"
        >
          <Wallet size={15} />
          Open paper portfolio
        </a>
        {confirmReset ? (
          <span className="flex items-center gap-2">
            <button
              onClick={() => {
                resetPaper();
                setConfirmReset(false);
              }}
              className="rounded-lg bg-down px-3 py-2.5 text-sm font-semibold text-white"
            >
              Yes, wipe it
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="rounded-lg border border-border px-3 py-2.5 text-sm text-muted hover:text-ink"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-warn/50 hover:text-warn"
          >
            Reset paper account
          </button>
        )}
        <button
          onClick={signOut}
          className="ml-auto rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-faint">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-border bg-base px-3 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-primary/60 focus:outline-none"
      />
    </label>
  );
}
