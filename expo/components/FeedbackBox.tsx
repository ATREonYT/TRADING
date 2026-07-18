"use client";

/**
 * Beta feedback: a plain box that posts to the floor server. No ticket
 * numbers, no categories — the operator reads everything by hand at this
 * size, and users can tell.
 */

import { useState } from "react";
import { httpBase } from "@/lib/net";
import { useAppState } from "@/lib/store";

export default function FeedbackBox() {
  const [state] = useAppState();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || status === "sending") return;
    setStatus("sending");
    try {
      const base = httpBase();
      if (!base) throw new Error("offline");
      const res = await fetch(`${base}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          from: state.profile.name || "anonymous",
          page: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });
      if (!res.ok) throw new Error("rejected");
      setStatus("sent");
      setText("");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="feedback-text" className="micro text-muted">
        What broke, what&rsquo;s missing, what should exist
      </label>
      <textarea
        id="feedback-text"
        value={text}
        maxLength={1000}
        rows={4}
        onChange={(e) => {
          setText(e.target.value);
          if (status === "sent" || status === "failed") setStatus("idle");
        }}
        placeholder="Say it plainly — it goes straight to the person who builds this."
        className="w-full rounded-md border border-line px-3 py-2 text-sm placeholder:text-muted/70"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!text.trim() || status === "sending"}
          className="rounded-md bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send feedback"}
        </button>
        {status === "sent" && (
          <span className="text-sm text-verify">Got it. Thank you — it will be read.</span>
        )}
        {status === "failed" && (
          <span className="text-sm text-muted">
            Could not send (server offline?). Try again in a bit.
          </span>
        )}
      </div>
    </form>
  );
}
