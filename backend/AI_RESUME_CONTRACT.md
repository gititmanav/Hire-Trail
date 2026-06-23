# AI + Resume Engine API Contract

Backend contract for the AI provider platform, usage metering, the structured
resume document, the HTML→PDF renderer, and section-scoped AI rewriting.

All routes are under the API origin (`/api/...`). JSON unless noted.

---

## Integration notes

### Auth
Every route below requires an authenticated user. Two mechanisms (already used
across the app):

- **Session cookie** (web app): the `connect.sid` cookie set at login. Send
  `credentials: "include"` on fetch.
- **Bearer JWT** (extension): `Authorization: Bearer <token>` where the token is
  signed with the session secret and carries `{ userId }`.

Admin routes (`/api/admin/ai/*`) additionally require `role: "admin"`.

The **demo user** can read AI/provider/usage/status and the resume document, but
is blocked (403) from any write or any call that contacts a provider
(add/validate keys, render-pdf, ai-rewrite, revert, document PUT).

### Error shapes
Operational errors return an HTTP status + a JSON body. Two shapes appear:

```jsonc
// Most handlers / thrown AppErrors:
{ "error": "Human-readable message." }

// Zod body-validation failures:
{ "error": { "fieldName": ["why it failed"] } }
```

Relevant statuses:

| Status | Meaning |
|--------|---------|
| 400 | Bad input (validation, missing fields). |
| 401 | Not authenticated. |
| 403 | AI disabled platform-wide and user has no key ("bring your own key"); or demo user. |
| 404 | Resource not found (resume, key, snapshot). |
| 429 | Per-user AI rate limit OR monthly default-key quota exhausted. |
| 502 | Upstream provider failed — `message` says what the user should do (`AIProviderError`). |
| 503 | AI not configured / Gotenberg warming up or unavailable. |

`AIProviderError` (502) messages are user-actionable, e.g. *"Your Anthropic API
key was rejected. Update it in Settings → AI Providers."*

### Routing model (how a call is fulfilled)
1. The user's single **active** BYOK key (billed to them).
2. Else the **admin default** (only if AI is enabled): gateway system credits,
   an admin default provider key, or a legacy env key.
3. Else **403** "bring your own key".

When `AI_GATEWAY_API_KEY` is set, calls run through the Vercel AI Gateway as
`provider/model` and BYOK keys are forwarded per-request via
`providerOptions.gateway.byok`. Without it, the four legacy providers
(anthropic/openai/google/openrouter) run via their direct SDKs; other providers
require the gateway.

Reliability: exponential backoff + jitter, `Retry-After` honored on 429,
per-attempt timeout, 401/402/403 non-retryable. Deterministic ops (resume parse,
JD analysis, classification) are content-hash cached. Per-user sliding-window
rate limit + monthly token quota for default-key users.

---

## AI provider platform

### `GET /api/ai/providers`
Provider catalog for the BYOK UI.

```jsonc
{
  "providers": [
    {
      "id": "anthropic",
      "label": "Anthropic",
      "models": [
        { "id": "anthropic/claude-haiku-4-5", "label": "Claude Haiku 4.5", "capability": "fast" },
        { "id": "anthropic/claude-sonnet-4-6", "label": "Claude Sonnet 4.6", "capability": "smart" }
      ],
      "freeTier": false,
      "getKeyUrl": "https://console.anthropic.com/settings/keys",
      "keyKind": "single"           // "single" = one API key; "aws" = Bedrock JSON creds
    }
    // ... openai, google, bedrock, mistral, xai, groq, deepseek, openrouter, perplexity, cohere
  ]
}
```

### `GET /api/ai/keys`
```jsonc
[
  { "id": "665...", "provider": "anthropic", "label": "Personal", "last4": "a1b2", "isActive": true, "createdAt": "2026-06-23T..." }
]
```
The ciphertext and full key are never returned.

### `POST /api/ai/keys`  — add a key (becomes the single active key)
```jsonc
// request
{ "provider": "anthropic", "key": "sk-ant-...", "label": "Personal" }
// for Bedrock (keyKind: "aws"), `key` is a JSON string:
// "{\"accessKeyId\":\"...\",\"secretAccessKey\":\"...\",\"region\":\"us-east-1\"}"

// 201 response (same shape as a GET /keys element)
{ "id": "665...", "provider": "anthropic", "label": "Personal", "last4": "...", "isActive": true, "createdAt": "..." }
```
Adding a key **deactivates all the user's other keys** — exactly one active key
per user, enforced server-side.

### `POST /api/ai/keys/:id/activate`
Activates the key and deactivates every other key for the user. Returns the
activated key view.

### `PUT /api/ai/keys/:id`  (optional edit; not required by the UI)
Body any of `{ label?, modelOverride?, isActive? }`. `isActive: true` enforces
the single-active rule.

### `DELETE /api/ai/keys/:id`
`{ "message": "API key removed" }`

### `POST /api/ai/keys/validate`  — pre-flight a key (never stored)
```jsonc
// request
{ "provider": "openai", "key": "sk-..." }
// response
{ "ok": true, "modelTested": "openai/gpt-4o-mini" }   // or
{ "ok": false, "reason": "Key was rejected by the provider." }
```
Rate-limited 30 / 5 min / IP. With the gateway configured, validation is a
1-token probe through the gateway (works for any provider); otherwise a cheap
REST check for the four legacy providers.

### `GET /api/ai/status`
```jsonc
{ "hasActiveKey": true, "mode": "byok" }   // mode: "byok" | "default" | "disabled"
```

### `GET /api/ai/usage`
BYOK users (own key) see raw usage; default-key users see quota progress.

```jsonc
// mode === "byok"
{ "mode": "byok", "period": "2026-06", "tokensIn": 184320, "tokensOut": 40210, "estCostUsd": 1.243210 }

// mode === "default"
{ "mode": "default", "period": "2026-06", "used": 152300, "limit": 200000, "usedPct": 76.2, "resetsAt": "2026-07-01T00:00:00.000Z" }
```
`used`/`limit` are **tokens** (in+out). `estCostUsd` is computed locally from a
price table and snapshotted per call.

---

## Admin AI control (`role: admin`)

### `GET /api/admin/ai`
```jsonc
{
  "config": {
    "enabled": true,
    "defaultProvider": "google",
    "defaultModel": "",
    "usesGatewayCredits": false,
    "monthlyTokenLimit": 200000,
    "hasDefaultKey": true,
    "defaultKeyLast4": "9f3a"
  },
  "gatewayConfigured": true
}
```

### `PUT /api/admin/ai`
Body any of `{ enabled?, defaultProvider?, defaultModel?, usesGatewayCredits?, monthlyTokenLimit? }`.
Returns `{ config }`. When `enabled` is `false`, default-key fallback is off and
users without their own key get a 403 "bring your own key" error.

### `PUT /api/admin/ai/key`  — set the encrypted default key
```jsonc
{ "provider": "google", "key": "AIza...", "skipValidation": false }
```
Validates (unless `skipValidation`), then stores the key **encrypted** and sets
`defaultProvider`. Returns `{ config }` (no secret). The encrypted value is never
returned by `GET /api/admin/settings` (redacted to `********`) and cannot be
written through the generic settings editor.

### `DELETE /api/admin/ai/key`  → `{ config }`

### `GET /api/admin/ai/usage?period=YYYY-MM`
Org-wide rollup: `{ period, totals, byProvider[], topDefaultKeyUsers[] }`.

---

## Structured resume document

### `ResumeDocument` shape (stable)
```jsonc
{
  "meta": { "name": "Ada Lovelace", "contact": { "email": "...", "phone": "...", "location": "...", "links": [{ "label": "GitHub", "url": "..." }] } },
  "sections": [
    {
      "id": "s2", "type": "experience", "title": "Experience", "order": 1,
      "entries": [
        {
          "id": "s2e1", "org": "Acme", "title": "SWE Intern", "location": "Remote",
          "startDate": "Jun 2025", "endDate": "", "current": true, "order": 0,
          "bullets": [{ "id": "s2e1b1", "text": "Built ...", "order": 0 }],
          "extra": {}
        }
      ]
    }
    // summary → entries[0].extra.text ; skills → entries[].extra.items[] ;
    // projects → extra.{url,technologies,description} ; education → extra.gpa
  ],
  "style": { "template": "standard", "accentColor": "#1a1a1a", "fontFamily": "...",
             "fontSizes": { "name": 22, "sectionHeader": 12, "subHeader": 11, "body": 10 },
             "spacing": { "section": 10, "entry": 6, "line": 1.3 },
             "margins": { "topBottom": 36, "sides": 44 },
             "headerAlignment": "center", "dateFormat": "MMM YYYY", "bulletIcon": "•",
             "educationOrder": "degree", "skillsLayout": "grouped", "justifyText": false },
  "score": 7.4,                 // derived on read (see Score formula)
  "suggestions": [ /* chips, see below */ ],
  "version": 3,                 // editor metadata (for undo)
  "availableVersions": [1, 2]   // snapshot versions you can revert to
}
```

### `GET /api/resumes/:id/document`
Returns the `ResumeDocument` (with `score` + `suggestions`). On first access it
is derived from the master profile **+ the resume's tailor-session accepted
suggestions** (keeping all unchanged content) and persisted.

### `PUT /api/resumes/:id/document`
Body: the full document, either as the bare object or `{ "document": {...} }`.
`score`/`suggestions`/`version` from the client are ignored (derived server-side).
Snapshots the prior version for undo, bumps `version`, returns the new document.

### `GET /api/resumes/:id/rewrite-suggestions`
```jsonc
{
  "suggestions": [
    { "id": "kw-kafka", "label": "Add “kafka”", "instruction": "Weave the keyword \"kafka\" into ...", "scope": "all" },
    { "id": "weak-verbs", "label": "Strengthen weak verbs", "instruction": "...", "scope": { "sectionId": "s2" } }
  ],
  "gap": { "matched": ["python","aws"], "missing": ["kafka"], "coverageCount": 2, "total": 3 }
}
```
Chips derive from the keyword gap (missing keywords), weak verbs, an over-long
summary, and a thin skills section, with a fixed fallback set when nothing
specific is detected.

---

## HTML → PDF rendering

### `POST /api/resumes/render-pdf`
```jsonc
// request
{ "html": "<div class=\"r-header\">...</div>", "css": ".r-name{font-weight:700}", "filename": "ada-acme.pdf" }
```
Returns `application/pdf` (with `Content-Disposition: attachment`).

**HTML/CSS expectations & security:**
- Send a **body fragment** in `html` and styles in `css` (they're composed into
  one self-contained document server-side). `<html>/<head>/<body>` wrappers in
  your `html` are stripped.
- The HTML is **sanitized** to a safe subset: `<script>`, `<iframe>`, `<link>`,
  `<object>`, `<style>`, `<img>`, `<svg>`, `<form>` and friends are removed;
  `on*` handlers, `javascript:` URLs and **all external resource references**
  (`http(s):`, `//`, `data:`, `file:`) are stripped. CSS `@import`, `url()` and
  `expression()` are removed. **No external assets load** — inline everything
  (web-safe fonts, no remote images).
- Gotenberg is additionally run with network access denied (see
  `DEPLOY_GOTENBERG.md`) — defense in depth against SSRF.
- Output is ATS-safe (real selectable text, single column) and **multi-page** —
  content is never trimmed to force one page.
- Cold start: the service may be scaling from zero. Expect up to ~30s on the
  first call after idle; a `503 "The PDF service is warming up — please try
  again in a few seconds."` means retry shortly.

---

## AI rewrite (section-scoped)

### `POST /api/resumes/:id/ai-rewrite`
```jsonc
// request
{ "scope": { "sectionId": "s2" },            // or { "entryId": "s2e1" } or "all"
  "instruction": "emphasize leadership",       // optional free-text
  "preset": "quantify" }                        // optional: concise|quantify|keywords|strong-verbs|impact

// response
{
  "document": { /* full ResumeDocument with refreshed score + suggestions + version */ },
  "changes": [
    { "path": "s2e1b1", "summary": "Rewrote bullet in SWE Intern @ Acme",
      "before": "Worked on the billing service", "after": "Shipped a billing service handling 2k req/s" }
  ],
  "changedPaths": ["s2e1b1"],
  "score": { "before": 6.8, "after": 7.4 }
}
```

**Diff / changedPaths format:** `path` is the **stable element id** of the field
that changed — a bullet id (`s2e1b1`) or, for the summary, the summary entry id
(`s1e1`). `changedPaths` is the list of those ids. The editor highlights exactly
those fields. Only **prose** is rewritten (bullets + summary); employer, title,
dates, school are never sent to the model, so they can't be fabricated.

**No-fabrication guarantee:** the rewriter only improves wording, tightens,
reorders, and weaves in JD keywords the candidate genuinely has. It never
invents experience, employers, dates, metrics, or skills.

### `POST /api/resumes/:id/revert`
```jsonc
{ "toVersion": 2 }   // a version from document.availableVersions
```
Restores that snapshot as the live document (the revert itself is also
snapshotted, so it's undoable). Returns the restored `ResumeDocument`.

---

## Score formula (deterministic, 0–10)

A **pure function** — not an LLM call. Same document + same JD keywords → same
score, so `{before, after}` on a rewrite is meaningful.

```
completeness ∈ [0,1]  (resume-hygiene checklist):
  name + email                 0.15
  non-empty summary            0.15
  ≥ 1 experience bullet        0.30
  ≥ 5 skills listed            0.20
  has education                0.10
  avg bullet length ≥ 6 words  0.10

coverage ∈ [0,1] = (# JD keywords present in the document) / (# JD keywords)

with JD keywords:  score = (0.65 · coverage + 0.35 · completeness) · 10
no JD keywords:    score =  completeness · 10
```
Rounded to 1 decimal. JD keywords come from the tailor analysis
(`matchedSkills ∪ missingSkills`), stored on the document and used for coverage.

---

## Tailor analysis additions

`GET /api/tailor/sessions/:id` — when `status === "succeeded"` and the user has a
master profile, the response is augmented with:

```jsonc
{
  /* ...existing session fields... */
  "document": { /* ResumeDocument (master + accepted suggestions) with score + chips */ },
  "keywordGap": { "matched": [...], "missing": [...], "coverageCount": 7, "total": 12 },
  "score": 7.1
}
```

## Notes on PDF resume parsing
Scanned/image-only PDFs (no selectable text) are detected and rejected with a
clear message asking the user to re-export a text-based PDF; OCR is intentionally
not run server-side (serverless cost/latency). Long resumes are chunked and
deterministically merged; sparse multi-page parses are retried with a stronger
model before saving.
