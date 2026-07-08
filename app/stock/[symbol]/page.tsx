import { TopNav } from "@/components/TopNav";
import { StockView } from "@/components/stock/StockView";
import { lookupSymbol } from "@/lib/symbolCatalog";

interface Props {
  params: { symbol: string };
  searchParams: { name?: string };
}

const cleanName = (raw?: string) =>
  (raw ?? "").replace(/[^\w\s.&'-]/g, "").trim().slice(0, 60);

export function generateMetadata({ params, searchParams }: Props) {
  const looked = lookupSymbol(decodeURIComponent(params.symbol));
  const name = cleanName(searchParams.name) || looked.name;
  return {
    title: `${looked.symbol} — ${name} news & analysis`,
    description: `Live news, catalysts and analytics for ${name} (${looked.symbol}) — what's moving the price right now.`,
  };
}

export default function StockPage({ params, searchParams }: Props) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  return (
    <div className="min-h-dvh bg-base">
      <TopNav />
      <StockView symbol={symbol} displayName={cleanName(searchParams.name) || undefined} />
    </div>
  );
}
