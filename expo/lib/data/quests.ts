/**
 * FounderFloor — quests and rewards.
 *
 * Quests read deed counters from AppState (quest progress, connections,
 * claims, badges, tutorialDone) and never write anything — the floor page
 * watches for newly completed quests, grants the rewards (badge, emote
 * unlock, title) and records them in state.claimedQuests so each fires once.
 *
 * Rewards deliberately never gate the social basics: the five core emotes,
 * chat, connecting and claiming stands stay free — quests unlock extras
 * (three bonus emotes, titles, badges) per the "gate depth, not presence"
 * rule from the genre research.
 */

import type { AppState, EmoteKind } from "@/lib/types";
import { EMOTES } from "@/lib/types";

export interface QuestDef {
  id: string;
  title: string;
  blurb: string;
  goal: number;
  /** What the counter counts, shown as "2/3 founders". */
  unit: string;
  reward: {
    badge: string;
    /** Bonus emote unlocked (keys 6-8). */
    emote?: EmoteKind;
    /** Earned title, selectable in Profile, shown on your hover card. */
    title?: string;
  };
  /** Human line for the reward, shown in the quest list. */
  rewardLabel: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: "first-steps",
    title: "First steps",
    blurb: "Finish (or skip) the floor tour.",
    goal: 1,
    unit: "tour",
    reward: { badge: "first-steps" },
    rewardLabel: "badge: First steps",
  },
  {
    id: "make-the-rounds",
    title: "Make the rounds",
    blurb: "Chat with three different founders (say something — walking up is browsing).",
    goal: 3,
    unit: "founders",
    reward: { badge: "rounds", emote: "rocket" },
    rewardLabel: "unlocks the Rocket reaction (key 6)",
  },
  {
    id: "connector",
    title: "Connector",
    blurb: "Make three connections.",
    goal: 3,
    unit: "connections",
    reward: { badge: "connector", title: "Connector" },
    rewardLabel: "title: Connector",
  },
  {
    id: "leave-your-mark",
    title: "Leave your mark",
    blurb: "Sign two guestbooks.",
    goal: 2,
    unit: "guestbooks",
    reward: { badge: "mark", emote: "fire" },
    rewardLabel: "unlocks the Fire reaction (key 7)",
  },
  {
    id: "open-for-business",
    title: "Open for business",
    blurb: "Claim a stand on any floor.",
    goal: 1,
    unit: "stand",
    reward: { badge: "exhibitor", title: "Exhibitor" },
    rewardLabel: "title: Exhibitor",
  },
  {
    id: "tourist",
    title: "Tourist",
    blurb: "Set foot on two different floors.",
    goal: 2,
    unit: "floors",
    reward: { badge: "tourist", emote: "handshake" },
    rewardLabel: "unlocks the Handshake reaction (key 8)",
  },
  {
    id: "crowd-pleaser",
    title: "Crowd pleaser",
    blurb: "Send ten reactions.",
    goal: 10,
    unit: "reactions",
    reward: { badge: "crowd-pleaser", title: "Socialite" },
    rewardLabel: "title: Socialite",
  },
  {
    id: "habit",
    title: "Make it a habit",
    blurb: "Show up three days in a row.",
    goal: 3,
    unit: "days",
    reward: { badge: "habit", title: "Regular" },
    rewardLabel: "title: Regular",
  },
];

export interface QuestState {
  def: QuestDef;
  count: number;
  done: boolean;
  claimed: boolean;
}

/** Current progress of every quest, derived purely from app state. */
export function questStates(state: AppState): QuestState[] {
  const countFor = (q: QuestDef): number => {
    switch (q.id) {
      case "first-steps":
        return state.tutorialDone ? 1 : 0;
      case "make-the-rounds":
        return state.quest.talkedTo.length;
      case "connector":
        return state.connections.length;
      case "leave-your-mark":
        return state.quest.signed.length;
      case "open-for-business":
        return Object.keys(state.claims).length > 0 ? 1 : 0;
      case "tourist":
        return state.quest.floors.length;
      case "crowd-pleaser":
        return state.quest.emotes;
      case "habit":
        return state.bestStreak;
      default:
        return 0;
    }
  };
  return QUESTS.map((def) => {
    const count = Math.min(countFor(def), def.goal);
    return {
      def,
      count,
      done: count >= def.goal,
      claimed: state.claimedQuests.includes(def.id),
    };
  });
}

/** The next quest worth pointing the player at (first unfinished). */
export function nextQuest(states: QuestState[]): QuestState | null {
  return states.find((q) => !q.done) ?? null;
}

/** Which emotes this player can fire. The first five are always free. */
export function unlockedEmotes(state: AppState): EmoteKind[] {
  const base: EmoteKind[] = ["wave", "laugh", "clap", "heart", "question"];
  for (const q of questStates(state)) {
    if (q.done && q.def.reward.emote) base.push(q.def.reward.emote);
  }
  return base;
}

/** Which quest unlocks a locked emote (for the emote bar tooltip). */
export function questForEmote(kind: EmoteKind): QuestDef | undefined {
  return QUESTS.find((q) => q.reward.emote === kind);
}

/** Titles this player has earned (for the Profile title picker). */
export function earnedTitles(state: AppState): string[] {
  const titles: string[] = [];
  // Membership titles: carried by the plan, shown wherever titles show
  // (hover cards, calling cards) — visible status is part of what the
  // subscription buys.
  if (state.badges.includes("founding")) titles.push("Founding member");
  if (state.sub === "founder") titles.push("Founder+ member");
  else if (state.sub === "pro") titles.push("Pro member");
  for (const q of questStates(state)) {
    if (q.done && q.def.reward.title) titles.push(q.def.reward.title);
  }
  return titles;
}

/** Sanity: every reward emote must exist in EMOTES. */
for (const q of QUESTS) {
  if (q.reward.emote && !EMOTES.some((e) => e.kind === q.reward.emote)) {
    throw new Error(`quest ${q.id} rewards unknown emote ${q.reward.emote}`);
  }
}
