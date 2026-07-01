import { ScrollProgress } from "./ScrollProgress";
import { LandingNav } from "./LandingNav";
import { TickerTape } from "./TickerTape";
import { Hero } from "./Hero";
import { SourcesStrip } from "./SourcesStrip";
import { StatsBand } from "./StatsBand";
import { Features } from "./Features";
import { CatalystShowcase } from "./CatalystShowcase";
import { LiveMarkets } from "./LiveMarkets";
import { HowItWorks } from "./HowItWorks";
import { LiveNewsStrip } from "./LiveNewsStrip";
import { MarketHeatmap } from "./MarketHeatmap";
import { FAQ } from "./FAQ";
import { CTASection } from "./CTASection";
import { Footer } from "./Footer";

export function Landing() {
  return (
    <div className="min-h-dvh bg-base">
      <ScrollProgress />
      <LandingNav />
      <TickerTape />
      <main>
        <Hero />
        <SourcesStrip />
        <StatsBand />
        <Features />
        <CatalystShowcase />
        <LiveMarkets />
        <HowItWorks />
        <LiveNewsStrip />
        <MarketHeatmap />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
