/** The keys behind a map, one row each: mark, nickname, provider and last
 *  four, health in plain words, and what it runs. Actions live in the row's
 *  menu: make default, check now, edit (rename / replace / free tier),
 *  delete (one light confirm, which says what moves). */
import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import toast from "../ui/toast.ts";

import Menu from "../ui/Menu.tsx";
import Button from "../ui/Button.tsx";
import ConfirmModal from "../ConfirmModal/ConfirmModal.tsx";
import ProviderMark from "./ProviderMark.tsx";
import KeyHealth from "./KeyHealth.tsx";
import EditKeyModal from "./EditKeyModal.tsx";
import { count } from "./format.ts";
import type { AiKey, AiKeyResult, AiProviderInfo } from "../../utils/aiApi.ts";

export interface KeyListActions {
  update: (id: string, body: { name?: string; secret?: string; freeTier?: boolean }) => Promise<AiKeyResult>;
  check: (id: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  setDefault?: (id: string) => Promise<unknown>;
}

export default function KeyList({ keys, defaultKeyId, providers, runs, actions, onChanged, onAdd, empty }: {
  keys: AiKey[];
  defaultKeyId: string | null;
  providers: AiProviderInfo[];
  /** Feature count per key id (what it runs). */
  runs: Record<string, number>;
  actions: KeyListActions;
  onChanged: () => void;
  onAdd: () => void;
  empty: React.ReactNode;
}) {
  const [editing, setEditing] = useState<AiKey | null>(null);
  const [deleting, setDeleting] = useState<AiKey | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const check = async (k: AiKey) => {
    setChecking(k.id);
    try {
      await actions.check(k.id);
      toast.success(`${k.name} is working`);
    } catch {
      // The API layer says what's wrong; the row shows it after the refresh.
    } finally {
      setChecking(null);
      onChanged();
    }
  };

  if (!keys.length) {
    return (
      <div className="surface-card px-5 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">{empty}</div>
        <Button variant="primary" size="sm" onClick={onAdd}><Plus size={14} strokeWidth={2} aria-hidden />Add a key</Button>
      </div>
    );
  }

  return (
    <>
      <div className="surface-card divide-y divide-border overflow-hidden">
        {keys.map((k) => {
          const isDefault = k.id === defaultKeyId;
          const n = runs[k.id] ?? 0;
          return (
            <div key={k.id} className="flex items-start gap-3.5 px-5 py-4">
              <ProviderMark provider={k.provider} size={32} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                  {isDefault && actions.setDefault && (
                    <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-control text-muted-foreground">Default</span>
                  )}
                  {k.freeTier && <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-control text-muted-foreground">Free tier</span>}
                </div>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">
                  {k.providerLabel} · <span className="font-mono">••••{k.last4}</span>
                  {n > 0 && <> · runs {count(n, "feature")}</>}
                </p>
                <KeyHealth k={k} className="mt-1" />
              </div>
              <Menu
                ariaLabel={`Actions for ${k.name}`}
                align="end"
                width={200}
                trigger={
                  <button
                    type="button"
                    className="w-8 h-8 -mr-1.5 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal size={16} strokeWidth={2} aria-hidden />
                  </button>
                }
                items={[
                  ...(actions.setDefault && !isDefault
                    ? [{ label: "Make default", onSelect: () => void actions.setDefault!(k.id).then(onChanged).catch(() => undefined) }]
                    : []),
                  { label: checking === k.id ? "Checking…" : "Check now", onSelect: () => void check(k), disabled: checking === k.id },
                  { label: "Edit", onSelect: () => setEditing(k) },
                  { label: "Delete", onSelect: () => setDeleting(k), destructive: true, dividerBefore: true },
                ]}
              />
            </div>
          );
        })}
        <div className="px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onAdd} className="-ml-2"><Plus size={14} strokeWidth={2} aria-hidden />Add a key</Button>
        </div>
      </div>

      {editing && (
        <EditKeyModal
          k={editing}
          provider={providers.find((p) => p.id === editing.provider)}
          onSave={async (body) => {
            const r = await actions.update(editing.id, body);
            onChanged();
            return r;
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          message={
            (runs[deleting.id] ?? 0) > 0
              ? `${count(runs[deleting.id], "feature")} run on it. They'll move to ${keys.length > 1 ? "your other key" : "where they ran before"} — nothing stops working without telling you.`
              : "Nothing runs on it. HireTrail forgets the key immediately."
          }
          confirmLabel="Delete key"
          onConfirm={async () => {
            const k = deleting;
            setDeleting(null);
            try {
              await actions.remove(k.id);
              toast.success(`${k.name} deleted`);
            } finally {
              onChanged();
            }
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
