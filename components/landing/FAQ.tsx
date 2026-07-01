"use client";

import { useState } from "react";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "Where does the news and market data come from?",
    a: "Helix aggregates 65+ public news feeds (Reuters, Bloomberg, AP, FT, WSJ, CNBC, crypto and macro desks) plus live prices from public market APIs. No API keys are required and everything is fetched in real time.",
  },
  {
    q: "What is a 'catalyst' and how is it detected?",
    a: "A catalyst is the specific event that moves a price — an earnings beat, guidance cut, upgrade, M&A, Fed decision, approval, lawsuit, and so on. Helix classifies each headline into 20+ catalyst types with a transparent rules engine and explains the mechanism behind the move.",
  },
  {
    q: "How are the conviction scores calculated?",
    a: "Each instrument gets a 0–100 score that fuses momentum (price change), volume (vs. its average), and news sentiment. The weighting is fully transparent — you can expand any signal to see the exact breakdown and drivers.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Helix is an automated information tool. Signals and catalyst tags are computed heuristics, not recommendations to buy or sell. Markets carry risk — always do your own research.",
  },
  {
    q: "Does it update in real time?",
    a: "Yes. The Radar polls fresh news and market data on a short interval and flashes new items as they arrive, with a breaking-news ticker for the highest-impact stories.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-[820px] px-4 py-20 lg:px-6">
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-10 space-y-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={i} delay={i * 50}>
              <div className={`glossy overflow-hidden rounded-xl transition-colors ${isOpen ? "border-primary/40" : ""}`}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-ink">{f.q}</span>
                  <span
                    className={`ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform ${
                      isOpen ? "rotate-45 border-primary text-primary" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{f.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
