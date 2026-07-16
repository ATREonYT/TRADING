import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDigest, formatDisclaimer, DISCLAIMER_FOOTER } from "../src/format.js";

test("formatDisclaimer covers the key protections", () => {
  const text = formatDisclaimer("Test Signals");
  assert.match(text, /Test Signals/);
  assert.match(text, /not.*investment advice/i);
  assert.match(text, /educational/i);
  assert.match(text, /Past performance/i);
  assert.match(text, /hypothetical/i);
  assert.match(text, /your own decision/i);
  assert.match(text, /no personalized advice/i);
});

test("formatDigest includes stats and always ends with the disclaimer footer", () => {
  const text = formatDigest({
    serviceName: "Test Signals",
    dateUtc: "2026-07-16",
    signalsToday: 7,
    bestToday: { symbol: "PEPE/USDT", score: 83, windowChangePct: 6.2 },
    perf: { closed: 20, wins: 11, winRate: 55, avgFinalPct: 1.2, targetPct: 5, stopPct: 5 },
    horizonMin: 60,
    movers: [{ symbol: "DOGE/USDT", last: 0.1, percentage: 12.3, quoteVolume: 5_000_000 }],
  });
  assert.match(text, /Daily Digest/);
  assert.match(text, /Signals in the last 24h: <b>7<\/b>/);
  assert.match(text, /PEPE/);
  assert.match(text, /55%/);
  assert.match(text, /hypothetical/i);
  assert.match(text, /DOGE\/USDT/);
  assert.ok(text.endsWith(DISCLAIMER_FOOTER));
});

test("formatDigest handles a quiet day with no history", () => {
  const text = formatDigest({
    serviceName: "Test Signals",
    dateUtc: "2026-07-16",
    signalsToday: 0,
    perf: { closed: 0, wins: 0, winRate: 0, avgFinalPct: 0, targetPct: 5, stopPct: 5 },
    horizonMin: 60,
    movers: [],
  });
  assert.match(text, /Signals in the last 24h: <b>0<\/b>/);
  assert.match(text, /not enough closed signals yet/);
  assert.ok(text.endsWith(DISCLAIMER_FOOTER));
});
