# handoff.md — for the next session

_Last updated: 2026-09-24 — prod 500 fix + Applications revamp_

## Current state

- **On `main` (deployed):** the prod-500 fix (5b66f07: `attachDatabasePool` + `maxIdleTimeMS`, duplicate indexes). master == main at that commit.
- **Committed on `master`, NOT pushed:** the Applications revamp in logical slices — search-regex fix, applications API rewrite, UI primitives, unified Applications page + detail page, docs. Owner reviews locally, then pushes/merges when ready. Nothing here is on prod yet.
- Gates green (backend `tsc`, frontend `tsc -b`, `npm run build`). Browser-verified end to end on the local 650-app demo set — details and exactly what was/wasn't verified are in BUILD_JOURNAL 2026-09-24.
- **Decision log:** `Revamp.md` — read it before touching Applications.

## Immediate next step

1. **Owner picks Classic vs Table** (header toggle; dev builds show it, or visit `/applications?devtools=1` once on any browser). Then: delete the loser (ClassicList.tsx or TableList.tsx + its display options), drop the toggle + `hiretrail-dev-tools` flag, and — if Table wins — remove the Classic-only 1200px branch in `ApplicationsLayout`.
2. Owner decisions pending in Revamp.md → "needs an owner decision": the false auto-archive promise, the nightly scan that probably never runs on Vercel, boot migrations per cold start.
3. Next revamp page (owner's call). Queued engineering: migrate `ActionDropdown` internals onto `ui/Menu` (portal + layers), convert remaining hand-rolled modals (ImportModal, FeedbackModal, AuthModal, EmailScan*, ByokOnboarding, IdleWarning, WidgetPicker), stage-colour consolidation (Kanban's old CFG is gone; Calendar hexes remain separate).

## Wants owner hand-check

- **Prod soak for the 500 fix:** over a day of normal use, Vercel logs should show no `Unhandled Rejection: MongoNetworkTimeoutError` / `exit status: 128`. If they reappear, send a fresh log export.
- **Board drag with a real mouse** (feel, drop targets on empty columns, the Offer/Rejected slot) and keyboard drag (focus a card → Space → arrows → Space).
- **Export CSV** from Filters downloads exactly the filtered set.
- **Real account with JDs:** detail page JD clamp/expand, AI fit states (Analyze → pulse → result), Tailor resume drawer from the detail page.
- Old bookmarks: `/kanban`, `/calendar` redirect; extension links (`/applications?tailor=…`, `?tailorSession=…`) still open the tailoring drawer.
- Classic vs Table on your 2000px screen with your real data — that's the decision above.

## Still open from earlier sessions

- Gmail OAuth roundtrip on prod should land on `/settings/mailboxes?gmail=success`.
- Create/edit a real application, deadline, and contact end-to-end on prod (demo couldn't exercise every save path then; Applications saves are now verified locally).
- Anyone who opened a deep link during the 2026-09-23 outage may need one hard refresh.
