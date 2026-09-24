/** Quiet confirmation with an Undo action, for reversible-but-consequential
 *  changes (archive, bulk moves). Undo runs once, then dismisses the toast. */
import toast from "react-hot-toast";

export function toastWithUndo(message: string, onUndo: () => void, { duration = 6000 } = {}) {
  toast.success(
    (t) => (
      <span className="inline-flex items-center gap-3">
        {message}
        <button
          type="button"
          onClick={() => { toast.dismiss(t.id); onUndo(); }}
          className="text-[13px] font-semibold text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Undo
        </button>
      </span>
    ),
    { duration },
  );
}
