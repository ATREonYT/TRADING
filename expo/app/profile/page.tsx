"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/lib/store";
import { RANKS, rankFor } from "@/lib/ranks";
import { FLOORS } from "@/lib/data/floors";
import { TIER_ORDER, type GlyphId, type Startup, type SubTier } from "@/lib/types";
import AvatarPicker from "@/components/AvatarPicker";
import RankBadge from "@/components/RankBadge";
import PixelGlyph, { GLYPH_IDS } from "@/components/PixelGlyph";
import { TIER_LABEL, TIER_PRICE } from "@/components/TierTag";
import Toast, { type ToastData } from "@/components/Toast";

const SWATCHES: string[] = [
  "#8C3B2E",
  "#4E6E4E",
  "#3B5B92",
  "#6B4E71",
  "#2F6F6A",
  "#A98C5B",
  "#555049",
  "#B08D2E",
];

const TIER_BLURB: Record<SubTier, string> = {
  free: "The public floors. Plenty to see.",
  pro: "Everything in Free, plus the quieter floors.",
  founder: "Every floor, velvet rope included.",
};

interface BoothForm {
  name: string;
  oneLiner: string;
  pitch: string;
  category: string;
  goal: string;
  seekingCofounder: boolean;
  carpet: string;
  banner: string;
  sign: string;
  glyph: GlyphId;
}

const EMPTY_FORM: BoothForm = {
  name: "",
  oneLiner: "",
  pitch: "",
  category: "",
  goal: "",
  seekingCofounder: false,
  carpet: SWATCHES[1],
  banner: SWATCHES[0],
  sign: "",
  glyph: "bolt",
};

function formFrom(s: Startup): BoothForm {
  return {
    name: s.name,
    oneLiner: s.oneLiner,
    pitch: s.pitch,
    category: s.category,
    goal: s.goal,
    seekingCofounder: s.seekingCofounder,
    carpet: s.booth.carpet,
    banner: s.booth.banner,
    sign: s.booth.sign,
    glyph: s.booth.glyph,
  };
}

function relativeTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="panel p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ColorRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (c: string) => void;
}) {
  return (
    <div>
      <span className="micro mb-1.5 block text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            aria-label={`${label} color ${c}`}
            aria-pressed={value === c}
            className={`h-6 w-6 rounded-sm border ${
              value === c
                ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-panel"
                : "border-line hover:border-muted"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [state, actions] = useAppState();
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<BoothForm>(EMPTY_FORM);
  const [monthly, setMonthly] = useState("");
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  // seed local editors from the hydrated store, once
  useEffect(() => {
    if (!ready) return;
    if (state.myStartup) {
      setForm(formFrom(state.myStartup));
      setMonthly(String(state.myStartup.verifiedRevenue || ""));
      setProgress(Math.round((state.myStartup.goalProgress ?? 0) * 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const set = <K extends keyof BoothForm>(key: K, value: BoothForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const boothValid =
    form.name.trim() !== "" && state.profile.name.trim() !== "";

  const saveBooth = () => {
    if (!boothValid) return;
    const startup: Startup = {
      id: "mine",
      name: form.name.trim(),
      oneLiner: form.oneLiner.trim(),
      pitch: form.pitch.trim(),
      founder: state.profile.name,
      founderLook: state.profile.look,
      category: form.category.trim() || "Uncategorized",
      goal: form.goal.trim() || "Survive",
      goalProgress: state.myStartup?.goalProgress ?? 0,
      verifiedRevenue: state.myStartup?.verifiedRevenue ?? 0,
      seekingCofounder: form.seekingCofounder,
      booth: {
        carpet: form.carpet,
        banner: form.banner,
        sign: form.sign.trim().slice(0, 12) || form.name.trim().slice(0, 12),
        glyph: form.glyph,
      },
    };
    actions.saveMyStartup(startup);
    setToast({ id: Date.now(), text: "Booth saved. See you on the floor." });
  };

  const verify = () => {
    const n = Math.max(0, Number(monthly) || 0);
    actions.verifyMyRevenue(n, Math.max(0, Math.min(100, progress)) / 100);
    setToast({
      id: Date.now(),
      text: `Verified. ${rankFor(n).name} it is.`,
    });
  };

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-14">
        <p className="text-sm text-muted">Opening your profile…</p>
      </main>
    );
  }

  const verifiedRevenue = state.myStartup?.verifiedRevenue ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl">Profile</h1>

      {/* ---- Identity ---- */}
      <SectionCard title="Identity">
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="profile-name" className="micro mb-1.5 block text-muted">
              Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={state.profile.name}
              maxLength={24}
              onChange={(e) => actions.setName(e.target.value.slice(0, 24))}
              placeholder="Ada Byron"
              autoComplete="name"
              className="w-full max-w-sm rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
            />
          </div>
          <div>
            <span className="micro mb-2 block text-muted">Look</span>
            <AvatarPicker look={state.profile.look} onChange={actions.setLook} />
          </div>
        </div>
      </SectionCard>

      {/* ---- My booth ---- */}
      <SectionCard title="My booth">
        <div className="grid gap-6 md:grid-cols-[1fr,220px]">
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="booth-name" className="micro mb-1.5 block text-muted">
                Startup name
              </label>
              <input
                id="booth-name"
                type="text"
                value={form.name}
                maxLength={40}
                onChange={(e) => set("name", e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="booth-oneliner" className="micro mb-1.5 block text-muted">
                One-liner
              </label>
              <input
                id="booth-oneliner"
                type="text"
                value={form.oneLiner}
                maxLength={90}
                onChange={(e) => set("oneLiner", e.target.value)}
                placeholder="What it does, in one breath"
                className="w-full rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
              />
            </div>
            <div>
              <label htmlFor="booth-pitch" className="micro mb-1.5 block text-muted">
                Pitch
              </label>
              <textarea
                id="booth-pitch"
                value={form.pitch}
                maxLength={400}
                rows={3}
                onChange={(e) => set("pitch", e.target.value)}
                placeholder="Two or three plain sentences. Adjectives are not traction."
                className="w-full rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="booth-category" className="micro mb-1.5 block text-muted">
                  Category
                </label>
                <input
                  id="booth-category"
                  type="text"
                  value={form.category}
                  maxLength={30}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="Dev tools"
                  className="w-full rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
                />
              </div>
              <div>
                <label htmlFor="booth-goal" className="micro mb-1.5 block text-muted">
                  Goal
                </label>
                <input
                  id="booth-goal"
                  type="text"
                  value={form.goal}
                  maxLength={60}
                  onChange={(e) => set("goal", e.target.value)}
                  placeholder="Reach $5k MRR"
                  className="w-full rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.seekingCofounder}
                onChange={(e) => set("seekingCofounder", e.target.checked)}
                className="h-4 w-4 accent-[#2B8A3E]"
              />
              Seeking a co-founder
            </label>

            <div className="mt-2 flex flex-col gap-4 border-t border-line pt-4">
              <span className="micro text-muted">Booth theme</span>
              <ColorRow
                label="Carpet"
                value={form.carpet}
                onPick={(c) => set("carpet", c)}
              />
              <ColorRow
                label="Banner"
                value={form.banner}
                onPick={(c) => set("banner", c)}
              />
              <div>
                <label htmlFor="booth-sign" className="micro mb-1.5 block text-muted">
                  Sign text (12 chars max)
                </label>
                <input
                  id="booth-sign"
                  type="text"
                  value={form.sign}
                  maxLength={12}
                  onChange={(e) => set("sign", e.target.value)}
                  placeholder="ACME CO"
                  className="w-40 rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
                />
              </div>
              <div>
                <span className="micro mb-1.5 block text-muted">Glyph</span>
                <div className="flex flex-wrap gap-1.5">
                  {GLYPH_IDS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set("glyph", g)}
                      aria-label={`Glyph: ${g}`}
                      aria-pressed={form.glyph === g}
                      className={`flex h-8 w-8 items-center justify-center rounded-sm border ${
                        form.glyph === g
                          ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-panel"
                          : "border-line hover:border-muted"
                      }`}
                    >
                      <PixelGlyph glyph={g} color="#23201A" size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={saveBooth}
                disabled={!boothValid}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.myStartup ? "Save booth" : "Set up booth"}
              </button>
              {state.myStartup && (
                <button
                  type="button"
                  onClick={() => {
                    actions.clearMyStartup();
                    setForm(EMPTY_FORM);
                    setMonthly("");
                    setProgress(0);
                    setToast({ id: Date.now(), text: "Booth taken down." });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:border-muted hover:text-ink"
                >
                  Take down booth
                </button>
              )}
              {!boothValid && (
                <span className="text-xs text-muted">
                  {state.profile.name.trim() === ""
                    ? "Set your name above first — booths need a founder."
                    : "A booth needs at least a startup name."}
                </span>
              )}
            </div>
          </div>

          {/* live booth preview */}
          <div>
            <span className="micro mb-2 block text-muted">Preview</span>
            <div className="panel overflow-hidden">
              <div
                className="flex items-center justify-center gap-2 px-3 py-2.5"
                style={{ backgroundColor: form.banner }}
              >
                <PixelGlyph glyph={form.glyph} color="#F2EFE7" size={14} />
                <span className="micro truncate text-paper">
                  {form.sign.trim() || form.name.trim().slice(0, 12) || "YOUR SIGN"}
                </span>
              </div>
              <div
                className="h-24"
                style={{
                  backgroundColor: form.carpet,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 8px, transparent 8px 16px)",
                }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Banner and carpet, roughly as they render on the floor.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ---- Verification ---- */}
      <SectionCard title="Verification">
        <p className="text-sm leading-relaxed text-muted">
          In live mode your rank comes from a read-only Stripe connection —
          this build simulates it, so type whatever you can live with.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-5">
          <div>
            <label htmlFor="verify-revenue" className="micro mb-1.5 block text-muted">
              Monthly revenue (USD)
            </label>
            <input
              id="verify-revenue"
              type="number"
              min={0}
              step={50}
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              placeholder="0"
              className="w-40 rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
            />
          </div>
          <div className="min-w-[200px]">
            <label htmlFor="verify-progress" className="micro mb-1.5 block text-muted">
              Goal progress: {progress}%
            </label>
            <input
              id="verify-progress"
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-[#2B8A3E]"
            />
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={!state.myStartup}
            className="rounded-md bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Verify (demo)
          </button>
          {!state.myStartup && (
            <span className="text-xs text-muted">
              Set up a booth first — the rank has to hang on something.
            </span>
          )}
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <span className="micro mb-2 block text-muted">Current rank</span>
          <RankBadge revenue={verifiedRevenue} size="lg" />
          <ul className="mt-4 space-y-1">
            {RANKS.map((r) => {
              const held = rankFor(verifiedRevenue).id === r.id;
              return (
                <li
                  key={r.id}
                  className={`flex items-baseline gap-2 text-xs ${
                    held ? "text-ink" : "text-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="micro w-28">{r.name}</span>
                  <span>${r.minRevenue.toLocaleString("en-US")}+</span>
                  {held && <span className="micro text-verify">you are here</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </SectionCard>

      {/* ---- Membership ---- */}
      <SectionCard title="Membership">
        <div className="mb-4 flex items-center gap-2">
          <span className="micro rounded-sm border border-line px-1.5 py-0.5 text-muted">
            demo — no payment wired
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["free", "pro", "founder"] as SubTier[]).map((tier) => {
            const current = state.sub === tier;
            const unlocked = FLOORS.filter(
              (f) => TIER_ORDER[f.tier] <= TIER_ORDER[tier],
            );
            return (
              <article
                key={tier}
                className={`flex flex-col rounded-md border p-4 ${
                  current ? "border-accent" : "border-line"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-base">{TIER_LABEL[tier]}</h3>
                  <span className="text-xs text-muted">{TIER_PRICE[tier]}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {TIER_BLURB[tier]}
                </p>
                <ul className="mt-3 flex-1 space-y-1">
                  {unlocked.map((f) => (
                    <li key={f.id} className="flex items-baseline gap-1.5 text-xs">
                      <span aria-hidden="true" className="text-verify">
                        ·
                      </span>
                      {f.name}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <span className="micro mt-4 rounded-md border border-accent/40 px-3 py-1.5 text-center text-accent">
                    Current plan
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      actions.setSub(tier);
                      setToast({
                        id: Date.now(),
                        text: `Switched to ${TIER_LABEL[tier]}.`,
                      });
                    }}
                    className="mt-4 rounded-md border border-ink px-3 py-1.5 text-sm hover:bg-paper"
                  >
                    Switch to {TIER_LABEL[tier]}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </SectionCard>

      {/* ---- Connections ---- */}
      <SectionCard title="Connections">
        {state.connections.length === 0 ? (
          <p className="text-sm text-muted">
            No connections yet. Go talk to somebody.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {[...state.connections]
              .sort((a, b) => b.ts - a.ts)
              .map((c) => (
                <li key={c.ts} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {c.name}
                      {c.founder && (
                        <span className="text-muted"> · {c.founder}</span>
                      )}
                    </p>
                    <p className="micro mt-0.5 text-muted">
                      {c.floorId} · {relativeTime(c.ts)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => actions.removeConnection(c.ts)}
                    className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>

      <Toast toast={toast} />
    </main>
  );
}
