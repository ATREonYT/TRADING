"use client";

/**
 * Account section for the Profile page: register / sign in / sign out.
 * Guests lose nothing by staying guests — an account makes the identity
 * server-verified (no impersonation) and portable across devices, and the
 * server-side social graph (connections, chats, stands) follows it.
 */

import { useEffect, useState } from "react";
import { getAuth, login, logout, register } from "@/lib/auth";
import { makeGuestId } from "@/lib/store";

export default function AccountCard({
  onIdentity,
  currentName,
}: {
  /** Called with the new identity after sign-in/out (wires store.setIdentity). */
  onIdentity: (id: string, name: string) => void;
  currentName: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // re-render after auth changes

  useEffect(() => {
    setMounted(true);
    setName(currentName);
  }, [currentName]);

  const auth = mounted ? getAuth() : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const fn = mode === "register" ? register : login;
    const result = await fn(name.trim(), password);
    setBusy(false);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setPassword("");
    onIdentity(result.id, result.name);
    setTick((t) => t + 1);
  };

  const signOut = async () => {
    await logout();
    // fresh guest id — the account's social graph stays on the server
    onIdentity(makeGuestId(), currentName);
    setTick((t) => t + 1);
  };

  void tick;

  if (!mounted) return null;

  if (auth) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Signed in as <span className="font-medium">{auth.name}</span>
          <span className="micro ml-2 rounded-sm border border-verify/40 px-1.5 py-0.5 text-verify">
            verified identity
          </span>
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Nobody can impersonate you on the floors, and your connections and
          chats follow this account on any device. Quests, badges and your
          booth design still live in each browser.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="btn-press w-fit rounded-md border border-line px-3 py-2 text-sm text-muted hover:border-ink hover:text-ink"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted">
        You&rsquo;re a guest — everything works, but your identity lives in
        this browser and anyone could use your name. An account pins it down
        and carries your connections across devices.
      </p>
      <div className="flex gap-1.5">
        {(["register", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            aria-pressed={mode === m}
            className={`micro rounded-sm border px-2 py-1 ${
              mode === m
                ? "border-accent text-accent"
                : "border-line text-muted hover:border-muted"
            }`}
          >
            {m === "register" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="acct-name" className="micro mb-1.5 block text-muted">
            Name
          </label>
          <input
            id="acct-name"
            type="text"
            value={name}
            minLength={3}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            className="w-44 rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="acct-pass" className="micro mb-1.5 block text-muted">
            Password
          </label>
          <input
            id="acct-pass"
            type="password"
            value={password}
            minLength={6}
            maxLength={72}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="w-44 rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy || name.trim().length < 3 || password.length < 6}
          className="btn-press rounded-md bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "…" : mode === "register" ? "Create account" : "Sign in"}
        </button>
      </form>
      {error && <p className="text-sm text-accent">{error}</p>}
      <p className="text-xs text-muted">
        No email needed. Passwords are salted and hashed on the floor server.
      </p>
    </div>
  );
}
