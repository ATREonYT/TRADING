import { LandingNav } from "./LandingNav";
import { TickerTape } from "./TickerTape";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { CatalystShowcase } from "./CatalystShowcase";
import { HowItWorks } from "./HowItWorks";
import { MarketHeatmap } from "./MarketHeatmap";
import { LiveNewsStrip } from "./LiveNewsStrip";
import { CTASection } from "./CTASection";
import { Footer } from "./Footer";

export function Landing() {
  return (
    <div className="min-h-dvh bg-base">
      <LandingNav />
      <TickerTape />
      <main>
        <Hero />
        <Features />
        <CatalystShowcase />
        <HowItWorks />
        <LiveNewsStrip />
        <MarketHeatmap />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
