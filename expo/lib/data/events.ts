/**
 * FounderFloor — scheduled floor events.
 *
 * There is deliberately ONE recurring event: Demo Night, every Thursday
 * 19:00-20:00 UTC on the main hall. A single well-known weekly moment gives
 * quiet floors a reason to fill up at the same time; a calendar of many
 * events would spread the same visitors thin.
 *
 * To add more events later: give each one its own anchor offset + period +
 * duration (the same shape as the constants below), compute the
 * current-or-next window for each with the same modulo arithmetic, and have
 * nextEvent() return whichever window starts (or is live) first.
 *
 * Everything here is pure: callers pass nowMs (e.g. Date.now()) so the HUD
 * can re-render a countdown on its own clock and tests can pin time. All
 * math is UTC — the Unix epoch conveniently fell on a Thursday, so
 * "Thursday 19:00 UTC" is a fixed offset into the epoch week.
 */

export interface EventInfo {
  name: string;
  blurb: string;
  floorId: string;
  startMs: number;
  endMs: number;
  live: boolean;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

/**
 * First window start: Thursday 1970-01-01 19:00:00 UTC. 1970-01-01 was a
 * Thursday, so every start is FIRST_START + k * WEEK for integer k.
 */
const FIRST_START = 19 * HOUR;
const DURATION = HOUR;

/**
 * The current-or-next Demo Night window relative to nowMs.
 * If nowMs falls inside a window ([start, end)), that window returns with
 * live=true; otherwise the next upcoming window returns with live=false.
 */
export function nextEvent(nowMs: number): EventInfo {
  // ms elapsed since the most recent window start (double-mod handles
  // pre-epoch nowMs, where % in JS is negative).
  const sinceStart = (((nowMs - FIRST_START) % WEEK) + WEEK) % WEEK;
  const lastStart = nowMs - sinceStart;
  const live = sinceStart < DURATION;
  const startMs = live ? lastStart : lastStart + WEEK;
  return {
    name: "Demo Night",
    blurb:
      "The weekly hour everyone shows up at the Main Hall at once. Be in the room and there's a badge in it for you.",
    floorId: "main-hall",
    startMs,
    endMs: startMs + DURATION,
    live,
  };
}

/**
 * Compact countdown for the HUD: "2d 4h" at a day or more, "3h 12m" at an
 * hour or more, "14m" at a minute or more, "now" under a minute (or for
 * anything non-positive / non-finite).
 */
export function fmtCountdown(msLeft: number): string {
  if (!Number.isFinite(msLeft) || msLeft < MINUTE) return "now";
  if (msLeft >= DAY) {
    const d = Math.floor(msLeft / DAY);
    const h = Math.floor((msLeft % DAY) / HOUR);
    return `${d}d ${h}h`;
  }
  if (msLeft >= HOUR) {
    const h = Math.floor(msLeft / HOUR);
    const m = Math.floor((msLeft % HOUR) / MINUTE);
    return `${h}h ${m}m`;
  }
  return `${Math.floor(msLeft / MINUTE)}m`;
}
