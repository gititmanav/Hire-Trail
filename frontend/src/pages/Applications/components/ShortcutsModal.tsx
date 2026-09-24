/** Keyboard shortcuts for the Applications views, opened from the Filters menu.
 *  ("?" belongs to the app-wide overlay in GlobalShortcuts.) */
import { Modal, ModalHeader } from "../../../components/ui/Modal.tsx";

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "List",
    items: [
      { keys: ["j", "k"], label: "Move focus down / up" },
      { keys: ["Enter"], label: "Open application" },
      { keys: ["e"], label: "Edit focused application" },
      { keys: ["x"], label: "Select focused row" },
      { keys: ["Esc"], label: "Clear selection" },
    ],
  },
  {
    title: "Application page",
    items: [
      { keys: ["j", "k"], label: "Next / previous application" },
      { keys: ["e"], label: "Edit" },
      { keys: ["Esc"], label: "Back to the list" },
    ],
  },
  {
    title: "Anywhere here",
    items: [
      { keys: ["/"], label: "Search" },
      { keys: ["1", "2", "3"], label: "List · Board · Calendar" },
      { keys: ["f"], label: "Open filters" },
      { keys: ["c"], label: "New application" },
      { keys: ["?"], label: "All app-wide shortcuts" },
    ],
  },
];

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} size="sm" ariaLabel="Keyboard shortcuts">
      <ModalHeader title="Keyboard shortcuts" onClose={onClose} />
      <div className="px-6 pb-6 space-y-5">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g.title}</h3>
            <ul className="space-y-1.5">
              {g.items.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-foreground/85">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="min-w-[22px] text-center px-1.5 py-0.5 text-[11px] font-mono rounded-md border border-border bg-muted text-foreground">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
