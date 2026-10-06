/** Add an AI key — one dialog for a person's own keys and the platform's.
 *  The key is tested before it's saved (the server refuses a rejected or
 *  empty one in the provider's words); afterwards only its nickname and last
 *  four characters are ever shown. */
import { useId, useState } from "react";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import toast from "../ui/toast.ts";

import { Modal, ModalBody, ModalFooter, ModalHeader } from "../ui/Modal.tsx";
import Button from "../ui/Button.tsx";
import { Field, Input, TextField } from "../ui/Field.tsx";
import Toggle from "../ui/Toggle.tsx";
import ProviderMark from "./ProviderMark.tsx";
import type { AiKeyResult, AiProviderId, AiProviderInfo } from "../../utils/aiApi.ts";

export default function AddKeyModal({
  providers, onSubmit, onClose, title = "Add an AI key", description, defaultProvider = "google", nicknamePrefix = "",
}: {
  providers: AiProviderInfo[];
  onSubmit: (body: { provider: AiProviderId; name: string; secret: string; freeTier: boolean }) => Promise<AiKeyResult>;
  onClose: () => void;
  title?: string;
  description?: string;
  defaultProvider?: AiProviderId;
  /** "HireTrail " for platform keys, so nicknames read as whose they are. */
  nicknamePrefix?: string;
}) {
  const [provider, setProvider] = useState<AiProviderId>(defaultProvider);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [reveal, setReveal] = useState(false);
  const [freeTier, setFreeTier] = useState(false);
  const [saving, setSaving] = useState(false);
  const secretId = useId();
  const info = providers.find((p) => p.id === provider) ?? providers[0];

  const submit = async () => {
    if (!secret.trim() || saving) return;
    setSaving(true);
    try {
      const { key, note } = await onSubmit({
        provider,
        name: name.trim() || `${nicknamePrefix}${info.label}`,
        secret: secret.trim(),
        freeTier: info.hasFreeTier && freeTier,
      });
      if (note) toast(note, { id: `key-note:${key.id}`, duration: 6000 });
      else toast.success(`${key.name} added`);
      onClose();
    } catch {
      // The server's sentence is already on screen (the API layer's toast);
      // the dialog stays open with what was typed.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="md" ariaLabel={title}>
      <ModalHeader
        title={title}
        description={description ?? "It's tested before it's saved. After that HireTrail only shows its nickname and last four characters."}
        onClose={onClose}
      />
      <ModalBody>
        <form
          id="add-ai-key"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          className="space-y-5"
        >
          <fieldset>
            <legend className="text-[13px] font-medium text-foreground mb-2">Provider</legend>
            <div role="radiogroup" aria-label="Provider" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {providers.map((p) => {
                const on = p.id === provider;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { setProvider(p.id); setFreeTier(false); }}
                    className={`relative flex flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      on ? "border-foreground/25 bg-control" : "border-border hover:bg-control/60"
                    }`}
                  >
                    <ProviderMark provider={p.id} size={24} />
                    <span className="text-[12.5px] font-medium text-foreground leading-tight">{p.label}</span>
                    {p.hasFreeTier && (
                      <span className="absolute top-2 right-2 text-[10px] font-medium text-muted-foreground">Free tier</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
              {info.blurb}{" "}
              <a
                href={info.keysUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 font-medium text-foreground hover:underline underline-offset-2"
              >
                Get a key<ArrowUpRight size={12} strokeWidth={2} aria-hidden />
              </a>
            </p>
          </fieldset>

          <TextField
            label="Nickname"
            placeholder={`${nicknamePrefix}${info.label}`}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            hint="What you'll see on the map — the key itself is never shown again."
          />

          <Field label="Key" htmlFor={secretId} required>
            <div className="relative">
              <Input
                id={secretId}
                data-autofocus
                type={reveal ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={info.keyHint}
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

          {info.hasFreeTier && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">This key is on a free tier</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  Free tiers can let the provider use what it receives to improve its models. HireTrail never sends your email to a free-tier key.
                </p>
              </div>
              <Toggle checked={freeTier} onChange={setFreeTier} label="This key is on a free tier" />
            </div>
          )}
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="add-ai-key" loading={saving} disabled={!secret.trim()}>
          {saving ? "Testing…" : "Add key"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
