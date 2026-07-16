/**
 * FounderFloor — seed startups and booth dialogue.
 *
 * 25 startups, keyed by id, matching lib/data/floors.ts exactly:
 *   main-hall (8), indie-alley (5), ramen-district (6), cofounder-row (6).
 *
 * replyFor() drives every booth conversation: keyword-matched topics for seed
 * startups, synthesized generic replies for user-created ones (no dialogue).
 */

import type { Startup } from "@/lib/types";

export const STARTUPS: Record<string, Startup> = {
  // ======================================================================
  // MAIN HALL — the free floor, mixed $0-$3k
  // ======================================================================

  "soup-ticket": {
    id: "soup-ticket",
    name: "Soup Ticket",
    oneLiner: "Prepaid meal passes for lunch counters.",
    pitch:
      "Lunch counters sell ten-meal passes through us and get the cash upfront; regulars tap a QR code instead of losing a paper punch card. We take 5% and the shops keep the float. Forty-one delis and soup counters across three cities so far.",
    founder: "Marisol Vega",
    founderLook: { skin: 3, outfit: 2, hair: 5 },
    category: "Food",
    goal: "Reach $5k MRR",
    goalProgress: 0.38,
    verifiedRevenue: 1900,
    seekingCofounder: false,
    booth: {
      carpet: "#9E3B2B",
      banner: "#D97742",
      sign: "SOUP TICKET",
      glyph: "flask",
    },
    dialogue: {
      greeting:
        "HI hello welcome — have you eaten? Doesn't matter. Soup Ticket, prepaid meal passes for lunch counters. Ask me anything, I talk fast.",
      topics: [
        {
          keywords: ["soup", "deli", "lunch", "menu", "punch"],
          reply:
            "Best seller is a place in Queens that does a different bean soup every day. Their regulars buy the 20-pass. Twenty days of beans, committed upfront. That's loyalty.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "It's me, my sister doing the books, and a contractor in Porto. Not hiring — but I will trade soup for someone who can make thermal printers behave.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "My favorite soup place kept a shoebox of paper punch cards, and mine went through the wash. I built the first version in a weekend, out of spite and broth.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Next.js, Stripe, and a thermal printer driver I fought for three weeks. The printer won weeks one and two.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "We take 5% of every pass sold. Shops moved about $38k in passes last month, so we kept $1,900. Soup math.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "Reach $5k MRR — we're at about 40%. After that, bagel shops. Do NOT get me started on bagel shops.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Shops sell prepaid meal passes through us and customers redeem by QR. No app for the customer — that's the whole trick. Nobody downloads an app for soup.",
        },
      ],
      fallback:
        "Sorry, I heard 'soup' somewhere and my brain left. Ask me about the product, the money, or the goal.",
      connectReply:
        "YES, connected. If you're ever in Queens, Tuesday is white bean day. Life-changing.",
    },
  },

  "night-shift-audio": {
    id: "night-shift-audio",
    name: "Night Shift Audio",
    oneLiner: "Over-ear headphones you can fix with one screwdriver.",
    pitch:
      "Every part in our headphones — drivers, cups, cable — is user-replaceable with a single Phillips screwdriver, and we stock every part on the site. Podcast studios buy them because interns break everything. 240 pairs sold; most repairs run under $12.",
    founder: "Walt Brenner",
    founderLook: { skin: 1, outfit: 6, hair: 1 },
    category: "Hardware",
    goal: "Reach $4k a month in sales",
    goalProgress: 0.69,
    verifiedRevenue: 2750,
    seekingCofounder: false,
    booth: {
      carpet: "#2E3440",
      banner: "#5A6B8C",
      sign: "NIGHT SHIFT",
      glyph: "wave",
    },
    dialogue: {
      greeting:
        "Yeah, hi. Night Shift Audio. Headphones you can actually fix. Ask a real question, I'm not doing a pitch.",
      topics: [
        {
          keywords: ["headphone", "repair", "fix", "warranty", "driver", "part"],
          reply:
            "Warranty's simple: you break it, you buy the $9 part and fix it in four minutes. WE break it, that's called a defect, and I mail you the part with an apology written in pen. By me.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "No cofounder. Had one. He wanted to make an app. There's no app. They're headphones.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I fixed amps for thirty years and watched people junk $300 headphones over a $4 solder joint. Made me angry enough to start a company, which is the only correct reason to start one.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "The 'stack' is a CNC mill, a pick-and-place I bought at an auction, and a Shopify page my niece set up. Works fine.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$149 a pair, parts run $4 to $12. Did about $2,750 last month. No subscriptions. You buy a thing, you own the thing.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "Four grand a month and the workshop lease pays for itself. About seventy percent there. Then I hire somebody to answer emails so I can stop being polite.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Over-ears. One screwdriver opens everything. Drivers, cable, hinges — all replaceable, all in stock. That's it. That's the product.",
        },
      ],
      fallback:
        "Hm. Ask me about the headphones, the parts, or the money. I don't do small talk standing up.",
      connectReply: "Fine, we're connected. Don't make me regret owning a computer.",
    },
  },

  "crate-and-pallet": {
    id: "crate-and-pallet",
    name: "Crate & Pallet",
    oneLiner: "A marketplace for used pallets and shipping crates.",
    pitch:
      "Warehouses list surplus pallets and crates; buyers within trucking distance bid and we route the pickup. We charge 8% on trades and moved 11,000 pallets last quarter. The unglamorous parts of shipping are where the margin lives.",
    founder: "Dana Okafor",
    founderLook: { skin: 5, outfit: 4, hair: 0 },
    category: "Logistics",
    goal: "Reach $10k MRR",
    goalProgress: 0.3,
    verifiedRevenue: 3000,
    seekingCofounder: false,
    booth: {
      carpet: "#7A5C3E",
      banner: "#A9803F",
      sign: "CRATE&PALLET",
      glyph: "cube",
    },
    dialogue: {
      greeting:
        "Dana. Crate & Pallet. We move used pallets around. It's exactly as boring and profitable as it sounds.",
      topics: [
        {
          keywords: ["pallet", "crate", "warehouse", "truck", "shipping"],
          reply:
            "A grade-A 48-by-40 pallet trades at about $7.50 right now, up two dollars year over year. I can talk pallet futures for an hour. Nobody ever lets me.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Not looking. My cofounder is a spreadsheet named Rhonda and she has never once missed a standup.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I ran dock scheduling for a grocery chain and watched us pay to landfill pallets while the plant next door bought new ones. Two dumpsters, twenty meters apart. That was the whole pitch.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Postgres, a Rails monolith, and a phone number — because pallet guys do not fill out forms. The phone number is the real product.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Eight percent per trade. $3,000 last month, climbing steadily. Like a forklift: slow, but it carries weight.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "Ten thousand MRR; we're at thirty percent. After that, crates and drums. The exciting stuff.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Sellers list surplus, nearby buyers bid, we arrange the truck. Nobody warehouses anything, including us.",
        },
      ],
      fallback:
        "That's outside my lane. Try pallets, prices, or plans — those are the three things I have.",
      connectReply:
        "Connected. You now know a pallet person. This will be useful exactly once, and on that day you'll thank me.",
    },
  },

  gutterball: {
    id: "gutterball",
    name: "Gutterball",
    oneLiner: "League scheduling and dues software for bowling alleys.",
    pitch:
      "Alleys run their leagues on paper and a binder that one guy named Gary understands. Gutterball does schedules, standings, and dues collection for $79 a month per house. Eleven alleys signed, mostly in Wisconsin, which surprises no one.",
    founder: "Terry Kowalczyk",
    founderLook: { skin: 0, outfit: 1, hair: 3 },
    category: "B2B Software",
    goal: "Reach $2k MRR",
    goalProgress: 0.43,
    verifiedRevenue: 850,
    seekingCofounder: false,
    booth: {
      carpet: "#3E5A8C",
      banner: "#D9A13B",
      sign: "GUTTERBALL",
      glyph: "star",
    },
    dialogue: {
      greeting:
        "Well hey there! Terry, Gutterball — league software for bowling alleys. You bowl? Doesn't matter, everybody's welcome here.",
      topics: [
        {
          keywords: ["bowl", "league", "alley", "lane", "gary", "binder"],
          reply:
            "Every alley has a Gary — the one guy who understands the binder. My job is making the binder outlive Gary. Gary's a great guy. Gary needs a vacation.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "It's me, with my son-in-law on support weekends. Not officially looking for anybody, but I'd never turn down a chat over cheese curds.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I ran leagues at Ten Pin Terry's — yes, that Terry — for eighteen years. When I retired, the binder retired with me and the Tuesday league nearly collapsed. Felt responsible. Built this.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "My nephew built it in Django, and now I know what Django is. It syncs with the scoring machines over a cable that costs more than dinner.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Alleys pay $79 a month flat — no per-bowler nonsense. Eleven houses, $850 a month. Beer money, but it's growing.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "Two grand a month, which is about 25 houses. Little under halfway. Wisconsin first, then the world. Or at least Minnesota.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Schedules, standings, subs, and dues — the whole league binder, online, and it doesn't disappear when Gary goes to Florida.",
        },
      ],
      fallback:
        "Ha, you got me there. Ask about the leagues, the price, or how a retired bowling guy ends up at a startup expo.",
      connectReply:
        "Attaboy, connected! Swing by Ten Pin Terry's sometime — first game's on me, shoes are not.",
    },
  },

  fernworks: {
    id: "fernworks",
    name: "Fernworks",
    oneLiner: "Compostable packaging foam grown from mushroom mycelium.",
    pitch:
      "We grow protective packaging from mycelium and hemp waste in reusable molds; it composts in a garden in about 45 days. Two pilot customers — a candle company and a ceramics studio — are drop-testing it against foam-in-place right now. Pre-revenue, and honest about it.",
    founder: "June Hara",
    founderLook: { skin: 2, outfit: 3, hair: 6 },
    category: "Climate",
    goal: "First paying customer",
    goalProgress: 0,
    verifiedRevenue: 0,
    seekingCofounder: true,
    booth: {
      carpet: "#3F6B4F",
      banner: "#7FA65A",
      sign: "FERNWORKS",
      glyph: "leaf",
    },
    dialogue: {
      greeting:
        "Hi, I'm June. Fernworks — we grow packaging foam from mycelium. It's less weird than it sounds. Slightly less.",
      topics: [
        {
          keywords: ["mycelium", "mushroom", "compost", "foam", "packag", "material"],
          reply:
            "The material is mycelium bound through hemp hurd — it grows into the mold in five days, then we heat-treat it so it stops growing. Composts in about 45 days. I've tested that in my actual garden.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Yes — I need an operations cofounder. I can grow the material all day; scaling molds and logistics is a different organism entirely.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I did my postdoc on fungal binders and got tired of writing papers nobody outside the field read. Packaging foam is the least glamorous, highest-volume thing I could attack. So here I am, holding mushroom foam at a booth.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "The stack is biological: strain selection, substrate prep, climate-controlled growth. The software is a spreadsheet and a humidity sensor. Priorities.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Pre-revenue, and I'd rather say that plainly than dress it up. The pilots convert next quarter, or I learn something important.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "First paying customer. Zero percent of the way there by definition — but two pilots are running drop-tests against foam as we speak.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Protective packaging, grown to shape in reusable molds, home-compostable. It performs like EPS foam for anything under ten kilos.",
        },
      ],
      fallback:
        "I don't have a rehearsed answer for that, which is probably refreshing? Ask me about the material, the pilots, or the cofounder search.",
      connectReply:
        "Thank you — connected. If the pilots land, you can say you knew the mushroom company early.",
    },
  },

  ledgerline: {
    id: "ledgerline",
    name: "Ledgerline",
    oneLiner: "Reconciliation software for solo accountants.",
    pitch:
      "Ledgerline matches bank feeds against client ledgers and flags exceptions for one-person accounting practices. Practitioners pay $49 monthly per seat; we hold 45 subscribers. Our median user clears a month's reconciliation in under two hours, formerly an afternoon.",
    founder: "Preston Whitcombe",
    founderLook: { skin: 0, outfit: 7, hair: 2 },
    category: "Fintech",
    goal: "Reach $8k MRR",
    goalProgress: 0.28,
    verifiedRevenue: 2205,
    seekingCofounder: false,
    booth: {
      carpet: "#2C4A63",
      banner: "#3E7CB1",
      sign: "LEDGERLINE",
      glyph: "coin",
    },
    dialogue: {
      greeting:
        "Good day. Preston Whitcombe, of Ledgerline — reconciliation software for the sole-practitioner accountant. I welcome your questions and shall answer them precisely.",
      topics: [
        {
          keywords: ["reconcil", "ledger", "accountant", "bank", "exception", "books"],
          reply:
            "Our exception engine surfaces only what a practitioner must actually review — transposed digits, duplicated feeds, phantom reversals. The median month produces eleven exceptions. Elegance, in accounting, is a short list.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "I am not seeking a cofounder at present. I had one; we differed on the Oxford comma and, subsequently, on everything else.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "My father kept books for forty years and spent his Sundays reconciling by hand. I regret only that I built this four years after he retired. He tests it anyway, and files bug reports on paper.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "TypeScript throughout, a rules engine of my own design, and double-entry checks on every mutation. I do not use the word 'blockchain', and I would thank you not to either.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Forty-nine dollars per seat per month; forty-five subscribers; $2,205 in monthly recurring revenue. I quote it to the dollar because approximation is how ledgers die.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "Eight thousand in MRR, at which point I engage a part-time support person and reclaim my evenings. We stand at twenty-eight percent.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "We ingest bank feeds, match them against the client ledger, and present exceptions for human judgment. The software does the tedium; the accountant does the accounting.",
        },
      ],
      fallback:
        "I fear that falls outside my prepared remarks. Might I interest you in reconciliation, pricing, or the roadmap?",
      connectReply:
        "Very good — a connection, duly recorded. I shall follow up with the punctuality you deserve.",
    },
  },

  copydesk: {
    id: "copydesk",
    name: "Copydesk",
    oneLiner: "A style-guide linter for newsrooms and content teams.",
    pitch:
      "Copydesk checks drafts against your house style — hyphenation, titles, banned phrases — right inside Google Docs. Small newsrooms and content teams pay $29 a month per desk. We flag the word 'utilize' about 4,000 times a week and counting.",
    founder: "Rikki Tan",
    founderLook: { skin: 2, outfit: 0, hair: 7 },
    category: "Media",
    goal: "Reach $2.5k MRR",
    goalProgress: 0.24,
    verifiedRevenue: 600,
    seekingCofounder: false,
    booth: {
      carpet: "#7D3548",
      banner: "#C94F4F",
      sign: "COPYDESK",
      glyph: "star",
    },
    dialogue: {
      greeting:
        "Rikki, Copydesk. We lint prose against your style guide — yes, like a spellchecker with opinions. Go ahead, I've got four minutes to deadline out of habit.",
      topics: [
        {
          keywords: ["style", "grammar", "newsroom", "copy", "edit", "phrase"],
          reply:
            "House style is the stuff dictionaries won't settle: 'email' or 'e-mail', when titles get caps, which clichés are fired. Every newsroom fights these wars. We just write down who won.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Solo for now. Most of my old newsroom got laid off, so the talent pool is deep and bitter — my favorite kind.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I was a copy editor until the entire desk got cut in one afternoon. Twelve years of style rulings in my head and nowhere to put them. So I put them in software. Revenge, but make it SaaS.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "A rules engine over a parser, shipped as a Google Docs add-on, because that's where the bodies — sorry, the drafts — are. Some regex I'm proud of, some I'll deny writing.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$29 per desk per month — about $600 MRR from twenty desks. Journalists are broke; their content-marketing cousins are not, and they keep finding us.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$2.5k MRR — a quarter of the way there. That's the 'stop pretending this is a hobby' line.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "You load your style guide, we flag violations in the draft with the rule cited. Editors accept or overrule; the overrules become new rules. It compounds, like grudges.",
        },
      ],
      fallback:
        "That's off-topic, which as a former copy editor I'm required to flag. Ask about style, money, or the layoff story.",
      connectReply:
        "Connected. I'd say 'let's circle back' but Copydesk flags that phrase. Severity: high.",
    },
  },

  shelfware: {
    id: "shelfware",
    name: "Shelfware",
    oneLiner: "Bookmarks that come back when they're relevant.",
    pitch:
      "Shelfware saves your tabs, then resurfaces them when you're back on a related topic instead of letting them rot in a folder. It's a browser extension, $3 a month. Fifty paying users so far, mostly people with a thousand-plus open tabs. My people.",
    founder: "Miko Tanaka",
    founderLook: { skin: 2, outfit: 5, hair: 4 },
    category: "Devtools",
    goal: "Reach $1k MRR",
    goalProgress: 0.15,
    verifiedRevenue: 150,
    seekingCofounder: false,
    booth: {
      carpet: "#3C5E5A",
      banner: "#5F8C87",
      sign: "SHELFWARE",
      glyph: "cube",
    },
    dialogue: {
      greeting:
        "Oh — hi. Um. Shelfware. It's a bookmarks thing. Sorry, I'm better at the code than the booth.",
      topics: [
        {
          keywords: ["tab", "bookmark", "browser", "extension", "hoard", "save"],
          reply:
            "My record user has 4,200 saved tabs. We found each other. The extension resurfaced a research tab from eight months back at exactly the right moment for her, and she sent me a very long, very kind email. I printed it.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Oh, um. Not right now. Maybe someday — if they're patient, and also don't like meetings.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I had 900 open tabs and a browser crash took... everything. I cried a little, then built this. It's a memorial, technically.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Browser extension in TypeScript, local-first — embeddings run in WASM on your machine and nothing leaves it. That part matters to me a lot.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "It's $3 a month. Fifty subscribers, so $150. It pays for my coffee, and coffee pays for the code, so the system works.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$1k MRR. I'm at fifteen percent. If I get there, I go part-time at my job. I haven't told my job that.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "You save tabs, and instead of dying in a folder they resurface when you revisit the topic. Passive. Quiet. Like me.",
        },
      ],
      fallback: "Um, I'm not sure — sorry. Ask about tabs? Or the price? Those I can do.",
      connectReply: "Oh! Thank you. Connected. That's... yeah. Thanks. That's really nice.",
    },
  },

  // ======================================================================
  // INDIE ALLEY — small booths, $0-$800
  // ======================================================================

  mudroom: {
    id: "mudroom",
    name: "Mudroom",
    oneLiner: "Scheduling and routing for mobile dog groomers.",
    pitch:
      "Mobile groomers live in their vans and lose bookings to voicemail. Mudroom handles booking, deposits, and drive-time-aware routing for $24 a month per van. Twenty vans onboard, and the top feature request is, and will always be, 'block off aggressive doodles'.",
    founder: "Priya Nair",
    founderLook: { skin: 4, outfit: 2, hair: 3 },
    category: "Services",
    goal: "Reach $1.5k MRR",
    goalProgress: 0.32,
    verifiedRevenue: 480,
    seekingCofounder: false,
    booth: {
      carpet: "#6B4A32",
      banner: "#A67B4F",
      sign: "MUDROOM",
      glyph: "heart",
    },
    dialogue: {
      greeting:
        "Hi! Priya, from Mudroom — scheduling for mobile dog groomers. Ask me anything, I've heard much weirder questions from groomers, I promise.",
      topics: [
        {
          keywords: ["dog", "groom", "van", "doodle", "pet"],
          reply:
            "Doodles. Whatever your question was, the answer is doodles. Sixty percent of bookings, ninety percent of incident reports. We literally shipped a per-groomer doodle-tolerance setting.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Not right now — my brother does the books and my dog does morale. But I keep a list of people I'd call the day it makes sense.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "My cousin grooms out of a Sprinter van and ran the whole business on a paper calendar and rage. I built her a scheduler for her birthday. Her groomer friends demanded it. Happy birthday to me.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Rails and Postgres, Twilio for reminders, and a routing layer that respects the sacred rule: no groomer crosses the bridge twice in one day.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$24 a month per van, twenty vans, $480 MRR. Groomers pay it happily — one saved no-show covers the month.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$1,500 a month — about a third of the way. That's 60 vans, which is honestly one good regional Facebook group.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Online booking, deposits so no-shows hurt less, and routes ordered by drive time. The groomer just drives, clips, and gets paid.",
        },
      ],
      fallback: "Hmm, that one's new! Try me on the product, the vans, or the money.",
      connectReply: "Connected! If you have a doodle: no judgment. Some judgment. Connected though!",
    },
  },

  "zine-machine": {
    id: "zine-machine",
    name: "Zine Machine",
    oneLiner: "Risograph print-on-demand for zines and art prints.",
    pitch:
      "Artists upload zines, we print them on actual risographs — the soy-ink duplicators with colors screens can't reproduce — and ship straight to their buyers. We take $2 a copy plus print cost. About 40 artists, 160 zines shipped last month.",
    founder: "Beto Reyes",
    founderLook: { skin: 3, outfit: 0, hair: 2 },
    category: "Media",
    goal: "Reach $2k MRR",
    goalProgress: 0.16,
    verifiedRevenue: 320,
    seekingCofounder: false,
    booth: {
      carpet: "#4A3A6B",
      banner: "#D45C9E",
      sign: "ZINE MACHINE",
      glyph: "star",
    },
    dialogue: {
      greeting:
        "Hey. Beto. Zine Machine — riso printing for people whose art is too weird for Amazon. Which is a compliment, to be clear.",
      topics: [
        {
          keywords: ["riso", "zine", "print", "ink", "art", "beverly"],
          reply:
            "Riso ink is soy-based and the colors are physically impossible on your screen — a fluorescent pink that hums. Every copy comes out slightly imperfect, which is the point. Perfection is for inkjets and cowards.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "It's a collective-ish situation — me plus two printers who take equity in ink. A real cofounder? Maybe. They'd have to pass the vibe check, which is rigorous and undocumented.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "The riso at my art school was the most in-demand machine on campus and it lived in a closet. I graduated, bought a broken one at auction for $200, fixed it, and never applied for a real job. So far so good.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "The site is plain Django. The real tech is a 1998 Risograph GR3750 named Beverly. Beverly is temperamental. Beverly is the whole company.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$2 a copy plus print cost — did $320 last month. Artists keep the rest, which is the entire reason this exists.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$2k a month keeps Beverly in ink and me in rent. Sixteen percent there. Zine economy rising.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Artists upload, we print on riso, we ship to their buyers. No minimums. Your run of seven copies is safe with us.",
        },
      ],
      fallback:
        "Huh. Not a zine question, but I respect the range. Ask about the printing, the money, or Beverly.",
      connectReply:
        "Connected. You get a free fluorescent-pink bookmark if you ever visit the shop. Beverly insists.",
    },
  },

  coldframe: {
    id: "coldframe",
    name: "Coldframe",
    oneLiner: "Frost alerts for market gardeners, by text.",
    pitch:
      "We put a $40 sensor in your field and text you before frost hits your actual crops — not the airport ten miles away where the forecast gets measured. Growers pay $10 a month per field. Nineteen farms so far; we've saved two tomato plantings I know by name.",
    founder: "Annie Kruse",
    founderLook: { skin: 1, outfit: 3, hair: 0 },
    category: "Climate",
    goal: "100 paying growers",
    goalProgress: 0.19,
    verifiedRevenue: 190,
    seekingCofounder: true,
    booth: {
      carpet: "#38596B",
      banner: "#6FA3BF",
      sign: "COLDFRAME",
      glyph: "leaf",
    },
    dialogue: {
      greeting:
        "Morning — well, whatever it is in here. Annie Kruse, Coldframe. Frost alerts from your own field, not the airport's. Go ahead.",
      topics: [
        {
          keywords: ["frost", "farm", "field", "sensor", "tomato", "weather", "crop"],
          reply:
            "The airport forecast said 38 degrees; my field hit 30, and I lost 400 tomato plants before I built this. The airport is not growing tomatoes. Measure where it matters.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Yes, actually. I need someone who knows hardware at scale — I can solder nineteen sensors, I can't solder nineteen hundred. You bring the factory brain, I bring every grower in three counties.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "Fourth-generation grower. First generation to lose a planting and then do something about it besides swearing at the sky. Though there was also swearing.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "LoRa sensors I assemble in the barn, a Raspberry Pi gateway, Twilio for the texts. The barn is climate-controlled — more than I can say for the fields, hence the business.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Ten dollars a month per field, nineteen farms paying. A saved planting is worth thousands, so nobody haggles.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "One hundred paying growers; nineteen there. That's not a valuation story — that's a hundred people who keep their tomatoes.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Sensor in your field, text on your phone: 'Frost likely by 4am, block 3.' You go cover the rows. That's the whole thing, and it works.",
        },
      ],
      fallback:
        "You've stumped the farmer. Try frost, the sensors, or the cofounder search — that last one I genuinely want to talk about.",
      connectReply: "Good, connected. Frost doesn't wait and neither should you.",
    },
  },

  patchbay: {
    id: "patchbay",
    name: "Patchbay",
    oneLiner: "Route, inspect, and replay webhooks like a patchbay.",
    pitch:
      "Patchbay sits between webhook senders and your endpoints: inspect payloads, replay failures, and reroute streams without touching code. Free while in beta; the paid tier lands next month. Built by an ex-live-sound engineer who believes all routing problems are the same problem.",
    founder: "Sam Ercolano",
    founderLook: { skin: 1, outfit: 5, hair: 7 },
    category: "Devtools",
    goal: "Ship v1 and land 10 paying teams",
    goalProgress: 0.7,
    verifiedRevenue: 0,
    seekingCofounder: true,
    booth: {
      carpet: "#333A45",
      banner: "#E0A458",
      sign: "PATCHBAY",
      glyph: "bolt",
    },
    dialogue: {
      greeting:
        "Hey, Sam. Patchbay — webhook routing that behaves like the patchbays I used to wire at gigs. Signal in, signal out, no mystery hum.",
      topics: [
        {
          keywords: ["webhook", "replay", "payload", "endpoint", "route", "event"],
          reply:
            "The replay feature is the whole show. A payment webhook fails at 2am, you fix the bug at 9, hit replay, and the exact original payload runs again. No begging Stripe for a resend.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Open to it, honestly. I'm strong on the engine, weaker on telling people it exists. If you can sell to developers without making them itch, let's talk.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I wired stage patchbays for touring bands for a decade. First week at a software job, I watched a team lose a whole day to one lost webhook and thought: you people need a patchbay. Turns out they did.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Go for the ingest tier, Postgres for payload storage, TypeScript dashboard. Payloads are encrypted at rest, because I've read other people's webhooks and nobody should.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Free in beta, $20 a seat when v1 ships. Zero revenue today, on purpose. Ask me again next month and bring confetti.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "Ship v1, land ten paying teams. The build is about 70% there. The teams are at zero, which is what the booth is for.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Point your webhooks at us and we fan them out to your endpoints. Inspect anything, replay anything, reroute live — like re-patching a channel mid-song, except nobody's sweating on stage.",
        },
      ],
      fallback: "Dead channel — try again. Webhooks, the beta, or the sound-guy years all get signal.",
      connectReply: "Patched in. Connection's clean, no hum. Good to meet you.",
    },
  },

  loafer: {
    id: "loafer",
    name: "Loafer",
    oneLiner: "We board and feed your sourdough starter while you travel.",
    pitch:
      "You mail us your starter or drop it off; we feed it on schedule, send photo updates, and return it alive — $12 a week. Sixty boarders last month, so yes, people pay it. The photo updates began as a joke feature. They are now the most-loved feature.",
    founder: "Greta Holm",
    founderLook: { skin: 0, outfit: 4, hair: 6 },
    category: "Food",
    goal: "Reach $2k MRR",
    goalProgress: 0.38,
    verifiedRevenue: 760,
    seekingCofounder: false,
    booth: {
      carpet: "#8C6B3E",
      banner: "#D9B36C",
      sign: "LOAFER",
      glyph: "heart",
    },
    dialogue: {
      greeting:
        "Welcome to Loafer. We are a boarding kennel for sourdough starters. I am taking no further questions about whether this is real. It is. Other questions: yes, go ahead.",
      topics: [
        {
          keywords: ["sourdough", "starter", "bread", "feed", "yeast", "board"],
          reply:
            "Every starter arrives with a name. Bartholomew, Doughlene, Clint Yeastwood — twice. We feed rye or wheat per the owner's instructions, which run to two pages more often than you would hope.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply: "No. The starters and I have an understanding, and a third party would complicate the hierarchy.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "My neighbor asked me to feed her starter for two weeks and paid me in bread. I mentioned it online as a joke and woke up to forty requests. The market speaks; sometimes it burbles.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "A booking page, a fridge dashboard with temperature logging, and a labeling system I will defend with my life. The hard tech is not killing anything. Ten months, zero casualties.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Twelve dollars a week per starter. Sixty boarders last month — $760. The margins on flour and attention are excellent.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "Two thousand a month, then a second fridge. We're at 38%. The second fridge already has a name. I won't be sharing it.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "You travel; your starter stays with us, gets fed on schedule, and you receive photo updates you will absolutely show to strangers. Then it comes home alive. Guaranteed.",
        },
      ],
      fallback:
        "That question has never been asked inside this booth, which is saying something. Try the starters, the price, or the origin story.",
      connectReply: "Connected. Should you ever acquire a starter, you now know where it summers.",
    },
  },

  // ======================================================================
  // RAMEN DISTRICT — verified revenue only, $1k-$40k
  // ======================================================================

  wrenchlist: {
    id: "wrenchlist",
    name: "Wrenchlist",
    oneLiner: "Service scheduling and job tracking for bike shops.",
    pitch:
      "Shops take repair bookings online and mechanics get a job queue with parts flagged before the stand gets blocked. Shops pay $59 a month per location; 71 shops onboard. The average shop clears two extra repairs a week just from not playing phone tag.",
    founder: "Omar Haddad",
    founderLook: { skin: 4, outfit: 6, hair: 1 },
    category: "B2B Software",
    goal: "Reach $10k MRR",
    goalProgress: 0.42,
    verifiedRevenue: 4200,
    seekingCofounder: false,
    booth: {
      carpet: "#4F4A3A",
      banner: "#C25E33",
      sign: "WRENCHLIST",
      glyph: "bolt",
    },
    dialogue: {
      greeting:
        "Hey, Omar. Wrenchlist — service software for bike shops. Fifteen years on the repair stand, two on the laptop. What do you want to know?",
      topics: [
        {
          keywords: ["bike", "mechanic", "repair", "shop", "derailleur", "stand"],
          reply:
            "Biggest win is parts-flagging: the system checks stock the moment a job's booked, so the bike isn't hanging in the stand for a week waiting on a derailleur hanger. A blocked stand is dead money.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Got a technical partner already — she rebuilt the scheduler while I rebuilt a wheel. Fair trade. We're not looking, but good mechanics-turned-anything should say hi anyway.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I wrenched for fifteen years and the shop's 'system' was a clipboard and Dave's memory. Dave quit. The clipboard did not step up. I taught myself to code out of necessity — the best teacher, and the meanest.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Laravel and Postgres. Boring on purpose — shop wifi is held together with zip ties, so everything works offline and syncs later. Like a good hub: no drama.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$59 a month per shop, 71 shops, $4,200 MRR. Churn is nearly zero, because going back to the clipboard is unthinkable once you've quit it.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$10k MRR — 42% of the way. That's about 170 shops, and there are 9,000 in the country, so I like the road ahead.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Customers book online, jobs land in a queue, parts get flagged early, texts go out when the bike's ready. Nothing fancy. Shops don't want fancy — they want Saturday to not be chaos.",
        },
      ],
      fallback:
        "That's either above my pay grade or below my interest, can't tell which. Try the shops, the money, or the roadmap.",
      connectReply: "Connected. Keep your chain lubed and your calendar drier than shop wifi.",
    },
  },

  "sheet-metal": {
    id: "sheet-metal",
    name: "Sheet Metal",
    oneLiner: "We turn load-bearing spreadsheets into real software.",
    pitch:
      "Every mid-size company has one spreadsheet that runs the business and terrifies everyone. We rebuild it as a boring, tested web app in six weeks for a flat fee, then charge a retainer for hosting and changes. Fourteen rebuilds shipped; the record was a 214-tab workbook that priced industrial insurance.",
    founder: "Chip Delaney",
    founderLook: { skin: 1, outfit: 7, hair: 3 },
    category: "B2B Software",
    goal: "Reach $50k MRR",
    goalProgress: 0.68,
    verifiedRevenue: 34000,
    seekingCofounder: false,
    booth: {
      carpet: "#4A4E57",
      banner: "#8C9BAA",
      sign: "SHEET METAL",
      glyph: "chip",
    },
    dialogue: {
      greeting:
        "Chip Delaney, Sheet Metal. We productize the transition of load-bearing spreadsheets into actual software. Sorry — consulting brain. We fix scary Excel. Ask away.",
      topics: [
        {
          keywords: ["spreadsheet", "excel", "vlookup", "macro", "workbook", "tab"],
          reply:
            "The worst one had 214 tabs, a macro written in 2009 by a man named Gord, and one cell that re-priced every insurance policy in Ontario if you breathed on it. We approached it like bomb disposal. Six weeks later it was a web app with tests.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Two partners, four engineers — the partnership workstream is fully staffed, as it were. But engineers who enjoy forensic archaeology? Always interviewing.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "Eleven years in consulting, and every engagement ended at the same artifact: a spreadsheet nobody would touch. I stepped off the partner track to go touch the spreadsheets. My old firm now subcontracts us, which is delicious.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "We rebuild into TypeScript and Postgres, with tests generated from the workbook's own outputs — the spreadsheet becomes its own spec. Rule one of the delivery workstream: the app must give the same answers as the sheet, including the wrong ones, until the client signs off on fixing them.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Flat-fee rebuild, then hosting and change requests on retainer. The recurring piece is at $34k a month across fourteen clients. To use a term I'm trying to quit: the flywheel workstream is spinning.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$50k MRR in recurring; we're at 68%. Then we stand up a third delivery pod and I finally take the vacation I keep scoping and descoping.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Six-week engagement: we interview the sheet's keeper, extract the logic, rebuild it as a web app, and run both in parallel until the numbers match. Then the spreadsheet retires with honor. Sometimes there's a small ceremony.",
        },
      ],
      fallback:
        "Let me park that in the backlog and circle — no. No. Ask me about spreadsheets, revenue, or the roadmap, and I'll answer like a person.",
      connectReply:
        "Connected — and I mean that as a human being, not as a synergy. Bring me your worst workbook someday.",
    },
  },

  barnacle: {
    id: "barnacle",
    name: "Barnacle",
    oneLiner: "Slip booking and billing software for small marinas.",
    pitch:
      "Marinas under 200 slips still run on whiteboards and grudges. Barnacle handles slip assignments, seasonal contracts, and billing for $99 to $299 a month depending on size. 38 marinas live, mostly East Coast, every one of them owed money by somebody named Gus.",
    founder: "Sal Moretti",
    founderLook: { skin: 2, outfit: 6, hair: 0 },
    category: "B2B Software",
    goal: "Reach $8k MRR",
    goalProgress: 0.81,
    verifiedRevenue: 6500,
    seekingCofounder: false,
    booth: {
      carpet: "#2E5460",
      banner: "#4F8C99",
      sign: "BARNACLE",
      glyph: "wave",
    },
    dialogue: {
      greeting:
        "Sal. Barnacle. Marina software. Thirty years on the docks, five writing invoices for people who own boats and claim poverty. Ask your questions.",
      topics: [
        {
          keywords: ["marina", "boat", "slip", "dock", "harbor", "gus"],
          reply:
            "Every marina has a Gus — owes for two seasons, boat hasn't moved since the Obama administration, everybody likes him too much to tow it. Barnacle doesn't tow Gus. It just makes his tab a number instead of a rumor.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "My daughter writes the code, I sell to the harbormasters. Family business, like a chowder recipe. We're set.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "Ran a 120-slip marina for thirty years off a whiteboard. Sold it, got bored in eleven days, turned the whiteboard into software. The whiteboard's in my garage now. Sentimental.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "My daughter says it's Elixir and Postgres, and that I should stop calling the server 'the machine'. It's run through three nor'easters without blinking, which is the only benchmark that matters.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$99 to $299 a month by slip count. $6,500 MRR from 38 marinas. Boat people pay eventually — the software just remembers longer than I do.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$8k a month — we're at 81%, so basically one more boat show. Then the Great Lakes, where the water's fresh and the invoices are just as salty.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Slip map, seasonal contracts, waitlists, billing that chases itself. The harbormaster opens one screen and knows who's in, who's out, and who's Gus.",
        },
      ],
      fallback:
        "You're asking the wrong dock. Try slips, money, or thirty years of marina stories — I've got all day for that last one.",
      connectReply: "Connected. If you ever buy a boat: don't. But if you do, I know a good slip.",
    },
  },

  "on-call-room": {
    id: "on-call-room",
    name: "On-Call Room",
    oneLiner: "Shift swaps for nurses that clear in minutes, not group texts.",
    pitch:
      "Nurses post shifts, qualified colleagues claim them, and the charge nurse approves in one tap — credentials and overtime rules checked automatically. Hospitals pay per unit per month. Three hospital systems live; the median swap clears in 19 minutes, down from a day and a half of group-text chaos.",
    founder: "Yolanda Pierce",
    founderLook: { skin: 5, outfit: 1, hair: 5 },
    category: "Health",
    goal: "Reach $25k MRR",
    goalProgress: 0.5,
    verifiedRevenue: 12500,
    seekingCofounder: false,
    booth: {
      carpet: "#2E5C55",
      banner: "#4FA396",
      sign: "ON-CALL ROOM",
      glyph: "heart",
    },
    dialogue: {
      greeting:
        "Hi — Yolanda Pierce, On-Call Room. Twelve years a nurse, two years building the shift-swap tool I needed the whole time. What can I answer?",
      topics: [
        {
          keywords: ["nurse", "shift", "swap", "hospital", "charge", "icu", "unit"],
          reply:
            "The rules engine is the hard part nobody sees: license type, unit competencies, overtime thresholds, union rules. A swap only appears if you're actually allowed to take it — which is why charge nurses approve in one tap instead of playing detective at 5am.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "I've got a technical cofounder — met him when he was my patient, which is a story I tell better over coffee. Team of six, half ex-clinical. We hire nurses who code before coders who've never held a med pass.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I missed my sister's wedding rehearsal because a swap died in a group text with 47 unread messages. I stood in a supply closet and decided that was the last time. It was.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "React Native for the nurses, a Python rules engine for the compliance math, and HL7 integrations with the scheduling systems hospitals already run. Boring integrations are 70% of the work and 100% of the moat.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Hospitals pay per unit per month — a mid-size system runs about $4k. We're at $12,500 MRR across three systems. Nurses never pay. That's a line, not a strategy.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$25k MRR — exactly halfway. One more system signs and we cross it. Then I hire a second implementation lead so I can stop living in airports.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Post a shift, qualified colleagues see it, one claims it, charge nurse approves. Nineteen minutes, median. The group text is dead; long live the group text, somewhere else.",
        },
      ],
      fallback: "Not my chart, but I'll take vitals anyway — ask me about swaps, hospitals, or the money.",
      connectReply: "Connected. Nurses remember who showed up for them. Consider yourself remembered.",
    },
  },

  "lower-third": {
    id: "lower-third",
    name: "Lower Third",
    oneLiner: "Broadcast-grade graphics for streamers and tiny newsrooms.",
    pitch:
      "Lower Third gives one-person broadcasts the graphics package of a network — titles, tickers, scoreboards, all driven from a browser tab. Streamers pay $15 a month, stations pay $150. A high-school sports league in Ohio runs 40 broadcasts a week on us, which is 40 more than ESPN does.",
    founder: "Dev Chandra",
    founderLook: { skin: 4, outfit: 0, hair: 4 },
    category: "Media",
    goal: "Reach $6k MRR",
    goalProgress: 0.48,
    verifiedRevenue: 2900,
    seekingCofounder: false,
    booth: {
      carpet: "#3A2E5C",
      banner: "#7A5BC2",
      sign: "LOWER THIRD",
      glyph: "star",
    },
    dialogue: {
      greeting:
        "Hey hey — Dev, Lower Third. Broadcast graphics in a browser tab. I've had three espressos and I think in 4K, ask me anything.",
      topics: [
        {
          keywords: ["graphic", "stream", "broadcast", "ticker", "scoreboard", "obs", "ruth"],
          reply:
            "It's one browser source in OBS. Titles, tickers, live scoreboards — a producer edits a Google Sheet and the graphics change on air. The Ohio league's scoreboard operator is a 68-year-old grandmother named Ruth and she has never missed a cue. Ruth is the benchmark.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Solo, plus contractors and a Discord of superusers who behave like unpaid staff, bless them. A cofounder? If they can sell to TV stations without wearing a suit, espresso's on me.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I directed a local morning show where the graphics machine was older than the intern. It died on air during a school-closing ticker. Snow day, no ticker, phones melting. Built the first version that weekend, still slightly angry.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Everything renders in the browser — WebGL, WebSockets for live data — and OBS just eats the page as a source. No install, no dongle, no $40k box from a company that stopped answering the phone in 2019.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$15 a month for streamers, $150 for stations. $2,900 MRR total, and the station tier is growing fastest. Local TV budgets are tiny but they are LOYAL.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$6k MRR — 48% there. Milestone after that: every high-school championship in three states running a real scoreboard bug. Dream big, render bigger.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Pick a template, wire it to a sheet or our dashboard, drop the browser source into OBS, and you look like a network. Setup is fifteen minutes. Ruth did it in nine.",
        },
      ],
      fallback:
        "Whoa, off-script — love it, no graphics package for it though. Hit me on streaming, pricing, or the snow-day story.",
      connectReply:
        "Connected! Your name would look incredible in a lower third, just saying. The font's called Industry. You'd love it.",
    },
  },

  dunning: {
    id: "dunning",
    name: "Dunning",
    oneLiner: "Politely relentless invoice chasing for freelancers.",
    pitch:
      "Dunning sends escalating, human-sounding payment reminders on your behalf, so the awkwardness is ours and the money is yours. Freelancers pay $19 a month; we recovered $1.4M in overdue invoices last year. Tone settings range from 'gentle nudge' to 'disappointed headmistress'.",
    founder: "Fiona Marsh",
    founderLook: { skin: 0, outfit: 3, hair: 7 },
    category: "Fintech",
    goal: "Reach $12k MRR",
    goalProgress: 0.62,
    verifiedRevenue: 7400,
    seekingCofounder: false,
    booth: {
      carpet: "#31513F",
      banner: "#63915B",
      sign: "DUNNING",
      glyph: "coin",
    },
    dialogue: {
      greeting:
        "Hello — Fiona, from Dunning. We chase your unpaid invoices with impeccable manners. Ask whatever you like; I'm considerably less frightening than my emails.",
      topics: [
        {
          keywords: ["invoice", "overdue", "remind", "chase", "late", "debt", "tone"],
          reply:
            "The escalation ladder has five rungs, from 'just floating this to the top of your inbox' to a final notice so courteous it has made grown procurement managers apologise. Rung four — 'disappointed headmistress' — recovers 31% on its own.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "No cofounder, thank you. I once co-owned a horse, and the experience covered everything I needed to know about shared ownership.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I freelanced for a decade and spent more time chasing money than earning it. The last straw was a client who owed nine thousand pounds and sent a Christmas card. I built Dunning; he was, with some ceremony, the first debtor through the system. He paid in six days.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Ruby, Postgres, and a tone engine that is essentially a very opinionated template system, reviewed by an actual former headmistress. She invoices us promptly, as you'd expect.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$19 monthly, unlimited chasing — $7,400 MRR from roughly 390 freelancers. We also chart your average days-to-payment falling, which subscribers frame. Emotionally, if not literally.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$12k MRR — 62% of the way. After that, small agencies, whose unpaid invoices are larger and whose patience is thinner.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Connect your invoicing tool, choose a tone, and we send escalating reminders signed by 'the accounts team' — which is us. You remain the lovely creative; we remain the ones who mention the late fee.",
        },
      ],
      fallback:
        "I'm afraid that's outside my brief, though asked with charm. Do try invoices, pricing, or the origin story — the Christmas card features.",
      connectReply: "Connected — how nice. Rest assured this is the only reminder I shall ever send you.",
    },
  },

  // ======================================================================
  // CO-FOUNDER ROW — everyone here is looking for a partner
  // ======================================================================

  "second-stove": {
    id: "second-stove",
    name: "Second Stove",
    oneLiner: "Scheduling and billing for shared commercial kitchens.",
    pitch:
      "Commissary kitchens juggle thirty food businesses on one calendar — usually a laminated one. Second Stove books hours, meters usage, and bills automatically for $199 a month per kitchen. Six kitchens live, with 140 food businesses cooking through them.",
    founder: "Marco Beltrán",
    founderLook: { skin: 3, outfit: 6, hair: 2 },
    category: "Food",
    goal: "Reach $6k MRR",
    goalProgress: 0.18,
    verifiedRevenue: 1100,
    seekingCofounder: true,
    booth: {
      carpet: "#7A2E2E",
      banner: "#D96C3F",
      sign: "SECOND STOVE",
      glyph: "flask",
    },
    dialogue: {
      greeting:
        "Hey. Marco. Second Stove — software for shared commercial kitchens. Fifteen years cooking, one year sleeping. What do you want to know?",
      topics: [
        {
          keywords: ["kitchen", "commissary", "chef", "cook", "food", "hood"],
          reply:
            "A commissary at 2am is the most honest place in food — the tamale lady handing the fryer over to the cookie guy. The fights are never about money; they're about who left the hood dirty. So we track hood time. Seriously. It ended the wars.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Yes — I need a technical cofounder. I can sell every commissary in the state; I cannot keep duct-taping the billing code at midnight. You build, I sell, and we split it like family meal: fairly, and with respect.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I ran a tamale business out of a shared kitchen and lost my Saturday slot twice to a double-booking on a laminated calendar. You don't forget lost Saturdays in food. You build software about them, apparently.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "A contractor built the first version in Node; I've since learned enough to be dangerous, which the codebase reflects. This is me saying I need help, in the pitch, out loud.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Kitchens pay $199 a month; six kitchens, about $1,100 MRR. A kitchen makes it back on one recovered double-booking. I know the math because I WAS the double-booking.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$6k MRR — 18% there. That's thirty kitchens. There are four hundred commissaries in California alone. The tamale math checks out.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Food businesses book hours online, badge in, and the system meters usage and bills automatically. The laminated calendar is retired to the office wall, where it can't hurt anyone.",
        },
      ],
      fallback:
        "That's not on tonight's menu, but ask me about the kitchens, the money, or the cofounder search and I'll cook something up.",
      connectReply: "Connected, good. If you can code and you like tamales, we should talk twice.",
    },
  },

  glasshouse: {
    id: "glasshouse",
    name: "Glasshouse",
    oneLiner: "Retrofit climate control for small commercial greenhouses.",
    pitch:
      "We retrofit existing greenhouses with sensors and vent and irrigation controllers — no rebuild, one afternoon of installation. Growers pay $2,400 for hardware plus $40 monthly per greenhouse. Eleven installs so far, with a measured 9% average yield bump I will happily show you.",
    founder: "Ingrid Voss",
    founderLook: { skin: 0, outfit: 5, hair: 0 },
    category: "Climate",
    goal: "Reach $10k MRR",
    goalProgress: 0.32,
    verifiedRevenue: 3200,
    seekingCofounder: true,
    booth: {
      carpet: "#3E6B54",
      banner: "#A3C585",
      sign: "GLASSHOUSE",
      glyph: "leaf",
    },
    dialogue: {
      greeting:
        "Good afternoon. Ingrid Voss, Glasshouse — we retrofit climate control into existing greenhouses. I prefer precise questions, but I will accept enthusiastic ones.",
      topics: [
        {
          keywords: ["greenhouse", "vent", "irrigation", "yield", "grower", "plant", "climate"],
          reply:
            "Retrofit is the entire thesis. There are two million small greenhouses that will never be rebuilt as smart ones. Our controllers bolt onto whatever vents and valves exist — some of my installs are older than I am, and they now email me their humidity.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Yes, and I will be specific: I need a firmware cofounder. My control algorithms are sound; my embedded C is agronomist-grade, which is a polite way of saying the vents once opened at 3am for no defensible reason.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "I advised greenhouse growers for nine years, and every recommendation died at the same sentence: 'the new system costs more than the greenhouse.' So I built one that doesn't. The prototype ran on my mother's tomatoes. She reports a career-best year, though she is not an unbiased reviewer.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software", "firmware"],
          reply:
            "ESP32 controllers on a LoRa mesh, sensors for temperature, humidity, and soil moisture, and a control loop tuned per crop. The dashboard is deliberately dull. Excitement, in a greenhouse, means something has gone wrong.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$2,400 for the retrofit kit, then $40 per month per greenhouse. $3,200 in monthly recurring across eleven sites, hardware margin on top. Growers recoup the kit in roughly one prevented crop incident.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$10k in monthly recurring — 32% of the way. That's roughly eighty greenhouses, or two good regional grower conferences. I have booked three.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Sensors, vent and valve controllers, and a control loop that holds your setpoints day and night. You get a text before problems, not after. The 9% yield figure is measured, not marketed.",
        },
      ],
      fallback:
        "I don't have data on that, so I'll refrain from an opinion. Ask about the retrofit, the numbers, or the firmware search.",
      connectReply:
        "Connected — noted with precision. If you know embedded engineers who like plants, my inbox is open and my vents are occasionally haunted.",
    },
  },

  rebar: {
    id: "rebar",
    name: "Rebar",
    oneLiner: "Photo records for concrete pours, before the concrete hides them.",
    pitch:
      "Crews photograph rebar and embeds against a checklist before every pour; Rebar timestamps, geotags, and files it all against the drawing set. When a dispute surfaces two years later, the answer is three taps away. GCs pay $299 a month per active site; 52 sites live.",
    founder: "Victor Osei",
    founderLook: { skin: 5, outfit: 6, hair: 1 },
    category: "Construction",
    goal: "Reach $25k MRR",
    goalProgress: 0.62,
    verifiedRevenue: 15500,
    seekingCofounder: true,
    booth: {
      carpet: "#57534A",
      banner: "#D9822B",
      sign: "REBAR",
      glyph: "cube",
    },
    dialogue: {
      greeting:
        "Victor Osei — call me Vic. Rebar. We photograph what goes INTO the concrete before the concrete swallows it. Twenty years on sites; ask me anything, I talk loud, it's from the jackhammers.",
      topics: [
        {
          keywords: ["concrete", "pour", "site", "construction", "inspection", "embed", "conduit"],
          reply:
            "Once concrete cures, everything inside it becomes a rumor. Was the conduit there? Was the rebar spaced right? A $40k dispute settles in one tap when the photo shows the embed — timestamped, geotagged, tied to the drawing. Concrete forgets nothing and proves nothing. We do the proving.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "YES. I need a technical cofounder who can own the product end to end. I've got 52 sites and a waitlist; my contract dev is great but he's got a day job. You build it right, and I'll fill your calendar with GCs who pay on net-15.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "Two years back a client swore we'd skipped conduit in a slab. We hadn't. Cost us $60k and a jackhammer weekend to prove it — the conduit was RIGHT THERE. After that I photographed every pour with a $99 phone and a folder system. GCs started asking for the folder system. The folder system got ambitious.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "React Native app, works offline because job sites have the connectivity of a mineshaft, syncs back at the trailer. Photos are hash-stamped at capture so nobody can claim doctoring — that alone has won two disputes.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "$299 a month per active site. 52 sites, $15,500 monthly. One avoided dispute pays for a decade of it — the GCs did that math faster than I could say it.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$25k MRR, sitting at 62%. After that: steel, waterproofing, anything that gets covered up. Construction is one long game of hiding things that had better be right.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Checklist by pour zone, crew shoots the photos, everything files itself against the drawing set. Two years later a lawyer calls, you answer in three taps, and you go back to lunch.",
        },
      ],
      fallback:
        "You lost me, and I pour foundations for a living, so that's on the question. Hit me with concrete, money, or the cofounder search.",
      connectReply:
        "CONNECTED. Good handshake, even digitally. If you ever pour a patio, photograph the rebar first — free advice, worth thousands.",
    },
  },

  "pocket-notary": {
    id: "pocket-notary",
    name: "Pocket Notary",
    oneLiner: "Book a licensed online notary in under ten minutes.",
    pitch:
      "We schedule remote online notarizations with licensed notaries across 32 states — title companies and lenders book through us when a signing can't wait for Monday. Notaries keep 80%; we keep the rest. 310 sessions last month, average time-to-notary: 8 minutes.",
    founder: "Denise Cho",
    founderLook: { skin: 2, outfit: 7, hair: 5 },
    category: "Legal",
    goal: "Reach $5k MRR",
    goalProgress: 0.52,
    verifiedRevenue: 2600,
    seekingCofounder: true,
    booth: {
      carpet: "#3A4A63",
      banner: "#C9A227",
      sign: "NOTARY",
      glyph: "star",
    },
    dialogue: {
      greeting:
        "Hi, Denise Cho — Pocket Notary. Remote notarization, properly done: licensed, recorded, compliant. Ask me anything; I read the statutes so you don't have to.",
      topics: [
        {
          keywords: ["notar", "seal", "signing", "witness", "stamp", "closing", "statute"],
          reply:
            "Remote notarization is legal in most states, but the rules differ everywhere — recording retention, witness requirements, seal formats. Our routing engine only offers notaries valid for YOUR document in YOUR state. That matrix took four months. I have never been happier.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Yes — I'm looking for a technical cofounder. The compliance matrix is my superpower; the video infrastructure is currently rented and fragile. I want a partner who treats uptime the way I treat statutes: personally.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "Nine years as a paralegal, and closings kept dying on Friday afternoons because no notary could be found before Monday. Deals lose momentum over a stamp. A stamp! I decided the stamp should come to the document.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "The scheduling engine and compliance rules are mine, in Django. Video and identity checks run on rented infrastructure, which works but itches. That itch is the cofounder conversation, frankly.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Sessions run $25 to $45 by document type, and notaries keep 80%. We cleared $2,600 last month on 310 sessions, and the title companies are becoming repeat customers — which is the whole ballgame.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$5k MRR — 52% of the way. Then licensing in the remaining states, in order of statutory friendliness. I have the spreadsheet. Of course I have the spreadsheet.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Upload the document, we match a notary licensed for it in your state, video session, digital seal, recording archived per statute. Under ten minutes, fully compliant, no Friday deals dying.",
        },
      ],
      fallback:
        "I'd rather say 'I don't know' than improvise — paralegal instincts. Try me on notarization, the numbers, or the cofounder search.",
      connectReply:
        "Connected — and witnessed, though not notarized. That would cost $25 and require ID. Kidding. Mostly.",
    },
  },

  "grave-matters": {
    id: "grave-matters",
    name: "Grave Matters",
    oneLiner: "Buy a headstone online without the funeral-home markup.",
    pitch:
      "Families design and order memorial headstones online, direct from stone carvers, at roughly half the funeral-home price. Carvers get steady retail work; we take 12%. We shipped 31 stones last month, every one from a proof the family approved first — an industry first, bafflingly.",
    founder: "Hattie Lindqvist",
    founderLook: { skin: 1, outfit: 0, hair: 6 },
    category: "Deathcare",
    goal: "Reach $10k MRR",
    goalProgress: 0.58,
    verifiedRevenue: 5800,
    seekingCofounder: true,
    booth: {
      carpet: "#3A3A42",
      banner: "#6B5C8C",
      sign: "GRAVEMATTERS",
      glyph: "leaf",
    },
    dialogue: {
      greeting:
        "Hello hello! Hattie, Grave Matters — we sell headstones online. Yes, really. No, it's not creepy. Well. A little creepy. Wonderful business though. Ask me anything!",
      topics: [
        {
          keywords: ["headstone", "memorial", "funeral", "cemetery", "granite", "death", "carver"],
          reply:
            "Funeral homes mark headstones up 200 to 400 percent, and families are too grief-stricken to comparison shop — which is precisely why the markup works. We connect you straight to the carver. Same granite, same craftsmanship, half the price, and you approve the proof before anything is chiseled. Chisels are famously final.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Yes! I need a growth cofounder, and it takes a specific person — deathcare marketing is all trust and taste, zero growth-hacking. If the phrase 'viral funeral campaign' excites you, we are not a match, and I say that with love.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "When my grandfather died, the funeral home quoted $4,800 for a stone I later found the actual carver selling for $1,900. Same stone. Same man. I was too sad to be angry for about a month. Then I was extremely angry, and now I'm a founder, which is the same thing with a booth.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "A design tool for inscriptions — live granite preview, kerning that would make a typographer weep — plus order management for 23 carver partners. Built on Vue by a contractor who now knows an alarming amount about serifs on stone.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "We take 12% per stone on an average order around $1,600 — that was $5,800 for us last month. The carvers love it: retail customers, no showroom.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$10k a month — 58% there. Next up: pet memorials, which I predicted would be a side business and is threatening to become the main one. People love their dogs more than their uncles. The data confirms.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "Design the stone online, see an exact preview, approve the proof, and the carver ships to your cemetery with installation coordinated. Cheaper, kinder, and the typography is better. I said what I said.",
        },
      ],
      fallback:
        "Ooh, stumped at my own booth — embarrassing for us both! Ask about the stones, the carvers, the money, or the grandfather story.",
      connectReply:
        "Connected! Lovely. You are now the only person from this expo I hope needs my product as late in life as possible.",
    },
  },

  stretcher: {
    id: "stretcher",
    name: "Stretcher",
    oneLiner: "Home exercise plans patients actually finish.",
    pitch:
      "Physical therapists assign home programs through Stretcher; patients get video-guided sessions and check-ins, and the PT sees who actually did the work before the next visit. Clinics pay $10 per active patient plan. Three clinics piloting; adherence is up from 34% to 61%.",
    founder: "Rosa Duarte",
    founderLook: { skin: 3, outfit: 1, hair: 4 },
    category: "Health",
    goal: "Reach $2k MRR",
    goalProgress: 0.13,
    verifiedRevenue: 260,
    seekingCofounder: true,
    booth: {
      carpet: "#3E5C7A",
      banner: "#5E8CBF",
      sign: "STRETCHER",
      glyph: "heart",
    },
    dialogue: {
      greeting:
        "Hi there! Rosa, Stretcher — home exercise programs that patients actually do. You can stand while we talk, it's good for you. What would you like to know?",
      topics: [
        {
          keywords: ["exercise", "therapy", "patient", "rehab", "adherence", "physio", "clinic"],
          reply:
            "The dirty secret of PT: recovery happens at home, and two-thirds of patients quietly skip the homework, then wonder why the shoulder still clicks. We took adherence from 34% to 61% with shorter sessions, video guidance, and check-ins that feel like a coach, not a nag. The clicking, I'm told, has stopped.",
        },
        {
          keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
          reply:
            "Yes — I need a technical cofounder. I've got three clinics, real adherence data, and a product held together by no-code and optimism. You bring the engineering; I bring every PT in my old license cohort, which is 200 people with the same problem.",
        },
        {
          keywords: ["origin", "why", "story", "start", "idea", "began"],
          reply:
            "Fourteen years as a PT watching the same movie: great progress in clinic, then a printed sheet of stick figures goes home and dies on the fridge. I started filming the exercises on my phone for patients, and adherence jumped. The stick figures never stood a chance.",
        },
        {
          keywords: ["tech", "stack", "built", "build", "code", "software"],
          reply:
            "Currently: Bubble, Airtable, and duct tape — and I'm being generous to the duct tape. It proved the model; 61% adherence is real data. Now it needs real engineering, which is the cofounder pitch, delivered mid-stretch.",
        },
        {
          keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
          reply:
            "Clinics pay $10 per active patient plan per month. Three pilot clinics, about $260 MRR. Small number, honest number — the adherence data is what I'm actually selling right now.",
        },
        {
          keywords: ["goal", "next", "plan", "milestone", "target"],
          reply:
            "$2k MRR, 13% of the way. That's roughly ten clinics, and my waitlist has six. The bottleneck is the duct tape, not the demand. See: cofounder.",
        },
        {
          keywords: ["what", "how", "product", "work", "demo"],
          reply:
            "The PT builds a program in two minutes from our video library; the patient gets guided sessions with reps and rest timed out; the PT sees completion before the next appointment. No more 'did you do your exercises' theater. The app already knows.",
        },
      ],
      fallback:
        "Good question — wrong muscle group! Try me on adherence, the clinics, or the cofounder search. And unclench your jaw; everyone's carrying stress there.",
      connectReply:
        "Connected! Excellent form. Roll your shoulders back twice a day and check on the pilot in a month — both are good for you.",
    },
  },
};

// ======================================================================
// Conversation engine
// ======================================================================

const GENERIC_TOPICS: {
  keywords: string[];
  reply: (s: Startup) => string;
}[] = [
  {
    // team / cofounder — checked first: these words are unambiguous
    keywords: ["cofounder", "co-founder", "hire", "hiring", "join", "team"],
    reply: (s) =>
      s.seekingCofounder
        ? `Actually, yes — ${s.name} is looking for a cofounder. If "${s.oneLiner}" sounds like a problem worth your next few years, let's talk.`
        : `Not hiring right now — it's a small operation and that's on purpose. Always happy to trade notes, though.`,
  },
  {
    keywords: ["pric", "revenue", "money", "customer", "charge", "cost", "pay", "mrr"],
    reply: (s) =>
      s.verifiedRevenue > 0
        ? `We're at $${s.verifiedRevenue.toLocaleString("en-US")} a month in verified revenue. Not a rounding error, not a rocket ship — real customers paying real money.`
        : `No verified revenue yet — early days. The plan is "${s.goal}", and everything else follows from that.`,
  },
  {
    keywords: ["goal", "next", "plan", "milestone", "target"],
    reply: (s) => {
      const pct = Math.round(Math.min(1, Math.max(0, s.goalProgress)) * 100);
      return `Current goal: ${s.goal}. We're about ${pct}% of the way there, and the booth is part of closing the gap.`;
    },
  },
  {
    keywords: ["what", "how", "product", "work", "demo", "tell"],
    reply: (s) => `${s.oneLiner} ${s.pitch}`,
  },
];

/**
 * The booth conversation brain.
 *
 * - Empty/whitespace input returns the greeting (or a generic welcome).
 * - Otherwise the first dialogue topic with ANY keyword found as a substring
 *   of the lowercased message wins; no match returns the fallback.
 * - Startups without a dialogue script (user-created booths) get sensible
 *   generic replies synthesized from their oneLiner / pitch / goal.
 */
export function replyFor(startup: Startup, text: string): string {
  const t = text.trim().toLowerCase();
  const d = startup.dialogue;

  if (d) {
    if (!t) return d.greeting;
    for (const topic of d.topics) {
      if (topic.keywords.some((k) => k.length > 0 && t.includes(k))) {
        return topic.reply;
      }
    }
    return d.fallback;
  }

  // No script: synthesize from the startup's own facts.
  if (!t) return `Hey — welcome to the ${startup.name} booth.`;
  for (const topic of GENERIC_TOPICS) {
    if (topic.keywords.some((k) => t.includes(k))) {
      return topic.reply(startup);
    }
  }
  return `Good question — short version: ${startup.oneLiner} Ask about the product, the pricing, the goal, or the team.`;
}

// ======================================================================
// Ambient idle chatter
// ======================================================================

/**
 * Short lines an NPC founder mutters to nobody in particular when the floor
 * is quiet — fed to the game engine via GameOptions.idleLines so booths read
 * as inhabited even with zero visitors.
 *
 * VALIDATION: every key below must be a key of STARTUPS (and should cover all
 * of them). Keep lines <= 80 chars, in the founder's booth-dialogue voice,
 * and free of exclamation marks — these are murmurs, not pitches.
 */
export const IDLE_LINES: Record<string, string[]> = {
  // ---- main hall ----
  "soup-ticket": [
    "Somewhere right now it's white bean day and I'm here. Worth it. Probably.",
    "Note to self: do not pitch bagel shops yet. Focus. Soup first.",
    "Half this hall skipped lunch. I can tell. It's a gift and a burden.",
  ],
  "night-shift-audio": [
    "Whoever crimped this booth's power cable should be ashamed. I checked.",
    "The PA in here hums at 60 hertz. Nobody else seems to mind. Fine.",
    "Glued housings everywhere. An entire industry afraid of screws.",
  ],
  "crate-and-pallet": [
    "These booth risers are pine two-ways. Four trips left in them, tops.",
    "Grade-A 48-by-40s are up two dollars this year. Nobody here cares.",
    "Rhonda flagged three price anomalies this morning. Good spreadsheet.",
  ],
  gutterball: [
    "Good approach on this carpet. You could bowl a frame or two in here.",
    "Tuesday league's starting back home about now. Gary's got it. Probably.",
    "Should've brought cheese curds for the table. Rookie booth mistake.",
  ],
  fernworks: [
    "Humidity in here is nearly optimal for fruiting. Someone should know.",
    "The day-12 batch is binding about now. Grow, you strange little things.",
    "This sample foam has survived forty demos. Better shape than I'm in.",
  ],
  ledgerline: [
    "Foot traffic is up eleven percent on the half hour. I have been counting.",
    "A quiet booth, like a balanced ledger, is nothing to apologize for.",
    "The banner opposite hangs two degrees off level. I shall say nothing.",
  ],
  copydesk: [
    "That banner across the aisle says 'utilize'. Flagged. Severity: high.",
    "Four minutes to deadline. There is no deadline. Old newsroom habits.",
    "Someone's signage has a hyphen doing an em dash's job. I see it.",
  ],
  shelfware: [
    "I have thirty tabs open on how to work a booth. None of them helped.",
    "Quiet floor today. Quiet is fine. Quiet is sort of my whole product.",
    "I should write down that idea before it... too late. It's gone.",
  ],

  // ---- indie alley ----
  mudroom: [
    "No dogs allowed at this expo, yet statistically three of you own doodles.",
    "Someone walked past with golden fur on their coat. Doodle. I'd bet money.",
    "A groomer could fit two of these booths in one Sprinter van. Easily.",
  ],
  "zine-machine": [
    "These fluorescents would murder a riso pink. Flatten it completely.",
    "Beverly's alone at the shop today. She's fine. She's probably fine.",
    "Every banner in this hall is CMYK-safe. Cowardice, aisle after aisle.",
  ],
  coldframe: [
    "Clear sky tonight. Somebody's field is going below freezing, guaranteed.",
    "The airport says 41 tonight. The airport is wrong about somebody's field.",
    "Climate control in this hall beats my barn's. Duly noted.",
  ],
  patchbay: [
    "That left speaker's wired out of phase. Nobody hears it. I hear it.",
    "Decent cable runs on the lighting rig. Somebody here knows their craft.",
    "Slow floor. Clean signal, low noise. I'll take it.",
  ],
  loafer: [
    "The starters are fed through six o'clock. Until then, I am off duty.",
    "Room temperature in here would suit a rye starter. I checked. Twice.",
    "Two different clients named a starter Clint Yeastwood. Independently.",
  ],

  // ---- ramen district ----
  wrenchlist: [
    "Somebody wheeled a crate through here with a dry bearing. I heard it.",
    "Fifteen years on a repair stand and my back still expects one.",
    "A blocked stand is dead money. A quiet booth is just quiet. Different.",
  ],
  "sheet-metal": [
    "Somewhere in this hall, one spreadsheet is holding a company together.",
    "I nearly said 'synergy' to a stranger just now. Caught it. Growth.",
    "Gord's macro still runs in my dreams. Two hundred fourteen tabs.",
  ],
  barnacle: [
    "Floor doesn't rock. Thirty years on docks — feels wrong when it's still.",
    "Somewhere right now, Gus is not paying for his slip. I can feel it.",
    "Convention halls charge by the foot too. The racket translates.",
  ],
  "on-call-room": [
    "Twelve years of night shifts and this lighting still feels like home.",
    "I clocked both exits and the AED when I walked in. Old habit. Good habit.",
    "Somewhere a shift swap is dying in a group text. We could fix that.",
  ],
  "lower-third": [
    "That projector's keystone is off by a hair. Been bugging me for an hour.",
    "Espresso number four. The ticker in my head is scrolling clean.",
    "Ruth would have this expo's signage running on time. Ruth runs tight.",
  ],
  dunning: [
    "Statistically, three people in this aisle have an invoice at day 60.",
    "A courteous reminder loses none of its teeth. I should embroider that.",
    "Someone here is 87 days late on something. One develops a sense.",
  ],

  // ---- co-founder row ----
  "second-stove": [
    "Expo coffee. I've had worse at 2am in a commissary. Barely.",
    "This booth took me an hour to set up. A line cook does it in ten.",
    "Someone's reheating something with cumin two aisles over. Respect.",
  ],
  glasshouse: [
    "Ambient humidity is 41 percent. Acceptable for people, poor for tomatoes.",
    "The HVAC cycles every eleven minutes. Wasteful, but at least consistent.",
    "My vents opened at 3am again last night. The firmware search continues.",
  ],
  rebar: [
    "Nice slab under this carpet. Flat, good cure. Somebody knew their trade.",
    "I checked this hall's columns for honeycombing. Habit. They pass.",
    "Twenty years of jackhammers and people still say I talk loud. I KNOW.",
  ],
  "pocket-notary": [
    "Thirty-two states down, eighteen statutes to go. I know them by heart.",
    "That handshake over there could have used a witness. Occupational reflex.",
    "It's almost Friday somewhere. Somewhere, a closing needs a stamp.",
  ],
  "grave-matters": [
    "That signage font would look lovely in granite. Most fonts do, honestly.",
    "Pet memorials outsold uncles again this month. People are consistent.",
    "Everyone at this expo is a future customer. I mean that warmly.",
  ],
  stretcher: [
    "Half this hall is standing with locked knees. Soften them, people.",
    "Booth duty: eight hours standing. I have a program for that, obviously.",
    "The posture in this room is a waitlist all by itself.",
  ],
};
