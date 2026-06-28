# Deploying the Pump Scanner Bot

The bot must run on an always-on machine. Pick one path. In every case you supply two
secrets — `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` — and never commit them.

Get them first:
- **Token:** Telegram → @BotFather → `/newbot` → copy the token, then open your new bot and press **Start**.
- **Chat ID:** message @userinfobot → copy the numeric `Id`.

---

## Option A — Railway (no server, ~5 min, free trial)

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → pick `ATREonYT/TRADING`.
2. In service **Settings**: set **Root Directory** = `bot`, **Branch** = `claude/lucid-cori-548hkv`.
   (Railway auto-detects Node and runs `npm start`.)
3. In **Variables**, add:
   - `TELEGRAM_BOT_TOKEN` = your token
   - `TELEGRAM_CHAT_ID` = your id
4. Deploy. You'll get a "🚀 Pump Scanner started" message in Telegram.

## Option B — Render (no server, uses render.yaml)

1. [render.com](https://render.com) → **New → Blueprint** → connect the repo. It reads `bot/render.yaml`.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` when prompted.
3. Create → it runs as a background worker.

## Option C — Any VPS (Hetzner / DigitalOcean, ~$4/mo) with Docker

```bash
git clone -b claude/lucid-cori-548hkv https://github.com/ATREonYT/TRADING.git
cd TRADING/bot
docker build -t pump-scanner .
docker run -d --restart unless-stopped --name pump \
  -e TELEGRAM_BOT_TOKEN=8123...your-token \
  -e TELEGRAM_CHAT_ID=123456789 \
  pump-scanner
docker logs -f pump        # watch it start
```

## Option D — VPS without Docker (Node + pm2)

```bash
git clone -b claude/lucid-cori-548hkv https://github.com/ATREonYT/TRADING.git
cd TRADING/bot
npm install
cp .env.example .env && nano .env     # paste token + chat id
npm install -g pm2
pm2 start npm --name pump -- start
pm2 save && pm2 startup               # auto-restart on reboot
```

## Option E — Your own PC (testing only)

```bash
cd TRADING/bot
npm install
cp .env.example .env     # paste token + chat id
npm start                # runs while this terminal stays open
```

---

## Verify it's working

In Telegram, send your bot:
- `/status` → uptime, markets tracked, scans run
- `/top` → current top movers (proves it's reaching the exchange)
- `/scan` → force a scan now

No alerts for a while is normal — it only fires when something actually pumps. To prove the
pipe end-to-end, temporarily loosen the gates: `/set minWindowChangePct 1` and
`/set minVolumeSurge 1.5`, then `/scan`. **Set them back** (`/set minWindowChangePct 4`,
`/set minVolumeSurge 3`) once you've seen an alert.

## Security

- The token lives only in env vars / `.env` (which is git-ignored). Never paste it into chat,
  commits, or screenshots.
- If a token ever leaks, revoke it in @BotFather (`/revoke`) and issue a new one.
