/**
 * Walk-forward backtest for the price-projection engine.
 *
 * Usage:  npm run backtest            (defaults to a liquid 12-symbol basket)
 *         npm run backtest -- NVDA TSLA BTC-USD
 *
 * For each symbol it fetches ~1y of daily candles from Yahoo, then walks
 * forward: at every step it hands the engine only the trailing 30 bars,
 * asks for a 7-bar projection, and scores it against what actually happened:
 *
 *   - cone coverage   → % of outcomes inside the 80% band (target ≈ 80)
 *   - direction hits  → % where sign(median path) matched sign(actual move)
 *   - probability calibration → avg upProbability vs realized up-rate,
 *                               bucketed, so "70%" should win ~70% of the time
 *
 * Needs outbound HTTPS (run on your deploy box or laptop, not a sandbox).
 * Falls back to a synthetic-series self-check when the network is blocked.
 */
import { projectPrice } from "../lib/radar/analytics";

const DEFAULT_BASKET = [
  "NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "META",
  "AMD", "JPM", "XOM", "COST", "BA", "NFLX",
];

interface Sample {
  inCone: boolean;
  dirHit: boolean;
  upProb: number;
  wentUp: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

async function fetchDailyCloses(symbol: string): Promise<{ closes: number[]; volumes: number[] } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (HelixBacktest/1.0)" } });
    if (!r.ok) return null;
    const j: any = await r.json();
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0];
    const closes = (q?.close ?? []).filter((v: number | null): v is number => typeof v === "number");
    const volumes = (q?.volume ?? []).filter((v: number | null): v is number => typeof v === "number");
    return closes.length > 60 ? { closes, volumes } : null;
  } catch {
    return null;
  }
}

function walkForward(closes: number[], volumes: number[]): Sample[] {
  const out: Sample[] = [];
  const HIST = 30;
  const HORIZON = 7;
  for (let t = HIST; t + HORIZON < closes.length; t += 3) {
    const hist = closes.slice(t - HIST, t + 1);
    const price = closes[t];
    // Price/volume-only breakdown (no historical news available offline):
    const dayChange = closes[t - 1] ? (price / closes[t - 1] - 1) * 100 : 0;
    const momentum = clamp(Math.round(dayChange * 6), -100, 100);
    const avgVol = volumes.slice(Math.max(0, t - 21), t).reduce((a, b) => a + b, 0) / 20 || 1;
    const volume = clamp(Math.round(((volumes[t] / avgVol) * 100 - 100) / 2), -20, 100);
    const proj = projectPrice(hist, price, { momentum, volume, sentiment: 0 }, 0, HORIZON);
    if (!proj) continue;
    const actual = closes[t + HORIZON];
    out.push({
      inCone: actual >= proj.lower[HORIZON] && actual <= proj.upper[HORIZON],
      dirHit: Math.sign(actual - price) === Math.sign(proj.expectedMovePct) && proj.expectedMovePct !== 0,
      upProb: proj.upProbability,
      wentUp: actual > price,
    });
  }
  return out;
}

// Deterministic synthetic fallback (sandbox / no network): validates cone math.
function syntheticSamples(): Sample[] {
  let a = 42 >>> 0;
  const rand = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
  const samples: Sample[] = [];
  for (let i = 0; i < 800; i++) {
    const hist = [100];
    for (let j = 1; j < 30; j++) hist.push(hist[j - 1] * Math.exp(0.015 * gauss()));
    const price = hist[hist.length - 1];
    const proj = projectPrice(hist, price, { momentum: 0, volume: 0, sentiment: 0 }, 0);
    if (!proj) continue;
    let future = price;
    for (let j = 0; j < 7; j++) future *= Math.exp(0.015 * gauss());
    samples.push({
      inCone: future >= proj.lower[7] && future <= proj.upper[7],
      dirHit: Math.sign(future - price) === Math.sign(proj.expectedMovePct),
      upProb: proj.upProbability,
      wentUp: future > price,
    });
  }
  return samples;
}

function report(label: string, samples: Sample[]) {
  if (samples.length === 0) {
    console.log(`${label}: no samples`);
    return;
  }
  const pct = (n: number) => ((n / samples.length) * 100).toFixed(1);
  const coverage = samples.filter((s) => s.inCone).length;
  const dirHits = samples.filter((s) => s.dirHit).length;
  console.log(`\n${label}`);
  console.log(`  samples            ${samples.length}`);
  console.log(`  cone coverage      ${pct(coverage)}%   (target ≈ 80%)`);
  console.log(`  direction hit-rate ${pct(dirHits)}%   (>50% = real signal)`);

  // Probability calibration buckets.
  const buckets: Record<string, { n: number; up: number; probSum: number }> = {};
  for (const s of samples) {
    const b = s.upProb < 40 ? "<40" : s.upProb <= 60 ? "40–60" : ">60";
    buckets[b] ??= { n: 0, up: 0, probSum: 0 };
    buckets[b].n++;
    if (s.wentUp) buckets[b].up++;
    buckets[b].probSum += s.upProb;
  }
  console.log("  calibration (predicted upProb → realized up-rate):");
  for (const [k, v] of Object.entries(buckets)) {
    console.log(
      `    ${k.padEnd(6)} n=${String(v.n).padStart(4)}  predicted ${(v.probSum / v.n).toFixed(0)}%  realized ${((v.up / v.n) * 100).toFixed(0)}%`,
    );
  }
}

async function main() {
  const symbols = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_BASKET;
  console.log(`Helix projection backtest · ${symbols.length} symbols · 30-bar history → 7-bar horizon`);

  const all: Sample[] = [];
  let fetched = 0;
  for (const sym of symbols) {
    const data = await fetchDailyCloses(sym);
    if (!data) {
      console.log(`  ${sym}: fetch failed (network blocked or invalid symbol)`);
      continue;
    }
    fetched++;
    const samples = walkForward(data.closes, data.volumes);
    all.push(...samples);
    console.log(`  ${sym}: ${samples.length} walk-forward samples`);
  }

  if (fetched === 0) {
    console.log("\nNo live data reachable — running the synthetic self-check instead.");
    report("SYNTHETIC (zero-drift random walk — validates cone math only)", syntheticSamples());
    console.log("\nRun this script from a machine with internet access for the real backtest.");
    return;
  }
  report(`REAL DATA (${fetched} symbols)`, all);
  console.log(
    "\nReading the numbers: coverage near 80% means the cone is honest; direction >50% and" +
      "\nmonotone calibration buckets mean the drift carries real signal, not noise.",
  );
}

main();
