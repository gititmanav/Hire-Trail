/**
 * Batched LLM classifier for the first-scan backfill.
 *
 * Each unit is a *thread* (one Gmail conversation), not a single email.
 * We send the latest email's headers/body to the model along with brief
 * summaries of the earlier messages in the thread, and the model returns:
 *
 *   - whether this thread is actually a job application
 *   - the company and role inferred from the content
 *   - the current stage based on the latest signal
 *   - a confidence
 *
 * Threads are packed in batches of `BATCH_SIZE` per LLM call. With
 * Gemini 2.5 Flash's million-token context, twenty threads fit
 * comfortably. The model returns an array of results in the same order.
 */
import { generateObject } from "ai";
import { z } from "zod";
import mongoose from "mongoose";

import { getModelForUser } from "../ai/index.js";
import { withAiRetry } from "../ai/withAiRetry.js";
import { STAGES, type Stage } from "../../models/Application.js";

const BATCH_SIZE = 15;
/** Body slice per message — keeps token usage predictable. */
const BODY_PER_MSG_CHARS = 600;

export interface BatchEmailMessage {
  /** Gmail message id. */
  id: string;
  from: string;
  fromDomain: string;
  subject: string;
  /** Plain-text body, will be truncated. */
  bodyText: string;
  internalDate: Date;
}

export interface BatchThread {
  threadId: string;
  /** Messages in chronological order. The classifier focuses on the latest. */
  messages: BatchEmailMessage[];
}

export interface BatchClassification {
  threadId: string;
  /** True when the model is confident this thread is a real job application. */
  isJobApplication: boolean;
  company: string;
  /** Best-effort job title; may be empty string. */
  role: string;
  /** Inferred current stage from the *latest* email's signal. */
  stage: Stage;
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

const STAGE_VALUES = STAGES; // narrow type for zod
const classificationItemSchema = z.object({
  threadId: z.string(),
  isJobApplication: z.boolean(),
  company: z.string().default(""),
  role: z.string().default(""),
  stage: z.enum(STAGE_VALUES as unknown as [Stage, ...Stage[]]).default("Applied"),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
  reasoning: z.string().default(""),
});

const classificationBatchSchema = z.object({
  results: z.array(classificationItemSchema),
});

const SYSTEM_PROMPT = `You classify Gmail threads to decide whether each is a job application the user submitted, and if so, infer the company, role, and current stage.

You will receive an array of threads. Each thread is a chronological list of one or more messages between the user and a recruiter / ATS / hiring contact.

Output a JSON object: { "results": [<one item per input thread>] }.

For each thread:
- isJobApplication: true only if the thread is clearly tied to the user submitting an application for a job, internship, or fellowship. Newsletters, generic job alerts, marketing, networking emails, and unrelated correspondence are false.
- company: the actual employer (not a recruiter agency, not a job-board host). Empty string if you cannot identify it.
- role: the job title from the thread, if mentioned. Empty string if unclear.
- stage: based on the LATEST message's signal, exactly one of:
    "Applied"   — application acknowledged, no further signal
    "OA"        — online assessment / coding test sent or due
    "Interview" — interview invited, scheduled, or post-interview correspondence
    "Offer"     — offer extended (verbal or letter)
    "Rejected"  — application declined
    "Drafting"  — never; this is a pre-submission state, not detectable from email
- confidence: "high" when wording is explicit, "medium" when clear but slightly hedged, "low" when you are inferring from context.
- reasoning: one short sentence (<= 25 words).

Return the same threadId you received. The results array must match the input order and length exactly.`;

function summariseMessage(msg: BatchEmailMessage, indexLabel: string): string {
  const body = msg.bodyText.replace(/\s+/g, " ").slice(0, BODY_PER_MSG_CHARS);
  return [
    `--- ${indexLabel} ---`,
    `From: ${msg.from}`,
    `Subject: ${msg.subject}`,
    `Date: ${msg.internalDate.toISOString()}`,
    `Body: ${body}`,
  ].join("\n");
}

function serialiseThread(thread: BatchThread): string {
  const lines: string[] = [`Thread: ${thread.threadId}`];
  thread.messages.forEach((msg, i) => {
    const tag = i === thread.messages.length - 1 ? "LATEST" : `MSG ${i + 1}`;
    lines.push(summariseMessage(msg, tag));
  });
  return lines.join("\n");
}

/**
 * Classify many threads in a small number of LLM calls.
 *
 * Returns an array aligned 1:1 with the input. Threads the model fails to
 * return are filled with a default "not a job application" result so the
 * caller can keep moving — failures are logged via the wrapping retry.
 */
export async function classifyThreadsInBatches(
  userId: string | mongoose.Types.ObjectId,
  threads: BatchThread[],
  onBatchClassified?: (classifiedSoFar: number) => Promise<void> | void,
): Promise<BatchClassification[]> {
  if (threads.length === 0) return [];

  const { model, provider, byok } = await getModelForUser(userId, "fast");
  const out: BatchClassification[] = [];

  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    const batch = threads.slice(i, i + BATCH_SIZE);
    const prompt = batch.map(serialiseThread).join("\n\n========\n\n");

    let results: z.infer<typeof classificationItemSchema>[] = [];
    try {
      const { object } = await withAiRetry({ provider, byok }, () =>
        generateObject({
          model,
          schema: classificationBatchSchema,
          system: SYSTEM_PROMPT,
          prompt,
        }),
      );
      results = object.results;
    } catch (err) {
      // Even after retry the batch failed — surface as not-a-job-app per thread
      // so the caller's overall job continues. The reasoning explains.
      console.error("[batchClassify] batch failed:", err);
      results = batch.map((t) => ({
        threadId: t.threadId,
        isJobApplication: false,
        company: "",
        role: "",
        stage: "Applied" as Stage,
        confidence: "low" as const,
        reasoning: `Classifier error: ${(err as Error)?.message?.slice(0, 100) ?? "unknown"}`,
      }));
    }

    // Re-align results to the input order by threadId. Defensive: the model
    // might reorder or drop entries even though we asked it not to.
    const byId = new Map(results.map((r) => [r.threadId, r]));
    for (const t of batch) {
      const r = byId.get(t.threadId);
      out.push(
        r ?? {
          threadId: t.threadId,
          isJobApplication: false,
          company: "",
          role: "",
          stage: "Applied",
          confidence: "low",
          reasoning: "Model did not return a result for this thread.",
        },
      );
    }

    if (onBatchClassified) {
      try {
        await onBatchClassified(out.length);
      } catch {
        // progress callback failures shouldn't abort the scan
      }
    }
  }

  return out;
}
