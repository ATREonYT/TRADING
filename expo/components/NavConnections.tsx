"use client";

/** Nav link to /connections with an unread dot (requests + new messages). */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { unreadCount, useInbox, useSocialPush } from "@/lib/social";

export default function NavConnections() {
  const [state] = useAppState();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const me = ready ? state.profile.id : "";
  const [inbox, refresh] = useInbox(me, 60_000);
  useSocialPush(me, () => refresh());
  const unread = me ? unreadCount(inbox, me) : 0;

  return (
    <Link
      href="/connections"
      className="relative text-sm text-muted hover:text-ink hover:underline"
    >
      Connections
      {unread > 0 && (
        <span
          aria-label={`${unread} unread`}
          className="absolute -right-2.5 -top-1 h-2 w-2 rounded-full bg-accent"
        />
      )}
    </Link>
  );
}
