import { TopNav } from "@/components/TopNav";
import { Dashboard } from "@/components/Dashboard";

export const metadata = {
  title: "Dashboard — Helix Trading Analytics",
  description:
    "Real-time trading analytics: candlestick price action, P&L, positions, and portfolio allocation.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-base">
      <TopNav />
      <Dashboard />
    </div>
  );
}
