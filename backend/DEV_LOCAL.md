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

## Dev login
`dev@hiretrail.local` / `devpass123` (a non-demo user with a master profile, so
AI features — Studio, fit analysis, the tailoring drawer — work). Re-run
`npm run db:seed` any time to reset it.

## AI Gateway
`AI_GATEWAY_API_KEY` in `.env` enables all gateway providers/models + BYOK. In
production, set the same var in the Vercel project env (BYOK needs AI Gateway
credits). Without it, only the 4 direct providers (OpenAI/Anthropic/Google/
OpenRouter) work.
