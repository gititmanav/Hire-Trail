/** One person's AI, for an admin: this month's use, their keys and
 *  assistant connections, and the override — suspend their AI, change their
 *  Included allowance, put all their features on one lane, leave a note.
 *  Also opened from Admin → Users. */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "../../../components/ui/toast.ts";

import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../../components/ui/Modal.tsx";
import Button from "../../../components/ui/Button.tsx";
import Toggle from "../../../components/ui/Toggle.tsx";
import Select from "../../../components/ui/Select.tsx";
import { Field, Input, Textarea } from "../../../components/ui/Field.tsx";
import { Skeleton } from "../../../components/Skeleton/Skeleton.tsx";
import ProviderMark from "../../../components/ai/ProviderMark.tsx";
import { usd } from "../../../components/ai/format.ts";
import { adminAiApi, LANE_LABEL, type AiLane, type AiUserOverride } from "../../../utils/aiApi.ts";

export default function UserAiModal({ userId, label, onClose }: { userId: string; label: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "ai", "user", userId], queryFn: () => adminAiApi.getUser(userId), meta: { errorMessage: "Couldn't load their AI." } });
  const [draft, setDraft] = useState<AiUserOverride | null>(null);
  const [allowance, setAllowance] = useState("");
  useEffect(() => {
    if (!q.data) return;
    setDraft(q.data.override);
    setAllowance(q.data.override.allowanceUsd == null ? "" : String(q.data.override.allowanceUsd));
  }, [q.data]);

  const save = useMutation({
    mutationFn: (o: Partial<AiUserOverride>) => adminAiApi.setUserOverride(userId, o),
    onSuccess: () => {
      toast.success(`Saved for ${label}`);
      void qc.invalidateQueries({ queryKey: ["admin", "ai"] });
      onClose();
    },
  });

  const parsedAllowance = allowance.trim() === "" ? null : Number(allowance);
  const allowanceValid = parsedAllowance === null || (Number.isFinite(parsedAllowance) && parsedAllowance >= 0);
  const u = q.data?.usage;

  return (
    <Modal onClose={onClose} size="md" ariaLabel={`AI for ${label}`}>
      <ModalHeader title={`AI for ${label}`} description="Overrides apply to this person only, on top of the platform rules." onClose={onClose} />
      <ModalBody>
        {!q.data || !draft ? (
          <div className="space-y-3 pb-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-24 w-full" /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">Included this month</p>
                <p className="text-[15px] font-semibold text-foreground tabular-nums mt-0.5">{usd(u!.included.spentUsd)}</p>
              </div>
              <div className="rounded-xl border border-border px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">AI runs</p>
                <p className="text-[15px] font-semibold text-foreground tabular-nums mt-0.5">{u!.totals.calls.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">Assistant connections</p>
                <p className="text-[15px] font-semibold text-foreground tabular-nums mt-0.5">{q.data.assistantTokens}</p>
              </div>
            </div>

            {q.data.keys.length > 0 && (
              <div>
                <p className="text-[13px] font-medium text-foreground mb-1.5">Their keys</p>
                <ul className="space-y-1">
                  {q.data.keys.map((k) => (
                    <li key={`${k.provider}${k.last4}`} className="flex items-center gap-2 text-[13px]">
                      <ProviderMark provider={k.provider} size={18} />
                      <span className="text-foreground">{k.name}</span>
                      <span className="text-muted-foreground font-mono text-[12px]">••••{k.last4}</span>
                      {!k.healthy && <span className="text-[12px] text-red-600 dark:text-red-400">· failing</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">Suspend their AI</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">Every AI feature stops for them, on every lane. The rest of HireTrail keeps working.</p>
              </div>
              <Toggle checked={draft.suspended} onChange={(v) => setDraft({ ...draft, suspended: v })} label="Suspend their AI" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Included allowance" hint={`Empty = the platform's. Used: ${usd(u!.included.spentUsd)} of ${usd(u!.included.allowanceUsd)}.`} error={allowanceValid ? undefined : "A dollar amount, 0 or more."}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                  <Input inputMode="decimal" value={allowance} onChange={(e) => setAllowance(e.target.value)} placeholder="Platform default" className="pl-6 tabular-nums" />
                </div>
              </Field>
              <Field label="Put all their features on" hint="Where their lane exists for a feature.">
                <Select
                  ariaLabel="Put all their features on"
                  value={draft.forcedLane ?? ""}
                  onChange={(v) => setDraft({ ...draft, forcedLane: (v || null) as AiLane | null })}
                  options={[{ value: "", label: "No — they choose" }, ...(["included", "byok", "assistant", "off"] as AiLane[]).map((l) => ({ value: l, label: LANE_LABEL[l] }))]}
                />
              </Field>
            </div>

            <Field label="Note" hint="Only admins see this.">
              <Textarea rows={2} maxLength={280} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>

          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={!draft || !allowanceValid}
          onClick={() => draft && save.mutate({ ...draft, allowanceUsd: parsedAllowance })}
        >
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
}
