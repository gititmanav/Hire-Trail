# Contributing to HireTrail

Thanks for your interest in improving HireTrail! This guide covers the dev setup, how the codebase is organized, the conventions we follow, and the checks your change must pass.

By contributing you agree your work is licensed under the project's [MIT License](LICENSE).

---

## 1. Development setup

You'll need **Node.js 18+** and **Docker** (or a native `mongod`).

```bash
git clone https://github.com/gititmanav/Hire-Trail.git
cd Hire-Trail
npm run install-all

# envs
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
echo 'MONGO_URI=mongodb://127.0.0.1:27017/hiretrail_dev' > backend/.env.local   # keeps dev off prod

# local database (Docker)
npm run db:up        # starts "hiretrail-dev-db" on :27017
npm run db:seed      # dev@hiretrail.local / devpass123

# run
npm run dev:backend  # :5050
npm run dev:frontend # :5173  → open this
```

- **Never point a dev server at a production database.** `backend/.env.local` (gitignored, loaded before `.env`) is how you keep `MONGO_URI` local. See [backend/DEV_LOCAL.md](backend/DEV_LOCAL.md).
- No Docker? `cd backend && npm run db:up:local` (native `mongod`, data in `backend/.localdb/`).
- For AI features, set `AI_GATEWAY_API_KEY` (full provider catalog) or a single direct key like `GOOGLE_GENERATIVE_AI_API_KEY` (free Gemini tier). See the README's [AI configuration](README.md#ai-configuration).

## 2. Project architecture

```
backend/   Express + TypeScript + Mongoose
  src/routes/            REST endpoints
  src/services/ai/       AI platform — see invariants below
  src/services/resume/   ResumeDocument engine (document, score, suggestions, keywords, html)
  src/services/pdf/      Gotenberg HTML→PDF
  src/models/            Mongoose models
frontend/  React 18 + Vite + Tailwind (pages/ResumeStudio, pages/Applications, pages/Settings, …)
extension/ Chrome MV3 (content / background / popup)
```

**Key invariants — please respect these:**
- **All AI calls go through the central runner** `backend/src/services/ai/run.ts` (`runGenerateObject` / `runGenerateText`). It handles provider/model resolution, BYOK forwarding, caching, retry, rate-limit, quota, and **usage metering**. Never call the AI SDK directly from a route/service — bypassing the runner means a call won't be metered or rate-limited.
- **The match score stays deterministic.** `services/resume/score.ts` is a pure function (powers before/after). It is separate from the AI fit score (1–5). Don't make it call an LLM.
- **No fabrication in AI prompts.** Resume rewrites must never invent employers, titles, dates, metrics, or skills (see `services/ai/rewrite.ts`). Facts are not sent to the model for rewriting.
- **The provider catalog is dynamic.** Providers/models come from the live gateway catalog (`services/ai/gatewayModels.ts` + `catalog.ts`) — you usually don't hardcode a new provider. Curated metadata (labels, get-key URLs, credential shape) lives in `catalog.ts`.
- **Studio preview = the PDF.** The live preview's HTML+CSS is what Gotenberg renders, so changes to one must keep the other faithful.

## 3. Coding conventions

- **TypeScript everywhere**, `strict` on. Match the surrounding code's style, naming, and comment density — read the file before editing.
- Prefer reusing existing utilities/components over adding new ones.
- Validate request bodies with **Zod** at the route layer.
- Keep comments about the *why*, not the *what*.
- Frontend: Tailwind utility classes (no ad-hoc CSS files unless a page already has one); reuse shared components (`components/*`).

## 4. Quality gates (must pass before opening a PR)

```bash
cd backend  && npx tsc --noEmit     # backend types
cd frontend && npm run build        # frontend type-check + production build
node --test extension/tests/*.test.js   # if you touched the extension
```

If your change is observable in the app, **exercise it** (run it locally and confirm the behavior) — don't rely on types alone. For AI flows, verify both the success and the failure-in-place paths.

## 5. Commits & pull requests

- **Conventional Commits** for messages: `feat(studio): …`, `fix(ai): …`, `docs: …`, `refactor: …`, `chore: …`.
- Keep PRs focused; split unrelated changes.
- **PR checklist:**
  - [ ] `backend` `tsc --noEmit` and `frontend` `npm run build` are green.
  - [ ] Exercised the change locally (note how in the PR description).
  - [ ] No secrets, no prod DB URIs, no `.env*` committed.
  - [ ] New AI calls go through the central runner.
  - [ ] Docs updated if behavior/setup changed.

## 6. Reporting bugs & requesting features
Open a GitHub issue with steps to reproduce, expected vs actual, and environment details. For UI bugs, a screenshot or short clip helps a lot.

## 7. Security
Please **do not** open public issues for security vulnerabilities. Report them privately to the maintainer (see the repo profile). Never commit credentials; BYOK keys are encrypted at rest with `ENCRYPTION_KEY`.
