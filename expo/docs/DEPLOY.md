# FounderFloor — beta deploy guide

Two pieces run in production:

1. **The web app** (Next.js, `expo/`) — deploy to Vercel (or any Node host).
2. **The floor server** (`expo/server/index.mjs`) — one Node process on a
   small VPS. It owns the WebSocket rooms, the social graph, accounts,
   cross-device state, and `floor-data.json`.

Total cost at launch: ~$12/month (see `docs/financial-model.xlsx`).

---

## 1. The floor server (VPS)

Any $5–6/month VPS (Hetzner CX22, DigitalOcean basic) with Ubuntu:

```bash
# on the VPS
sudo apt update && sudo apt install -y nodejs npm caddy
sudo useradd -r -m -s /usr/sbin/nologin founderfloor

# copy the server (only two files matter: server/index.mjs and package.json
# for the "ws" dependency)
sudo -u founderfloor mkdir -p /home/founderfloor/app/server
# scp expo/server/index.mjs -> /home/founderfloor/app/server/
# scp expo/package.json     -> /home/founderfloor/app/
cd /home/founderfloor/app && sudo -u founderfloor npm install ws
```

`/etc/systemd/system/founderfloor.service`:

```ini
[Unit]
Description=FounderFloor floor server
After=network.target

[Service]
User=founderfloor
WorkingDirectory=/home/founderfloor/app
ExecStart=/usr/bin/node server/index.mjs
Environment=PORT_WS=3001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now founderfloor
curl http://localhost:3001/health   # {"ok":true,...}
```

### TLS (required — browsers refuse ws:// from an https page)

Caddy terminates TLS and proxies to the Node process. `/etc/caddy/Caddyfile`:

```
floor.yourdomain.com {
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
curl https://floor.yourdomain.com/health
```

Caddy fetches and renews the certificate automatically. WebSockets are
proxied out of the box.

### Data safety

- `floor-data.json` holds everything (stands, accounts, social graph, DMs,
  synced progress, feedback). The server keeps 3 daily rotating backups
  beside it (`floor-data.backup-1.json` = yesterday).
- Off-box safety: a nightly cron that copies the newest backup somewhere
  else is 1 line:
  `0 5 * * * cp /home/founderfloor/app/server/floor-data.backup-1.json /backup/`
- Reading beta feedback and abuse reports: they're the `feedback` and
  `reports` arrays in that file — `jq '.feedback' server/floor-data.json`.

## 2. The web app (Vercel)

- Import the repo in Vercel, set the project root to `expo/`.
- Environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_WS_URL` | `wss://floor.yourdomain.com/ws` |
| `NEXT_PUBLIC_STRIPE_LINK_PRO_MONTHLY` | Stripe Payment Link URL |
| `NEXT_PUBLIC_STRIPE_LINK_PRO_ANNUAL` | Stripe Payment Link URL |
| `NEXT_PUBLIC_STRIPE_LINK_FOUNDER_MONTHLY` | Stripe Payment Link URL |
| `NEXT_PUBLIC_STRIPE_LINK_FOUNDER_ANNUAL` | Stripe Payment Link URL |
| `NEXT_PUBLIC_STRIPE_LINK_FOUNDING` | Stripe Payment Link URL |

- Without the Stripe vars everything works and the membership UI honestly
  says billing isn't live (buttons simulate). With them, every buy button
  opens real checkout — no code change.
- Create the five Payment Links in the Stripe dashboard (Products →
  Payment Links): Pro $9/mo, Pro $79/yr, Founder+ $19/mo, Founder+
  $159/yr, Founding Member $79 one-time.

## 3. Launch-day checklist

- [ ] `https://floor.yourdomain.com/health` returns ok
- [ ] Walk a floor from two browsers — you see each other move
- [ ] Create an account on desktop, sign in on a phone — booth follows
- [ ] Claim a stand, close the tab, reopen — stand still there
- [ ] Send feedback from /about — appears in `floor-data.json`
- [ ] Buy buttons open Stripe checkout (test mode first!)
- [ ] Uptime monitor (UptimeRobot free tier) pointed at `/health`

## Known limits at beta scale (fine to launch with)

- One floor-server process; ~1k concurrent visitors on a small VPS.
- Revenue ranks are still self-reported ("simulated" is labeled in-app);
  read-only Stripe verification is the headline post-beta feature.
- No email — password reset means the operator edits `floor-data.json`.
  (Email/notifications are on the roadmap; they need a sending domain.)
