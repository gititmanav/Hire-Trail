/** Edit a key: its nickname, its free-tier flag, or replace the key itself
 *  (rotation — the new key is tested first; a rejected one leaves the stored
 *  key untouched). */
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import toast from "../ui/toast.ts";

import { Modal, ModalBody, ModalFooter, ModalHeader } from "../ui/Modal.tsx";
import Button from "../ui/Button.tsx";
import { Field, Input, TextField } from "../ui/Field.tsx";
import Toggle from "../ui/Toggle.tsx";
import ProviderMark from "./ProviderMark.tsx";
import type { AiKey, AiKeyResult, AiProviderInfo } from "../../utils/aiApi.ts";

export default function EditKeyModal({ k, provider, onSave, onClose }: {
  k: AiKey;
  provider?: AiProviderInfo;
  onSave: (body: { name?: string; secret?: string; freeTier?: boolean }) => Promise<AiKeyResult>;
  onClose: () => void;
}) {
  const [name, setName] = useState(k.name);
  const [secret, setSecret] = useState("");
  const [reveal, setReveal] = useState(false);
  const [freeTier, setFreeTier] = useState(k.freeTier);
  const [saving, setSaving] = useState(false);
  const secretId = useId();

  const changed = name.trim() !== k.name || !!secret.trim() || freeTier !== k.freeTier;

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    try {
      const { note } = await onSave({
        ...(name.trim() && name.trim() !== k.name ? { name: name.trim() } : {}),
        ...(secret.trim() ? { secret: secret.trim() } : {}),
        ...(freeTier !== k.freeTier ? { freeTier } : {}),
      });
      if (note) toast(note, { duration: 6000 });
      else toast.success(secret.trim() ? "Key replaced" : "Key updated");
      onClose();
    } catch {
      // The API layer's toast carries the reason; the stored key is untouched.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm" ariaLabel={`Edit ${k.name}`}>
      <ModalHeader
        title={`Edit ${k.name}`}
        description={`${k.providerLabel} · ••••${k.last4}`}
        icon={<ProviderMark provider={k.provider} size={28} />}
        onClose={onClose}
      />
      <ModalBody>
        <form id="edit-ai-key" onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-5">
          <TextField label="Nickname" value={name} placeholder="What it's called on the map" maxLength={60} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Replace the key"
            htmlFor={secretId}
            hint="Leave empty to keep the current key. A new one is tested before it replaces anything."
          >
            <div className="relative">
              <Input
                id={secretId}
                type={reveal ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={provider?.keyHint ?? "New key"}
                autoComplete="off"
                spellCheck={false}
                className="pr-10 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? "Hide key" : "Show key"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {reveal ? <EyeOff size={14} strokeWidth={2} aria-hidden /> : <Eye size={14} strokeWidth={2} aria-hidden />}
              </button>
            </div>
          </Field>
          {provider?.hasFreeTier && (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">On a free tier</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">Email is never sent to a free-tier key.</p>
              </div>
              <Toggle checked={freeTier} onChange={setFreeTier} label="On a free tier" />
            </div>
          )}
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="edit-ai-key" loading={saving} disabled={!changed}>
          {saving && secret.trim() ? "Testing…" : "Save"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
