import { TopNav } from "@/components/TopNav";
import { PaperView } from "@/components/paper/PaperView";

export const metadata = {
  title: "Paper Trading",
  description: "Practice trading with $100,000 of virtual cash — live prices, zero risk.",
};

export default function PaperPage() {
  return (
    <div className="min-h-dvh bg-base">
      <TopNav />
      <PaperView />
    </div>
  );
}
