import { TopNav } from "@/components/TopNav";
import { AccountView } from "@/components/account/AccountView";

export const metadata = {
  title: "Account",
  description: "Your Helix account and paper-trading profile.",
};

export default function AccountPage() {
  return (
    <div className="min-h-dvh bg-base">
      <TopNav />
      <AccountView />
    </div>
  );
}
