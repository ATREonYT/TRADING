import { TopNav } from "@/components/TopNav";
import { StockView } from "@/components/stock/StockView";
import { lookupSymbol } from "@/lib/symbolCatalog";

export function generateMetadata({ params }: { params: { symbol: string } }) {
  const { symbol, name } = lookupSymbol(decodeURIComponent(params.symbol));
  return {
    title: `${symbol} — ${name} news & analysis`,
    description: `Live news, catalysts and analytics for ${name} (${symbol}) — what's moving the price right now.`,
  };
}

export default function StockPage({ params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  return (
    <div className="min-h-dvh bg-base">
      <TopNav />
      <StockView symbol={symbol} />
    </div>
  );
}
