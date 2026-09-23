# handoff.md — for the next session

_Last updated: 2026-08-05, third work block (modal system + Applications stage-filter fix)_

## Current state

- **In the working tree (not committed):** everything from today — theme trim + System theme, the Settings area, sidebar Notifications, AND the new modal system: `components/ui/` (Modal, Button, Field, Select, DateInput, Toggle, layers.ts) with 8 dialogs converted (application, deadline, contact, calendar quick-add, confirm, resume, report-rejection, delete-account). Plus the server-side stage filter/counts fix for Applications (backend + frontend).
- Gates green: `tsc` both sides, `npm run build`. Live-verified: stage chips/tab counts, application + deadline modals in light/dark, calendar/select popover layering (Esc order, portal above modal body).
- **Owner decision:** Applications page redesign is theirs to do manually — do NOT restyle that page; bug fixes only.

## Immediate next step

1. **Continue the modal/primitive sweep** (same pattern, mechanical):
   - User-facing: ImportModal, FeedbackModal, AuthModal, EmailScanFlowModal (+ consent modal, has raw `<select>`), ByokOnboardingModal, IdleWarningModal, ShortcutsModal, WidgetPicker, Profile EditDrawer, Companies page modal, ResumePreview overlay.
   - Native date inputs left: ImportExport page, admin (Announcements, AuditLogs, InviteSystem). Raw `<select>` left: admin pages, EmailScanFlowModal.
2. Then the other P1 fixes: stage-color tokens (5 conflicting definitions), z-index scale (partly addressed by layers.ts + z-50/z-[70] convention).

## Mid-flight / decisions pending

- Old `Modal` names inside pages were renamed (ApplicationFormModal / DeadlineFormModal / ContactFormModal) — new dialogs must import from `components/ui/Modal.tsx`, never hand-roll `fixed inset-0`.
- ConfirmModal API unchanged (title/message/requireType/…) — all existing call sites work as-is.
- Deadlines' snooze ActionDropdown and toolbar dropdowns still on ActionDropdown — fine for menus (actions), but form-value pickers should migrate to `ui/Select` when touched.

## Wants owner hand-check

- Create/edit a real application, deadline, and contact end-to-end (demo user is write-gated, so submissions weren't exercised — fields, validation toasts, and save paths are wired identically to before, but eyes-on beats assumption).
- Calendar quick-add on a real month boundary + the resume modal's file drop.
- Feel of the new Select/DateInput keyboard nav (arrows, PageUp/Down in calendar) — automation can't judge feel.
- Prod after deploy: Gmail OAuth roundtrip to `/settings/mailboxes?gmail=success` (from previous block).
