# handoff.md — for the next session

_Last updated: 2026-09-25 — owner feedback round: drag-tracking Custom themes, charcoal default, Sora selected tab / hairlines / card shadows_

## Current state

- **On `main` (deployed):** the prod-500 fix (5b66f07). Nothing from the revamp is on prod.
- **Committed on `master`, NOT pushed:** the Applications revamp (5 commits, see BUILD_JOURNAL 2026-09-24).
- **Uncommitted in the working tree:** the card-shell / dropdown / motion round (BUILD_JOURNAL "2026-09-24 (later)") **and** the Personalize/theme rounds (BUILD_JOURNAL "2026-09-24 (latest)" + "2026-09-25"): preferences on the account, Personalize v2 (Classic | Table, System / Light / Dark / Custom), the theme engine + property test, theme state/persistence/boot script, `ui/Slider` + `ui/ColorPicker`, the palette-variable colour discipline, the Admin shell. Gates green. Two renames/deletions are staged by git (`hooks/useTheme.ts → .tsx`, `utils/themes.ts` removed). Owner reviews locally, then commit/push when ready.
- **Decision log:** `Revamp.md` — "Personalize page + Custom theme" (plan → built, findings, **"Noted, not changed (owner call)"**), and **"Parked — decide at the end"**.

## Immediate next step

0. **Owner confirm:** Dark mode now mirrors the charcoal default (near-white accent) — keep, or give Dark its own accent? Also "Table" vs "Minimal". Mid-tone Custom backgrounds now keep your exact colour (text ≥ 4.58:1 there instead of 7:1) — the trade-off for a background that follows the drag.

1. **Owner calls** (Revamp.md → "Noted, not changed"): light-mode tag chips bottom out at 4.2:1; white on `bg-amber-600` buttons is 3.2:1.
2. **Owner hand-check** in a visible browser: Personalize → Custom — drag the square/hue/contrast (should feel instant), EyeDropper, Import/Copy; then reload (no flash), sign out (landing is Light), open Admin (preset).
3. Visual passes still owed from the previous round (listed in BUILD_JOURNAL "2026-09-24 (later)" → NOT verified) and the Resume Studio Style tab with a real tailored document.
4. Queued engineering: convert the six hand-rolled switches to `ui/Toggle`; convert the hand-rolled overlays to `ui/Modal`; Calendar height math vs the card shell during the Calendar revamp; Safari/Firefox pass on the picker and boot script.

## How the theme works (short)

- Presets live only in `App.css` (`:root` / `.dark`; `.theme-light` / `.theme-dark` for previews). Palette classes read `--palette-*` (Tailwind's exact values).
- Custom = `utils/theme.ts` `generateTheme(custom)` → inline tokens on `<html>` via `utils/themeDom.ts` `paintTheme` (the only painter). `text-primary` reads `--brand-text`.
- State: `hooks/useTheme.tsx` — `ThemeContext` (dark, mode, revision) and `ThemeControlsContext` (Personalize). Charts re-read on `revision`.
- Run the proof after touching the engine: `cd frontend && node --test src/utils/theme.test.ts`.

## Still open from earlier sessions

- Gmail OAuth roundtrip on prod should land on `/settings/mailboxes?gmail=success`.
- Create/edit a real application, deadline, and contact end-to-end on prod.
- Anyone who opened a deep link during the 2026-09-23 outage may need one hard refresh.
- The old `{userId, archived}` index still exists in Atlas — drop it manually.
- Prod soak for the 500 fix; Board drag with a real mouse; Export CSV; real account with JDs.
