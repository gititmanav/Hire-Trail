/**
 * Provider brand logos for the BYOK picker — resolved once, cached in Cloudinary,
 * reused thereafter (so we never re-fetch on every page load).
 *
 * Source = Google's favicon CDN (`s2/favicons`), same as company logos —
 * logo.clearbit.com is no longer reachable since the HubSpot acquisition. Each
 * provider id maps to a brand domain; the favicon is uploaded to Cloudinary and
 * the CDN URL persisted on AiProviderLogo. Best-effort: a failure caches an
 * empty url + timestamp so we don't hammer the source, and the UI falls back to
 * its brand-colored monogram.
 */
import { env } from "../../config/env.js";
import { AiProviderLogo } from "../../models/AiProviderLogo.js";

/** Curated provider id → brand domain. Unknown/dynamic providers get no logo
 *  (the UI monogram covers them). */
const PROVIDER_DOMAINS: Record<string, string> = {
  anthropic: "anthropic.com",
  openai: "openai.com",
  google: "google.com",
  bedrock: "aws.amazon.com",
  mistral: "mistral.ai",
  xai: "x.ai",
  groq: "groq.com",
  deepseek: "deepseek.com",
  openrouter: "openrouter.ai",
  perplexity: "perplexity.ai",
  cohere: "cohere.com",
  azure: "microsoft.com",
  vertex: "cloud.google.com",
  meta: "meta.com",
};

/** Re-resolve a previously-failed (empty) logo at most this often. */
const RETRY_MS = 24 * 60 * 60 * 1000;

function cloudinaryEnabled(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

async function uploadToCloudinary(buffer: Buffer, provider: string): Promise<{ url: string; publicId: string } | null> {
  try {
    const { cloudinary } = await import("../../config/cloudinary.js");
    return await new Promise((resolve) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "hiretrail/ai-provider-logos", public_id: provider, overwrite: true, resource_type: "image" },
        (err, result) => (err || !result ? resolve(null) : resolve({ url: result.secure_url, publicId: result.public_id })),
      );
      stream.end(buffer);
    });
  } catch {
    return null;
  }
}

/** Resolve one provider's logo (fetch favicon → Cloudinary), persisting the result. */
async function resolveOne(provider: string): Promise<string> {
  const domain = PROVIDER_DOMAINS[provider];
  if (!domain || !cloudinaryEnabled()) return "";
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`, { redirect: "follow" });
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    const up = await uploadToCloudinary(buf, provider);
    const url = up?.url ?? "";
    await AiProviderLogo.updateOne(
      { provider },
      { $set: { url, publicId: up?.publicId ?? "", fetchedAt: new Date() } },
      { upsert: true },
    );
    return url;
  } catch {
    await AiProviderLogo.updateOne({ provider }, { $set: { url: "", fetchedAt: new Date() } }, { upsert: true });
    return "";
  }
}

/** Map of provider id → cached Cloudinary logo url (only non-empty entries).
 *  Lazily resolves any provider that's never been fetched (or whose last attempt
 *  failed > RETRY_MS ago). Never throws. */
export async function getProviderLogos(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!cloudinaryEnabled()) return out;

  let cached: { provider: string; url: string; fetchedAt: Date }[] = [];
  try {
    cached = await AiProviderLogo.find({}).lean();
  } catch {
    return out;
  }
  const byProvider = new Map(cached.map((c) => [c.provider, c]));

  const now = Date.now();
  const toResolve = Object.keys(PROVIDER_DOMAINS).filter((p) => {
    const row = byProvider.get(p);
    if (!row) return true; // never tried
    if (row.url) return false; // already have it
    return now - new Date(row.fetchedAt).getTime() > RETRY_MS; // failed long ago → retry
  });

  // Resolve missing ones in parallel (bounded set — ≤14 curated providers).
  await Promise.all(toResolve.map(async (p) => { byProvider.set(p, { provider: p, url: await resolveOne(p), fetchedAt: new Date() }); }));

  for (const [p, row] of byProvider) if (row.url) out[p] = row.url;
  return out;
}
