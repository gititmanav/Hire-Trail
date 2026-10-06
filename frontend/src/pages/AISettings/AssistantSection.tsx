/** Your assistant — connect Claude Code (or any MCP client) to HireTrail.
 *
 *  Connecting makes a personal access token; the command that carries it is
 *  shown once, with a copy button, and never again (only its last four
 *  characters are kept for the list). A connection can read the search, make
 *  changes through the same paths as the app, and do the AI features placed
 *  in the "My assistant" lane — on the person's own subscription. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, SquareTerminal } from "lucide-react";
import toast from "../../components/ui/toast.ts";

import Button from "../../components/ui/Button.tsx";
import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import { sinceLabel } from "../../components/ai/format.ts";
import { getApiBaseURL } from "../../config/apiBase.ts";
import BrandTile from "../../components/BrandLogo/BrandLogo.tsx";
import { mcpApi, type McpConnection } from "../../utils/aiApi.ts";
import { MY_AI_KEY } from "./useMyAi.ts";

/** A connection from Claude (Claude Code, Claude.ai) shows Claude's mark. */
const isClaude = (t: McpConnection) => /claude/i.test(`${t.lastClient} ${t.name}`);

const TOKENS_KEY = ["ai", "mcp-tokens"] as const;

function mcpUrl(): string {
  return new URL(`${getApiBaseURL()}/mcp`, window.location.origin).toString();
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select the text and copy it instead.");
    }
  };
  return (
    <div>
      <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="relative rounded-lg border border-border bg-control/60">
        <pre className="px-3 py-2.5 pr-11 text-[12px] leading-relaxed font-mono text-foreground whitespace-pre-wrap break-all">{text}</pre>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
          className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check size={14} strokeWidth={2.25} aria-hidden /> : <Copy size={14} strokeWidth={2} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

/** The one-time reveal after connecting: how to wire it up in each client. */
function ConnectInstructions({ secret, onDone }: { secret: string; onDone: () => void }) {
  const [client, setClient] = useState<"claude" | "other">("claude");
  const url = mcpUrl();
  return (
    <div className="px-5 py-4 space-y-4 bg-control/30">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] font-medium text-foreground">Add HireTrail to your assistant</p>
        <SegmentedControl<"claude" | "other">
          size="sm"
          ariaLabel="Assistant"
          value={client}
          onChange={setClient}
          segments={[{ value: "claude", label: "Claude Code" }, { value: "other", label: "Other assistants" }]}
        />
      </div>
      {client === "claude" ? (
        <CopyBlock
          label="Run this in your terminal"
          text={`claude mcp add --transport http hiretrail ${url} --header "Authorization: Bearer ${secret}"`}
        />
      ) : (
        <div className="space-y-3">
          <CopyBlock label="Server URL (Streamable HTTP)" text={url} />
          <CopyBlock label="Header" text={`Authorization: Bearer ${secret}`} />
        </div>
      )}
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        This is the only time the token is shown — copy it now. Then ask your assistant things like “what's due this week in HireTrail?” or “do my HireTrail AI tasks”.
      </p>
      <Button size="sm" onClick={onDone}>Done</Button>
    </div>
  );
}

export default function AssistantSection({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: TOKENS_KEY, queryFn: mcpApi.list, enabled });
  const [secret, setSecret] = useState<string | null>(null);
  const [removing, setRemoving] = useState<McpConnection | null>(null);

  const create = useMutation({
    mutationFn: () => mcpApi.create({ name: "Claude Code" }),
    onSuccess: ({ secret: s }) => {
      setSecret(s);
      void qc.invalidateQueries({ queryKey: TOKENS_KEY });
      void qc.invalidateQueries({ queryKey: MY_AI_KEY });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => mcpApi.revoke(id),
    onSuccess: () => {
      toast.success("Connection removed");
      void qc.invalidateQueries({ queryKey: TOKENS_KEY });
      void qc.invalidateQueries({ queryKey: MY_AI_KEY });
    },
  });

  if (!enabled) {
    return (
      <div className="surface-card px-5 py-5">
        <p className="text-sm text-muted-foreground">HireTrail has switched off assistant connections for now.</p>
      </div>
    );
  }

  const list = tokens.data ?? [];
  return (
    <>
      <div className="surface-card divide-y divide-border overflow-hidden">
        {list.length === 0 && !secret && (
          <div className="px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <BrandTile brand="anthropic" size={36} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Use HireTrail from Claude Code</p>
                <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed max-w-md">
                  Ask about your search, track jobs, and run AI features on your own subscription instead of HireTrail's.
                </p>
              </div>
            </div>
            <Button variant="primary" size="sm" loading={create.isPending} onClick={() => create.mutate()}>Connect Claude Code</Button>
          </div>
        )}

        {list.map((t) => (
          <div key={t.id} className="flex items-center gap-3.5 px-5 py-4">
            {isClaude(t) ? (
              <BrandTile brand="anthropic" size={32} />
            ) : (
              <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-control text-foreground/75">
                <SquareTerminal size={16} strokeWidth={1.8} aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5 truncate">
                <span className="font-mono">••••{t.last4}</span>
                {" · "}
                {t.lastUsedAt ? `used ${sinceLabel(t.lastUsedAt)}${t.lastClient ? ` from ${t.lastClient}` : ""}` : "not used yet"}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRemoving(t)}>Remove</Button>
          </div>
        ))}

        {secret && <ConnectInstructions secret={secret} onDone={() => setSecret(null)} />}

        {list.length > 0 && !secret && (
          <div className="px-5 py-3">
            <Button variant="ghost" size="sm" className="-ml-2" loading={create.isPending} onClick={() => create.mutate()}>
              <Plus size={14} strokeWidth={2} aria-hidden />Connect another
            </Button>
          </div>
        )}
      </div>

      {removing && (
        <ConfirmModal
          title={`Remove ${removing.name}?`}
          message="It stops working immediately. Features in the “My assistant” lane will wait until you connect again or move them."
          confirmLabel="Remove"
          onConfirm={() => { revoke.mutate(removing.id); setRemoving(null); }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  );
}
