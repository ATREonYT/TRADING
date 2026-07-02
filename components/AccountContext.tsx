"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, initAccounts, ACCOUNT_EVENT, type User } from "@/lib/accounts";

interface AccountCtx {
  user: User | null;
  /** false until the first client read — avoids SSR/CSR flicker */
  ready: boolean;
}

const Ctx = createContext<AccountCtx>({ user: null, ready: false });

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountCtx>({ user: null, ready: false });

  useEffect(() => {
    initAccounts(); // restores a cloud session if Supabase is configured
    const sync = () => setState({ user: getCurrentUser(), ready: true });
    sync();
    window.addEventListener(ACCOUNT_EVENT, sync);
    window.addEventListener("storage", sync); // other tabs (local mode)
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAccount = () => useContext(Ctx);
