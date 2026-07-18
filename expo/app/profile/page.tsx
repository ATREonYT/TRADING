"use client";

import { useEffect, useState } from "react";
import { isValidLogo, useAppState } from "@/lib/store";
import { registerStartup, unregisterStartup } from "@/lib/social";
import { RANKS, rankFor } from "@/lib/ranks";
import { FLOORS } from "@/lib/data/floors";
import { earnedTitles, questStates } from "@/lib/data/quests";
import {
  TIER_ORDER,
  type CarpetPattern,
  type GlyphId,
  type Startup,
  type SubTier,
} from "@/lib/types";
import AccountCard from "@/components/AccountCard";
import AvatarPicker from "@/components/AvatarPicker";
import BoothPreview from "@/components/BoothPreview";
import RankBadge from "@/components/RankBadge";
import PixelGlyph, { GLYPH_IDS } from "@/components/PixelGlyph";
import { TIER_LABEL, TIER_PRICE, TIER_PRICE_ANNUAL } from "@/components/TierTag";
import {
  FOUNDING_OFFER,
  TIER_PERKS,
  TIER_PRICING,
  annualFreeMonths,
  billingLive,
  checkoutLink,
  foundingCheckoutLink,
  type BillingCycle,
} from "@/lib/pricing";
import Toast, { type ToastData } from "@/components/Toast";

const SWATCHES: string[] = [
  "#8C3B2E",
  "#C4562B",
  "#4E6E4E",
  "#7A8C50",
  "#3B5B92",
  "#57829B",
  "#6B4E71",
  "#2F6F6A",
  "#A98C5B",
  "#8A6B4D",
  "#555049",
  "#B08D2E",
];

const PATTERNS: { id: CarpetPattern; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "border", label: "Border" },
  { id: "stripes", label: "Stripes" },
];

const TIER_BLURB: Record<SubTier, string> = {
  free: "The public floors. Plenty to see.",
  pro: "Everything in Free, plus the quieter floors.",
  founder: "Every floor, velvet rope included.",
};

const BADGE_META: Record<string, { name: string; blurb: string; glyph: GlyphId }> = {
  "first-steps": {
    name: "First Steps",
    blurb: "Took the tour — or knew the way already.",
    glyph: "star",
  },
  "demo-night": {
    name: "Demo Night",
    blurb: "In the hall while it was live.",
    glyph: "bolt",
  },
  rounds: {
    name: "Making Rounds",
    blurb: "Chatted with three different founders.",
    glyph: "rocket",
  },
  connector: {
    name: "Connector",
    blurb: "Three connections and counting.",
    glyph: "heart",
  },
  mark: {
    name: "Left a Mark",
    blurb: "Signed two guestbooks.",
    glyph: "flask",
  },
  exhibitor: {
    name: "Exhibitor",
    blurb: "Put a stand on the floor.",
    glyph: "cube",
  },
  tourist: {
    name: "Tourist",
    blurb: "Two floors, one pair of shoes.",
    glyph: "wave",
  },
  "crowd-pleaser": {
    name: "Crowd Pleaser",
    blurb: "Ten reactions deep.",
    glyph: "coin",
  },
  habit: {
    name: "Regular",
    blurb: "Three days running. The floor notices.",
    glyph: "leaf",
  },
  founding: {
    name: "Founding Member",
    blurb: "Here before it was anything. The number stays.",
    glyph: "chip",
  },
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
  pattern: CarpetPattern;
  logo?: string;
}

const EMPTY_FORM: BoothForm = {
  name: "",
  oneLiner: "",
  pitch: "",
  category: "",
  goal: "",
  seekingCofounder: false,
  carpet: SWATCHES[2],
  banner: SWATCHES[0],
  sign: "",
  glyph: "bolt",
  pattern: "solid",
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
    pattern: s.booth.pattern ?? "solid",
    logo: s.booth.logo,
  };
}

/** Display name for a floor id; "" means the connection happened off-floor. */
function floorName(floorId: string): string {
  if (!floorId) return "met online";
  return FLOORS.find((f) => f.id === floorId)?.name ?? floorId;
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
  id,
}: {
  title: string;
  children: React.ReactNode;
  /** Anchor target, e.g. the landing pricing cards link to #membership. */
  id?: string;
}) {
  return (
    <section id={id} aria-label={title} className="panel scroll-mt-6 p-6">
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
  const [cycle, setCycle] = useState<BillingCycle>("annual");
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
      // membership perk: your plan travels with the booth (priority listing,
      // tags, Founder+ gold trim) — free members simply carry none
      tier: state.sub === "free" ? undefined : state.sub,
      booth: {
        carpet: form.carpet,
        banner: form.banner,
        sign: form.sign.trim().slice(0, 12) || form.name.trim().slice(0, 12),
        glyph: form.glyph,
        pattern: form.pattern,
        logo: form.logo,
      },
    };
    actions.saveMyStartup(startup);
    // Register site-wide immediately: the directory (and its category chips)
    // pick this up without waiting for a floor stand to be claimed.
    void registerStartup(state.profile.id, startup);
    setToast({ id: Date.now(), text: "Booth saved. See you on the floor." });
  };

  const randomizeTheme = () => {
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
    let banner = pick(SWATCHES);
    let carpet = pick(SWATCHES);
    while (carpet === banner) carpet = pick(SWATCHES);
    setForm((f) => ({
      ...f,
      banner,
      carpet,
      glyph: pick(GLYPH_IDS),
      pattern: pick(PATTERNS).id,
    }));
  };

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      // cover-crop the largest centered square, then shrink to banner size
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 16, 16);
      const data = c.toDataURL("image/png");
      if (!isValidLogo(data)) {
        setToast({
          id: Date.now(),
          text: "That image would not compress down. Try a simpler one.",
        });
        return;
      }
      set("logo", data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setToast({ id: Date.now(), text: "Could not read that image file." });
    };
    img.src = url;
  };

  // Quest rewards normally land on the floor; grant here too, so a quest
  // finished elsewhere never shows checked-but-badgeless in the list below.
  useEffect(() => {
    if (!ready) return;
    for (const q of questStates(state)) {
      if (!q.done || q.claimed) continue;
      actions.markQuestClaimed(q.def.id);
      actions.grantBadge(q.def.reward.badge);
      setToast({
        id: Date.now(),
        text: `Quest complete: ${q.def.title} — ${q.def.rewardLabel}`,
      });
      break; // one per pass; the rest follow on subsequent renders
    }
  }, [ready, state, actions]);

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
  const questList = questStates(state);
  const earnedTitleList = earnedTitles(state);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl">Profile</h1>

      {/* jump nav — the page runs eight sections deep, and most visits are
          for exactly one of them (usually the booth editor) */}
      <nav aria-label="Profile sections" className="-mt-2 flex flex-wrap gap-1.5">
        {[
          ["identity", "Identity"],
          ["booth", "My booth"],
          ["verification", "Verification"],
          ["membership", "Membership"],
          ["quests", "Quests"],
          ["connections", "Connections"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-ink hover:text-ink"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* ---- Account ---- */}
      <SectionCard title="Account">
        <AccountCard onIdentity={actions.setIdentity} currentName={state.profile.name} />
      </SectionCard>

      {/* ---- Identity ---- */}
      <SectionCard title="Identity" id="identity">
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
            <label htmlFor="profile-status" className="micro mb-1.5 block text-muted">
              Status — shows over your head on the floor
            </label>
            <input
              id="profile-status"
              type="text"
              defaultValue={state.profile.status ?? ""}
              maxLength={40}
              onBlur={(e) => actions.setStatus(e.target.value.slice(0, 40))}
              placeholder="raising seed"
              autoComplete="off"
              className="w-full max-w-sm rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
            />
          </div>
          <div>
            <span className="micro mb-1.5 block text-muted">
              Title — earned through quests, shows on your hover card
            </span>
            {earnedTitleList.length === 0 ? (
              <p className="text-sm text-muted">
                None earned yet. The quest list on any floor knows the way.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => actions.setTitle("")}
                  aria-pressed={!state.profile.title}
                  className={`micro rounded-sm border px-2 py-1 ${
                    !state.profile.title
                      ? "border-ink text-ink"
                      : "border-line text-muted hover:border-muted"
                  }`}
                >
                  none
                </button>
                {earnedTitleList.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => actions.setTitle(t)}
                    aria-pressed={state.profile.title === t}
                    className={`micro rounded-sm border px-2 py-1 ${
                      state.profile.title === t
                        ? "border-gold text-gold-deep ring-1 ring-gold/40"
                        : "border-line text-muted hover:border-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <span className="micro mb-2 block text-muted">Look</span>
            <AvatarPicker look={state.profile.look} onChange={actions.setLook} />
          </div>
        </div>
      </SectionCard>

      {/* ---- Quests ---- */}
      <SectionCard title="Quests" id="quests">
        <ul className="divide-y divide-line">
          {questList.map((q) => (
            <li key={q.def.id} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  q.done ? "bg-verify" : "bg-line"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${q.done ? "text-muted line-through" : "text-ink"}`}>
                  {q.def.title}
                  <span className="ml-2 text-xs text-muted no-underline">
                    {q.def.blurb}
                  </span>
                </p>
                <p className={`text-xs ${q.done ? "text-verify" : "text-muted"}`}>
                  {q.done ? "✓ " : "reward: "}
                  {q.def.rewardLabel}
                </p>
              </div>
              <span className="micro shrink-0 text-muted">
                {q.count}/{q.def.goal}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ---- My booth ---- */}
      <SectionCard title="My booth" id="booth">
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
                <span className="micro mb-1.5 block text-muted">Banner icon</span>
                <div className="flex flex-wrap items-center gap-2">
                  {form.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logo}
                      alt="Your uploaded banner icon"
                      width={32}
                      height={32}
                      className="pixelated rounded-sm border border-accent"
                    />
                  )}
                  <label className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-ink hover:text-ink">
                    {form.logo ? "Replace logo" : "Upload your own logo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onLogoFile}
                      className="sr-only"
                    />
                  </label>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => set("logo", undefined)}
                      className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-ink hover:text-ink"
                    >
                      Remove — use a glyph
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  Any image works — it gets shrunk to a 16×16 pixel mark, like
                  everything else on the floor.
                </p>
              </div>
              <div className={form.logo ? "opacity-50" : undefined}>
                <span className="micro mb-1.5 block text-muted">
                  Glyph{form.logo ? " (unused while a logo is set)" : ""}
                </span>
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
              <div>
                <span className="micro mb-1.5 block text-muted">Carpet pattern</span>
                <div className="flex gap-1.5" role="group" aria-label="Carpet pattern">
                  {PATTERNS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set("pattern", p.id)}
                      aria-pressed={form.pattern === p.id}
                      className={`rounded-sm border px-3 py-1.5 text-xs ${
                        form.pattern === p.id
                          ? "border-accent text-accent ring-2 ring-accent ring-offset-1 ring-offset-panel"
                          : "border-line text-muted hover:border-muted hover:text-ink"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={randomizeTheme}
                  className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-ink hover:text-ink"
                >
                  Dealer&rsquo;s choice — randomize the look
                </button>
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
                    void unregisterStartup(state.profile.id);
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

          {/* live booth preview — the exact in-game rendering */}
          <div className="md:sticky md:top-6 md:self-start">
            <span className="micro mb-2 block text-muted">Preview</span>
            <BoothPreview
              carpet={form.carpet}
              banner={form.banner}
              sign={form.sign.trim() || form.name.trim().slice(0, 12)}
              glyph={form.glyph}
              pattern={form.pattern}
              logo={form.logo}
              founderLook={state.profile.look}
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Pixel for pixel, this is your stand on the floor — with you
              behind the counter. Walk up to any OPEN SPOT stand in a hall and
              claim it.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ---- Verification ---- */}
      <SectionCard title="Verification" id="verification">
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
      <SectionCard title="Membership" id="membership">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {!billingLive() && (
            <span className="micro rounded-sm border border-line px-1.5 py-0.5 text-muted">
              billing not live yet — buttons simulate the switch
            </span>
          )}
          <div
            role="group"
            aria-label="Billing cycle"
            className="flex rounded-md border border-line p-0.5"
          >
            {(["monthly", "annual"] as BillingCycle[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cycle === c}
                onClick={() => setCycle(c)}
                className={`rounded-sm px-3 py-1 text-xs ${
                  cycle === c ? "bg-ink text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {c === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>

        {/* founding member — the beta offer, capped and numbered */}
        <article className="mb-4 rounded-md border border-gold/60 bg-paper/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-base">Founding Member</h3>
            <span className="text-sm text-ink">
              ${FOUNDING_OFFER.price}{" "}
              <span className="text-xs text-muted">once · first {FOUNDING_OFFER.cap} only</span>
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            A year of Founder+, your renewal price locked for life, and a
            numbered founding badge on your card that never goes away. When
            they&rsquo;re gone, they&rsquo;re gone.
          </p>
          {state.badges.includes(FOUNDING_OFFER.badgeId) ? (
            <span className="micro mt-3 inline-block rounded-md border border-gold/60 px-3 py-1.5 text-gold-deep">
              You&rsquo;re a founding member
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                const link = foundingCheckoutLink();
                if (link) {
                  window.open(link, "_blank", "noopener");
                  return;
                }
                actions.setSub("founder");
                actions.grantBadge(FOUNDING_OFFER.badgeId);
                setToast({
                  id: Date.now(),
                  text: "Founding member (simulated). Welcome to the wall.",
                });
              }}
              className="mt-3 rounded-md bg-ink px-3 py-1.5 text-sm text-paper hover:bg-ink/85"
            >
              {foundingCheckoutLink() ? "Become a founding member" : "Simulate founding membership"}
            </button>
          )}
        </article>

        <div className="grid gap-4 sm:grid-cols-3">
          {(["free", "pro", "founder"] as SubTier[]).map((tier) => {
            const current = state.sub === tier;
            const unlocked = FLOORS.filter(
              (f) => TIER_ORDER[f.tier] <= TIER_ORDER[tier],
            );
            const price =
              tier === "free"
                ? "$0"
                : cycle === "monthly"
                  ? TIER_PRICE[tier]
                  : TIER_PRICE_ANNUAL[tier];
            return (
              <article
                key={tier}
                className={`flex flex-col rounded-md border p-4 ${
                  current ? "border-accent" : "border-line"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-base">{TIER_LABEL[tier]}</h3>
                  <span className="text-xs text-muted">{price}</span>
                </div>
                {tier !== "free" && cycle === "annual" && (
                  <p className="micro mt-0.5 text-verify">
                    {annualFreeMonths(tier)} months free vs monthly
                  </p>
                )}
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
                  {TIER_PERKS[tier].map((perk) => (
                    <li key={perk} className="flex items-baseline gap-1.5 text-xs text-muted">
                      <span aria-hidden="true" className={tier === "founder" ? "text-gold-deep" : "text-accent"}>
                        ·
                      </span>
                      {perk}
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
                      if (tier !== "free") {
                        const link = checkoutLink(tier, cycle);
                        if (link) {
                          window.open(link, "_blank", "noopener");
                          return;
                        }
                      }
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

      {/* ---- Badges ---- */}
      <SectionCard title="Badges">
        {state.badges.length === 0 ? (
          <p className="text-sm text-muted">
            No badges yet. They&rsquo;re earned on the floor, not requested.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {state.badges.map((id) => {
              const meta = BADGE_META[id];
              return (
                <li
                  key={id}
                  className="flex w-36 flex-col items-center gap-2 rounded-md border border-line p-3 text-center"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-sm border-2 border-gold/60 bg-paper"
                  >
                    <PixelGlyph glyph={meta?.glyph ?? "star"} color="#B08D2E" size={18} />
                  </span>
                  <span className="micro text-ink">{meta?.name ?? id}</span>
                  <span className="text-xs leading-snug text-muted">
                    {meta?.blurb ?? "Earned somewhere on the floor."}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ---- Connections ---- */}
      <SectionCard title="Connections" id="connections">
        {state.connections.length === 0 ? (
          <p className="text-sm text-muted">
            No connections yet. Go talk to somebody.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {[...state.connections]
              .sort((a, b) => b.ts - a.ts)
              .map((c) => (
                <li key={c.ts} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {c.name}
                        {c.founder && (
                          <span className="text-muted"> · {c.founder}</span>
                        )}
                      </p>
                      <p className="micro mt-0.5 text-muted">
                        {floorName(c.floorId)} · {relativeTime(c.ts)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => actions.removeConnection(c.ts)}
                      className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                    >
                      Remove
                    </button>
                  </div>
                  <div>
                    <label htmlFor={`connection-note-${c.ts}`} className="sr-only">
                      Note about {c.name}
                    </label>
                    <input
                      id={`connection-note-${c.ts}`}
                      type="text"
                      defaultValue={c.note ?? ""}
                      maxLength={200}
                      placeholder="add a note…"
                      autoComplete="off"
                      onBlur={(e) =>
                        actions.setConnectionNote(c.ts, e.target.value.trim().slice(0, 200))
                      }
                      className="w-full rounded-md border border-line px-2.5 py-1.5 text-xs placeholder:text-muted/70"
                    />
                  </div>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>

      <Toast toast={toast} />
    </main>
  );
}
