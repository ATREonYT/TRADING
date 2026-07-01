import { TopNav } from "@/components/TopNav";
import { RadarView } from "@/components/radar/RadarView";

export const metadata = {
  title: "Radar — Live Market Intelligence | Helix",
  description:
    "Real-time world & financial news, market-wide scanning, and computed trade ideas for traders.",
};

export default function RadarPage() {
  return (
    <div className="min-h-dvh bg-base">
      <TopNav />
      <RadarView />
    </div>
  );
}
