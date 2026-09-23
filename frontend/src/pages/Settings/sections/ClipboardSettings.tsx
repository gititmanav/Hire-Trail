/** Settings → Clipboard: what the browser extension writes to the clipboard
 *  when tracking a job. */
import { useContext, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, ChevronDown } from "lucide-react";
import { api } from "../../../utils/api.ts";
import type { User } from "../../../types";
import { UserContext } from "../../../App.tsx";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import ActionDropdown from "../../../components/ActionDropdown/ActionDropdown.tsx";
import Toggle from "../../../components/ui/Toggle.tsx";
import { SettingsCard, SettingsHeader, SettingsRow } from "../ui.tsx";

const DEFAULT_CLIPBOARD_PROMPT =
  "Here's a job description. Based on my resume, what should I emphasize for this role, and what gaps should I prepare to address?";

const CLIPBOARD_FORMAT_OPTIONS: { value: "raw" | "metadata" | "prompt"; label: string; hint: string }[] = [
  { value: "metadata", label: "Job details + description", hint: "Title, company and link, followed by the full description." },
  { value: "raw", label: "Description only", hint: "Just the raw job description text — nothing else." },
  { value: "prompt", label: "Custom prompt + description", hint: "Your own instruction, with the description added after it." },
];

export default function ClipboardSettings() {
  const { user, setUser } = useContext(UserContext);
  const { requireRealAccount } = useDemoGate();

  const [copyOnTrack, setCopyOnTrack] = useState(user?.clipboardCopyOnTrack === true);
  const [format, setFormat] = useState<"raw" | "metadata" | "prompt">(user?.clipboardFormat ?? "metadata");
  const [promptTemplate, setPromptTemplate] = useState(user?.clipboardPromptTemplate ?? DEFAULT_CLIPBOARD_PROMPT);
  const [saving, setSaving] = useState(false);
  /** Last-persisted prompt, so the textarea only saves on blur when it changed. */
  const promptBaselineRef = useRef(user?.clipboardPromptTemplate ?? DEFAULT_CLIPBOARD_PROMPT);

  const save = async (patch: Partial<Pick<User, "clipboardCopyOnTrack" | "clipboardFormat" | "clipboardPromptTemplate">>) => {
    setSaving(true);
    try {
      const res = await api.put<User>("/auth/profile", patch);
      setUser(res.data);
    } catch {
      toast.error("Could not update setting");
      throw new Error("save-failed");
    } finally {
      setSaving(false);
    }
  };

  const activeOption = CLIPBOARD_FORMAT_OPTIONS.find((o) => o.value === format);

  return (
    <div>
      <SettingsHeader
        title="Clipboard"
        description="Control whether the browser extension copies a job's description to your clipboard — handy for pasting into Claude."
      />

      <SettingsCard>
        <SettingsRow
          title="Copy JD when I track a job"
          description={<>The extension's <strong>Copy JD</strong> action always works regardless of this setting.</>}
        >
          <Toggle
            label="Copy job description to clipboard when tracking a job"
            checked={copyOnTrack}
            disabled={saving}
            onChange={async (next) => {
              if (!requireRealAccount("Clipboard")) return;
              setCopyOnTrack(next);
              try {
                await save({ clipboardCopyOnTrack: next });
                toast.success(next ? "Auto-copy enabled" : "Auto-copy disabled");
              } catch {
                setCopyOnTrack(!next);
              }
            }}
          />
        </SettingsRow>

        <SettingsRow title="Clipboard format" description={activeOption?.hint}>
          <ActionDropdown
            align="right"
            menuWidth="w-64"
            disabled={saving}
            trigger={
              <button
                type="button"
                disabled={saving}
                className="w-full sm:w-64 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              >
                <span className="truncate">{activeOption?.label}</span>
                <ChevronDown size={16} className="text-muted-foreground shrink-0" />
              </button>
            }
            items={CLIPBOARD_FORMAT_OPTIONS.map((opt) => ({
              label: opt.label,
              icon: <Check size={14} className={format === opt.value ? "text-primary" : "opacity-0"} />,
              onClick: async () => {
                if (opt.value === format) return;
                if (!requireRealAccount("Clipboard")) return;
                const prev = format;
                setFormat(opt.value);
                try {
                  await save({ clipboardFormat: opt.value });
                  toast.success("Clipboard format updated");
                } catch {
                  setFormat(prev);
                }
              },
            }))}
          />
        </SettingsRow>

        {format === "prompt" && (
          <SettingsRow
            stack
            title="Your prompt"
            description={<>Copied before the job description. Use <code className="px-1 py-0.5 rounded bg-muted text-[11px]">{"{jd}"}</code> to control exactly where the description goes.</>}
          >
            <textarea
              value={promptTemplate}
              disabled={saving}
              rows={3}
              maxLength={2000}
              placeholder={DEFAULT_CLIPBOARD_PROMPT}
              onChange={(e) => setPromptTemplate(e.target.value)}
              onBlur={async () => {
                if (promptTemplate === promptBaselineRef.current) return;
                if (!requireRealAccount("Clipboard")) {
                  setPromptTemplate(promptBaselineRef.current);
                  return;
                }
                try {
                  await save({ clipboardPromptTemplate: promptTemplate });
                  promptBaselineRef.current = promptTemplate;
                  toast.success("Prompt saved");
                } catch {
                  setPromptTemplate(promptBaselineRef.current);
                }
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring disabled:opacity-50 resize-y leading-relaxed"
            />
          </SettingsRow>
        )}
      </SettingsCard>
    </div>
  );
}
