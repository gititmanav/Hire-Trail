/** Light confirm dialog on the shared Modal shell. Destructive by default;
 *  `requireType` gates irreversible deletes behind type-to-confirm. */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal, ModalHeader } from "../ui/Modal.tsx";
import Button from "../ui/Button.tsx";
import { Input } from "../ui/Field.tsx";

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set, the user must type this exact string to enable the confirm
   *  button (type-to-confirm). Used for irreversible deletes. */
  requireType?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  requireType,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState("");
  const gated = !!requireType;
  const canConfirm = !gated || typed === requireType;

  return (
    <Modal onClose={onCancel} size="sm" ariaLabel={typeof title === "string" ? title : "Confirm"}>
      <ModalHeader
        title={title}
        description={message}
        icon={danger ? (
          <span className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle size={17} strokeWidth={1.8} className="text-red-500" aria-hidden />
          </span>
        ) : undefined}
      />
      <div className="px-6 pb-5">
        {gated && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Type <span className="font-mono font-semibold text-red-600 dark:text-red-400">{requireType}</span> to confirm
            </label>
            <Input
              data-autofocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireType}
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) onConfirm(); }}
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={!canConfirm}
            data-autofocus={gated ? undefined : true}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
