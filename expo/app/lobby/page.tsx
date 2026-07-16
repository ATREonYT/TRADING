"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { FLOORS } from "@/lib/data/floors";
import { TIER_ORDER, type AvatarLook } from "@/lib/types";
import AvatarPicker from "@/components/AvatarPicker";
import TierTag, { TIER_LABEL } from "@/components/TierTag";

function FirstVisitPanel({
  onDone,
}: {
  onDone: (name: string, look: AvatarLook) => void;
}) {
  const [name, setName] = useState("");
  const [look, setLook] = useState<AvatarLook>({ skin: 1, outfit: 0, hair: 1 });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    onDone(trimmed, look);
  };

  return (
    <div className="mx-auto max-w-xl py-14">
      <h1 className="font-display text-3xl">Before you walk in</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Pick a name and a face. Both are stored on this device and nowhere
        else, which is either a feature or a warning depending on your browser
        habits.
      </p>
      <form onSubmit={submit} className="panel mt-8 flex flex-col gap-6 p-6">
        <div>
          <label htmlFor="lobby-name" className="micro mb-1.5 block text-muted">
            Your name
          </label>
          <input
            id="lobby-name"
            type="text"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Byron"
            autoComplete="name"
            className="w-full rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
          />
        </div>
        <div>
          <span className="micro mb-2 block text-muted">Your look</span>
          <AvatarPicker look={look} onChange={setLook} />
        </div>
        <button
          type="submit"
          disabled={!name.trim()}
          className="self-start rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enter the lobby
        </button>
      </form>
    </div>
  );
}

export default function LobbyPage() {
  const [state, actions] = useAppState();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-14">
        <p className="text-sm text-muted">Opening the lobby…</p>
      </main>
    );
  }

  if (state.profile.name === "") {
    return (
      <main className="mx-auto w-full max-w-5xl px-4">
        <FirstVisitPanel
          onDone={(name, look) => {
            actions.setName(name);
            actions.setLook(look);
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl">Pick a floor</h1>
        <p className="text-sm text-muted">
          Walking as <span className="text-ink">{state.profile.name}</span> ·{" "}
          <Link href="/profile" className="text-accent hover:underline">
            change
          </Link>
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FLOORS.map((floor) => {
          const locked = TIER_ORDER[state.sub] < TIER_ORDER[floor.tier];
          return (
            <article
              key={floor.id}
              className={`panel flex flex-col p-5 ${locked ? "bg-paper/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2
                  className={`font-display text-lg leading-snug ${
                    locked ? "text-muted" : ""
                  }`}
                >
                  {floor.name}
                </h2>
                <TierTag tier={floor.tier} />
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {floor.tagline}
              </p>
              <p className="micro mt-4 text-muted">
                {floor.boothSpots.length} booths
              </p>
              {locked ? (
                <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 8 8"
                    shapeRendering="crispEdges"
                    aria-hidden="true"
                    className="pixelated text-muted"
                  >
                    <rect x="2" y="0" width="4" height="1" fill="currentColor" />
                    <rect x="1" y="1" width="1" height="3" fill="currentColor" />
                    <rect x="6" y="1" width="1" height="3" fill="currentColor" />
                    <rect x="0" y="4" width="8" height="4" fill="currentColor" />
                  </svg>
                  <span className="text-sm text-muted">
                    {TIER_LABEL[floor.tier]} floor ·{" "}
                    <Link href="/profile" className="text-accent hover:underline">
                      Upgrade in Profile
                    </Link>
                  </span>
                </div>
              ) : (
                <Link
                  href={`/floor/${floor.id}`}
                  className="mt-4 rounded-md bg-ink px-4 py-2 text-center text-sm text-paper hover:bg-ink/85"
                >
                  Enter
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
