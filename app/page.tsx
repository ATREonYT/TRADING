import { TopNav } from "@/components/TopNav";
import { Dashboard } from "@/components/Dashboard";

export default function Page() {
  return (
    <div className="min-h-dvh bg-base">
      <TopNav />
      <Dashboard />
    </div>
  );
}
