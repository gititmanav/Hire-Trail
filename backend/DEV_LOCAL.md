# Local development (persistent local DB)

Dev runs against a **local MongoDB**, never production Atlas. `backend/.env.local`
(gitignored) sets `MONGO_URI` to the local DB and is loaded *before* `.env`
(see `src/config/env.ts`), so it wins locally and is absent in production.

## Option A — Docker (recommended, reproducible)
```bash
npm run db:up        # start mongo:7 on :27017 (named volume persists data)
npm run db:seed      # seed a dev user + master profile + resume + sample app
npm run dev          # backend → local DB (via .env.local)
# …
npm run db:down      # stop (keeps data).  `docker compose -f ../docker-compose.yml down -v` wipes it.
```

## Option B — Native mongod (no Docker)
```bash
npm run db:up:local  # mongod on :27017, data in backend/.localdb/ (gitignored, persists)
npm run db:seed
npm run dev
npm run db:stop:local
```

## Dev logins
- `dev@hiretrail.local` / `devpass123` — a normal (non-admin, non-demo) user with a
  master profile, so AI features — Studio, fit analysis, the tailoring drawer — work.
- `admin@hiretrail.local` / `devpass123` — the local admin (Admin panel).

`npm run db:seed` recreates the dev user with fresh data and resets the admin's
password and role; `npm run db:seed -- --admin-only` resets just the admin.

## AI
Provider keys live in the database, not in env: sign in as the local admin and add
a platform key in Admin → AI → Map (a free Google AI Studio key is the easiest), or
add your own in Settings → AI as the dev user. `ENCRYPTION_KEY` encrypts them. To
test the AI layer without a key, use the AI SDK's mock model (`MockLanguageModelV3`)
against this local DB.
