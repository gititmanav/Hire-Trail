# Frontend integration guide — AI Settings, BYOK onboarding, Resume Studio

This document is the contract between the **frontend** (this folder) and the
**backend** session. It lists which endpoints each new screen calls, the exact
payloads, and how to flip from the mock layer to the live backend.

The new work spans three features:

| Feature | Entry points | Route(s) |
| --- | --- | --- |
| **A. AI Settings** | Settings → "Manage AI providers", header red-wrench badge, BYOK modal CTA | `/settings/ai` |
| **B. BYOK onboarding + warning** | after the first-run tour; app-wide | (no route — global modal/banner/badge) |
| **C. Resume Studio** | Sidebar "Resume Studio", Documents → "Resume Studio" card | `/resume-studio?resume=<id>&jd=<text>` |

---

## 1. Mock layer & the flip to real

Everything new is wired through a **typed, mockable** client so the UI is fully
demonstrable before the backend lands.

- New endpoints are wrapped in [`src/utils/studioApi.ts`](src/utils/studioApi.ts).
  Each function tries the **real** endpoint (defined in `src/utils/api.ts`) and,
  on "not implemented yet" (404/501/network), falls back to a mock in
  [`src/utils/studioMocks.ts`](src/utils/studioMocks.ts). The fallback is logged
  once to the console.
- Master switch: **`STUDIO_USE_MOCKS`** in `studioApi.ts`, sourced from
  `VITE_STUDIO_USE_MOCKS` (default `"1"` → mocks on).
  - **To integrate:** set `VITE_STUDIO_USE_MOCKS=0`. Even with it off, a missing
    endpoint still auto-falls-back (so a half-finished backend never hard-breaks
    the UI). Once all endpoints answer, mocks are never hit.
- The **AI key CRUD + validation** endpoints (`/ai/keys*`) are already live and
  are **not** mocked — they go straight through `aiAPI` in `api.ts`.

Types live in [`src/utils/resumeDocument.ts`](src/utils/resumeDocument.ts) and
mirror the CONTRACT exactly.

---

## 2. Endpoints by screen

### A. AI Settings (`/settings/ai`)
| Call | Endpoint | Notes |
| --- | --- | --- |
| Providers + default models | `GET /api/ai/providers` | `{ available:[{provider,byok}], defaults:{provider:{fast,smart}} }`. Human copy (labels, free-tier notes, get-key URLs) is client-side in `PROVIDER_CATALOG`. |
| List keys | `GET /api/ai/keys` | shared via `useAIKeyStatus` |
| Validate (on add) | `POST /api/ai/keys/validate` | `{provider,apiKey}` → `{ok,reason?}`, debounced, abortable |
| Create key | `POST /api/ai/keys` | `{provider,apiKey,name?,modelOverride?}` |
| **Activate (exactly-one)** | `POST /api/ai/keys/:id/activate` | server deactivates the others. Frontend **falls back** to `PUT /ai/keys/:id {isActive}` (deactivate others + activate target) if this 404s. |
| Deactivate | `PUT /api/ai/keys/:id` | `{isActive:false}` |
| Delete | `DELETE /api/ai/keys/:id` | gated behind a **type-`DELETE`** ConfirmModal |
| Status card | `GET /api/ai/status` | `{mode:"byok"\|"default"\|"none",provider,model,ok,message}` |
| Usage card | `GET /api/ai/usage` | BYOK → `{mode:"byok",tokens:{input,output,total},estimatedCostUsd,period}`; default → `{mode:"default",used,limit,resetsAt,period}` |

### B. BYOK onboarding + warning (global)
- No new endpoints. Reads active-key state from `useAIKeyStatus` (`GET /ai/keys`).
- One-time state in `localStorage`: `hiretrail-byok-onboarded`,
  `hiretrail-byok-warning-dismissed`. The header wrench badge shows whenever
  `ready && !hasActiveKey` and clears the instant a key is activated.

### C. Resume Studio (`/resume-studio`)
| Step / tab | Call | Endpoint |
| --- | --- | --- |
| Step 1 — gap | analyze gap | `POST /api/tailor/gap` `{resumeId,jobDescription}` → `GapAnalysis` |
| load document | `GET /api/resumes/:id/document` → `ResumeDocument` |
| Review — autosave | debounced | `PUT /api/resumes/:id/document` (body = full `ResumeDocument`) → `{version}` |
| AI Rewrite tab | rewrite | `POST /api/resumes/:id/ai-rewrite` (see §4) |
| AI Rewrite — undo | revert | `POST /api/resumes/:id/revert` `{toVersion}` → `ResumeDocument` |
| Download | render | `POST /api/resumes/render-pdf` (see §3) |

> `GapAnalysis` is the only piece the contract didn't fully specify a shape for.
> The frontend consumes: `{ coverage:number(0-100), matched:string[], missing:string[], sectionFlags:[{sectionId,title,severity:"good"|"warn"|"gap",note}] }`.
> If `/tailor/gap` isn't a real route, point this at whatever the tailor flow
> exposes and adapt the one mapping in `resumeStudioAPI.analyzeGap`.

---

## 3. Download → `POST /api/resumes/render-pdf`

The live preview **is** the print template, so the PDF is byte-for-byte the
preview. On Download the page ([`ResumeStudio.tsx`](src/pages/ResumeStudio/ResumeStudio.tsx) → `onDownload`):

1. Takes the preview's `.resume-doc` DOM node (the forwarded ref).
2. Clones it and **strips screen-only affordances**:
   - removes every `[data-rd-control]` (the hover "Edit With AI" buttons)
   - removes the `rd-changed` and `rd-targeted` classes (highlight/selection)
3. Builds the CSS string with
   [`buildResumeCss(style, density)`](src/pages/ResumeStudio/preview/resumeCss.ts)
   — the **same** function that styles the on-screen preview (single source of
   truth; everything is scoped under `.resume-doc`).

**Payload:**
```jsonc
POST /api/resumes/render-pdf
{
  "html": "<div class=\"resume-doc rd-tpl-standard\" style=\"--rd-bullet:'•'\">…</div>",
  "css":  ".resume-doc { --rd-accent:#2563eb; … } .resume-doc .rd-name { … } …",
  "filename": "hiretrail-jordan-rivera"   // optional
}
→ 200 application/pdf  (binary)
```

The backend should render `<html><head><style>{css}</style></head><body>{html}</body></html>`
to PDF (e.g. Puppeteer/Playwright print). **No app/Tailwind CSS is needed** — the
`css` field is self-contained. The mock returns the same document as
`text/html` so Download still produces a faithful, openable file; the UI keys
the file extension off `blob.type` (`pdf` vs `html`).

---

## 4. `ai-rewrite` scope / changedPaths contract (drives highlighting)

```jsonc
POST /api/resumes/:id/ai-rewrite
{
  "scope": { "sectionId": "sec_exp", "entryId": "exp_a" } | { "sectionId": "..." } | "all",
  "instruction": "make the bullets more quantified",   // optional (free text)
  "preset": "sg1"                                        // optional (suggestion id)
}
→ {
  "document":     ResumeDocument,                 // the FULL updated doc — UI swaps state to this
  "changes":      [{ "path","summary","before","after" }],   // "See What's Changed" log
  "changedPaths": ["sections.sec_exp.entries.exp_a.bullets.b1.text", …],
  "score":        { "before": 6.4, "after": 8.2 } // animates the 0–10 gauge
}
```

- **Scope** comes from the active target chip. Hovering a section/entry in the
  preview selects it (`{sectionId}` or `{sectionId,entryId}`); with nothing
  selected the scope defaults to `"all"`.
- **`changedPaths`** must use this exact path grammar (see `resumeDocument.ts`
  helpers `bulletPath` / `entryFieldPath` / `sectionTitlePath`):
  - bullet text: `sections.{sectionId}.entries.{entryId}.bullets.{bulletId}.text`
  - entry field: `sections.{sectionId}.entries.{entryId}.{org|title|location|startDate|endDate|extra}`
  - section title: `sections.{sectionId}.title`
  - name: `meta.name`
  The preview turns each matching node **green** for ~4.5s. Paths that don't
  match a rendered node are simply ignored, so over-reporting is safe.
- The frontend **strictly reflects** `document` — it never invents content. It
  also keeps the prior doc to power **Undo** locally; `revert` is best-effort.

---

## 5. Files added

```
src/utils/resumeDocument.ts          ResumeDocument types + helpers (paths, dates, clone)
src/utils/studioMocks.ts             mock data (status/usage/document/gap/rewrite)
src/utils/studioApi.ts               mock-aware client + PROVIDER_CATALOG + STUDIO_USE_MOCKS
src/hooks/useAIKeyStatus.tsx         shared "has active key" provider (mounted in App.tsx)
src/pages/AISettings/                AI Settings page + AddKeyForm
src/components/AIKeyNudges/          BYOK onboarding modal + warning banner orchestrator
src/pages/ResumeStudio/              wizard, 3 tabs, live preview, style→CSS, state hook
```

`aiAPI` in `src/utils/api.ts` gained `activateKey`, `getStatus`, `getUsage`.
`ConfirmModal` gained an optional `requireType` prop (type-to-confirm).
The old native-`<select>` `AISettingsCard` was removed in favor of `/settings/ai`.
