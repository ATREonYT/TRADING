# Cloud accounts (Supabase)

Helix accounts work in two modes, chosen automatically:

- **Cloud mode** — when the two env vars below are set: real email/password
  login via Supabase Auth, and the paper portfolio syncs to the database, so
  the same account works on any device.
- **Local mode** — when they're absent: accounts live in the visitor's browser
  (no setup needed). Nothing breaks either way.

## 1. Environment variables

In your deployment (e.g. Vercel → Settings → Environment Variables), set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # the "anon public" key — NOT service_role
```

Find both in Supabase → your project → **Project Settings → API**.
Redeploy after adding them (env vars apply at build time).

## 2. Create the portfolio table

Supabase → your project → **SQL Editor → New query**, paste this, click **Run**:

```sql
-- One paper-trading portfolio per user, stored as JSON.
create table if not exists public.paper_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: each user can only touch their own row.
alter table public.paper_accounts enable row level security;

create policy "own row select" on public.paper_accounts
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.paper_accounts
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.paper_accounts
  for update using (auth.uid() = user_id);
```

## 3. (Recommended) Instant sign-ups

By default Supabase requires new users to click an email confirmation link.
For a smoother demo experience you can turn that off:

**Authentication → Providers → Email → disable "Confirm email"** → Save.

If you leave it on, the app handles it gracefully — after signing up, users
see "check your email", confirm, then sign in.

## That's it

Sign-ups on the site now create real Supabase users, and every paper trade
is saved to `paper_accounts`. You can watch users appear under
**Authentication → Users** and portfolios under **Table Editor → paper_accounts**.
