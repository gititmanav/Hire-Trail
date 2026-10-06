/** Your assistant — connect Claude Code (or any MCP client) to HireTrail.
 *
 *  Connecting makes a personal access token; the command that carries it is
 *  shown once, with a copy button, and never again (only its last four
 *  characters are kept for the list). A connection can read the search, make
 *  changes through the same paths as the app, and do the AI features placed
 *  in the "My assistant" lane — on the person's own subscription.
 *
 *  The connect card watches the connection happen, step by step, from the
 *  server's own stamps (helloAt = the client's first MCP initialize,
 *  firstToolAt = its first tool call), polling while it's open:
 *    1. copy the command  →  2. Claude Code says hello  →  3. its first request.
 *  `claude mcp add` only saves the setting — Claude Code connects when a
 *  session starts (or `claude mcp list` checks it), so step 2 says so. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, SquareTerminal } from "lucide-react";
import toast from "../../components/ui/toast.ts";

import Button from "../../components/ui/Button.tsx";
import Collapse from "../../components/ui/Collapse.tsx";
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
/** How often the open connect card asks whether the assistant has spoken. */
const WATCH_MS = 2000;
/** After this long without a hello, the card explains how to nudge it. */
const NUDGE_AFTER_MS = 40_000;

/** "claude-code 2.1.280" → "Claude Code 2.1.280". */
function clientLabel(raw: string): string {
  const [name = "", ...rest] = raw.trim().split(/\s+/);
  const known: Record<string, string> = { "claude-code": "Claude Code", "claude-ai": "Claude", claude: "Claude", cursor: "Cursor", codex: "Codex" };
  const label = known[name.toLowerCase()] ?? name;
  return [label, ...rest].join(" ").trim();
}

/** What a tool call was, in words ("whoami" → "who you are"). */
const TOOL_WORDS: Record<string, string> = {
  whoami: "who you are",
  list_applications: "your applications",
  get_application: "an application",
  list_deadlines: "your deadlines",
  list_contacts: "your contacts",
  get_master_profile: "your profile",
  list_resumes: "your resumes",
  get_resume_document: "a resume",
  get_tailoring_brief: "a tailoring brief",
  add_application: "to track a job",
  update_application: "to update an application",
  add_note: "to add a note",
  add_deadline: "to add a deadline",
  list_ai_tasks: "your AI tasks",
};
const toolWords = (tool: string) => TOOL_WORDS[tool] ?? tool.replace(/_/g, " ");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Things to ask first — each lands as step 3. */
const STARTERS = ["Say hi to HireTrail", "What's due this week in HireTrail?"];

function mcpUrl(): string {
  return new URL(`${getApiBaseURL()}/mcp`, window.location.origin).toString();
}

function useCopy(onCopied?: () => void) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select the text and copy it instead.");
    }
  };
  return { copied, copy };
}

function CopyBlock({ label, text, onCopied }: { label: string; text: string; onCopied?: () => void }) {
  const { copied, copy } = useCopy(onCopied);
  return (
    <div>
      <p className="text-[11.5px] font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="relative rounded-lg border border-border bg-background">
        <pre className="px-3 py-2.5 pr-11 text-[12px] leading-relaxed font-mono text-foreground whitespace-pre-wrap break-all">{text}</pre>
        <button
          type="button"
          onClick={() => void copy(text)}
          aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
          className={`absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            copied ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-control"
          }`}
        >
          {copied ? <Check size={14} strokeWidth={2.25} aria-hidden /> : <Copy size={14} strokeWidth={2} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function StarterChip({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2.5 rounded-full border border-border bg-background text-[12.5px] text-foreground hover:border-muted-foreground/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      “{text}”
      {copied
        ? <Check size={12} strokeWidth={2.5} className="text-emerald-600 dark:text-emerald-400" aria-label="Copied" />
        : <Copy size={12} strokeWidth={2} className="text-muted-foreground" aria-hidden />}
    </button>
  );
}

type StepState = "done" | "active" | "next";

/** One step of the connect card: a marker on a rail, a title, and its body. */
function Step({ state, title, status, last, children }: {
  state: StepState;
  title: string;
  /** One line under the title — what happened, or what to do. */
  status?: ReactNode;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-3">
      {!last && (
        <span aria-hidden className={`absolute left-[9px] top-6 -bottom-1 w-px transition-colors duration-500 ${state === "done" ? "bg-emerald-500/50" : "bg-border"}`} />
      )}
      <span aria-hidden className="relative mt-0.5 w-[19px] h-[19px] shrink-0 grid place-items-center">
        {state === "done" ? (
          <span className="w-[19px] h-[19px] grid place-items-center rounded-full bg-emerald-500 text-white animate-in">
            <Check size={11} strokeWidth={3} />
          </span>
        ) : state === "active" ? (
          <>
            <span className="absolute inset-0 rounded-full border border-foreground/25" />
            <span className="w-[7px] h-[7px] rounded-full bg-foreground/70 animate-pulse motion-reduce:animate-none" />
          </>
        ) : (
          <span className="w-[19px] h-[19px] rounded-full border border-border" />
        )}
      </span>
      <div className="min-w-0 flex-1 pb-5">
        <p className={`text-[13px] font-medium leading-5 ${state === "next" ? "text-muted-foreground" : "text-foreground"}`}>{title}</p>
        {status && <div className="mt-0.5 text-[12.5px] text-muted-foreground leading-relaxed">{status}</div>}
        <Collapse open={state !== "next" && !!children}>
          <div className="pt-3">{children}</div>
        </Collapse>
      </div>
    </li>
  );
}

/** The card a new connection opens: how to wire it up, then the connection
 *  happening live. `token` is the new connection as the server sees it. */
function ConnectFlow({ secret, token, onDone }: { secret: string; token: McpConnection | undefined; onDone: () => void }) {
  const [client, setClient] = useState<"claude" | "other">("claude");
  const [copied, setCopied] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const url = mcpUrl();

  const hello = token?.helloAt ?? null;
  const first = token?.firstToolAt ?? null;
  const who = token?.lastClient ? clientLabel(token.lastClient) : client === "claude" ? "Claude Code" : "Your assistant";
  const waitingName = client === "claude" ? "Claude Code" : "your assistant";

  // A clock for the "still nothing?" nudge and the "just now" labels, while it waits.
  useEffect(() => {
    if (first) return;
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, [first]);

  const steps: StepState[] = [
    copied || hello ? "done" : "active",
    hello ? "done" : copied ? "active" : "next",
    first ? "done" : hello ? "active" : "next",
  ];
  const doneCount = steps.filter((s) => s === "done").length;
  const nudge = !hello && copied && now - openedAt > NUDGE_AFTER_MS;

  return (
    <div className="relative bg-control/30">
      {/* The connection's progress along the card's top edge — green as each step lands. */}
      <div className="h-[2px] bg-border/70" aria-hidden>
        <div className="h-full bg-emerald-500 transition-[width] duration-700 ease-smooth motion-reduce:transition-none" style={{ width: `${(doneCount / 3) * 100}%` }} />
      </div>

      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <p className="text-[13px] font-semibold text-foreground" role="status" aria-live="polite">
            {first ? `${who} is connected and working` : hello ? `${who} is connected` : "Connect your assistant"}
          </p>
          {!hello && (
            <SegmentedControl<"claude" | "other">
              size="sm"
              ariaLabel="Assistant"
              value={client}
              onChange={setClient}
              segments={[{ value: "claude", label: "Claude Code" }, { value: "other", label: "Other assistants" }]}
            />
          )}
        </div>

        <ol>
          <Step
            state={steps[0]}
            title={client === "claude" ? "Copy the command" : "Copy the server details"}
            status={hello ? undefined : "Shown this once — HireTrail keeps only its last four characters."}
          >
            {!hello && (client === "claude" ? (
              <CopyBlock
                label="Run this in your terminal"
                text={`claude mcp add --transport http hiretrail ${url} --header "Authorization: Bearer ${secret}"`}
                onCopied={() => setCopied(true)}
              />
            ) : (
              <div className="space-y-3">
                <CopyBlock label="Server URL (Streamable HTTP)" text={url} onCopied={() => setCopied(true)} />
                <CopyBlock label="Header" text={`Authorization: Bearer ${secret}`} onCopied={() => setCopied(true)} />
              </div>
            ))}
          </Step>

          <Step
            state={steps[1]}
            title={hello ? `${who} said hello` : `Waiting for ${waitingName} to say hello…`}
            status={
              hello ? (
                <span key="hello" className="fade-up inline-block">Connected {sinceLabel(hello)} — it can see your search.</span>
              ) : client === "claude" ? (
                <>
                  The command saves the setting; Claude Code connects when you start a session — or run{" "}
                  <code className="font-mono text-[11.5px] text-foreground">claude mcp list</code> to check now. This updates on its own.
                </>
              ) : (
                "Add the server in your assistant's MCP settings. This updates on its own."
              )
            }
          >
            {nudge && (
              <p className="fade-up text-[12.5px] text-muted-foreground leading-relaxed rounded-lg border border-dashed border-border px-3 py-2.5">
                Still nothing? <code className="font-mono text-[11.5px] text-foreground">claude mcp list</code> should show{" "}
                <span className="text-foreground">hiretrail ✔ Connected</span>. If it says Failed, Claude Code can't reach{" "}
                <span className="font-mono text-[11.5px] text-foreground break-all">{url}</span> from where it runs.
              </p>
            )}
          </Step>

          <Step
            state={steps[2]}
            title={first ? `First request: ${toolWords(token!.firstTool)}` : "Ask it something"}
            status={first ? <span key="first" className="fade-up inline-block">{capitalize(sinceLabel(first) ?? "")} — the whole path works, end to end.</span> : hello ? "Try one of these in Claude Code:" : undefined}
            last
          >
            {hello && !first && (
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => <StarterChip key={s} text={s} />)}
              </div>
            )}
          </Step>
        </ol>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border">
        <p className="text-[12px] text-muted-foreground min-w-0">
          {hello
            ? "Put AI features in the My assistant lane on the map to run them on your subscription."
            : "Leaving now hides the token for good — you can always connect again."}
        </p>
        {hello
          ? <Button size="sm" variant="primary" onClick={onDone}>Done</Button>
          : <Button size="sm" variant="ghost" onClick={onDone}>Finish later</Button>}
      </div>
    </div>
  );
}

export default function AssistantSection({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<McpConnection | null>(null);

  const tokens = useQuery({
    queryKey: TOKENS_KEY,
    queryFn: mcpApi.list,
    enabled,
    // While a new connection's card is open, watch for its hello and first request.
    refetchInterval: (q) => {
      if (!secret || !pendingId) return false;
      const t = q.state.data?.find((x) => x.id === pendingId);
      return t?.firstToolAt ? false : WATCH_MS;
    },
  });
  const list = tokens.data ?? [];
  const pending = pendingId ? list.find((t) => t.id === pendingId) : undefined;

  // The moment it connects: one quiet confirmation, and the AI map's assistant lane wakes up.
  const announced = useRef(false);
  useEffect(() => {
    if (!secret || !pending?.helloAt || announced.current) return;
    announced.current = true;
    toast.success(`${pending.lastClient ? clientLabel(pending.lastClient) : "Your assistant"} is connected`);
    void qc.invalidateQueries({ queryKey: MY_AI_KEY });
  }, [secret, pending?.helloAt, pending?.lastClient, qc]);

  const create = useMutation({
    mutationFn: () => mcpApi.create({ name: "Claude Code" }),
    onSuccess: ({ secret: s, token }) => {
      announced.current = false;
      setSecret(s);
      setPendingId(token.id);
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
  const finish = () => { setSecret(null); setPendingId(null); };

  if (!enabled) {
    return (
      <div className="surface-card px-5 py-5">
        <p className="text-sm text-muted-foreground">HireTrail has switched off assistant connections for now.</p>
      </div>
    );
  }

  // The new connection is the card while it's open, not a row as well.
  const rows = list.filter((t) => !(secret && t.id === pendingId));
  return (
    <>
      <div className="surface-card divide-y divide-border overflow-hidden">
        {rows.length === 0 && !secret && (
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

        {rows.map((t) => (
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
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${t.helloAt ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <span className={t.helloAt ? "text-foreground/80" : ""}>{t.helloAt ? "Connected" : "Not connected yet"}</span>
                </span>
                {t.lastClient && <>{" · "}{clientLabel(t.lastClient)}</>}
                {t.lastUsedAt && <>{" · used "}{sinceLabel(t.lastUsedAt)}</>}
                {" · "}
                <span className="font-mono">••••{t.last4}</span>
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRemoving(t)}>Remove</Button>
          </div>
        ))}

        {secret && <ConnectFlow secret={secret} token={pending} onDone={finish} />}

        {rows.length > 0 && !secret && (
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
