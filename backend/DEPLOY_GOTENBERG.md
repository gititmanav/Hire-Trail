# Deploying Gotenberg (HTML → PDF) on Google Cloud Run

The resume engine renders HTML/CSS to PDF by POSTing to a [Gotenberg](https://gotenberg.dev)
service (Chromium route). We run it on Cloud Run with **scale-to-zero** so it
costs nothing while idle. The backend reaches it via `GOTENBERG_URL`.

## 1. Deploy

```bash
gcloud run deploy gotenberg \
  --image gotenberg/gotenberg:8 \
  --port 3000 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 1Gi \
  --cpu 1 \
  --region us-central1
```

`--min-instances 0` is the scale-to-zero (free-when-idle) setting. The trade-off
is a **cold start** (~20–30s) on the first request after the instance has been
reaped — the backend handles this (see §4).

Cloud Run sets `$PORT`; Gotenberg listens on `--port 3000` and Cloud Run maps it.
After deploy, note the service URL, e.g. `https://gotenberg-abc123-uc.a.run.app`.

## 2. Lock it down (SSRF — required)

Resume HTML is sanitized of external references before we send it, but defense in
depth means **Gotenberg itself must not be able to fetch remote resources**. Pass
Chromium flags as container args:

```bash
gcloud run deploy gotenberg \
  --image gotenberg/gotenberg:8 \
  --port 3000 --allow-unauthenticated --min-instances 0 \
  --region us-central1 \
  --args=gotenberg,\
--chromium-deny-list=.*,\
--chromium-allow-list=^file:///tmp/.*,\
--chromium-disable-javascript=true,\
--api-timeout=40s
```

- `--chromium-deny-list=.*` blocks every URL,
- `--chromium-allow-list=^file:///tmp/.*` re-allows only Gotenberg's own temp
  files (the uploaded `index.html`),
- `--chromium-disable-javascript=true` stops any script execution,
- `--api-timeout=40s` gives Chromium room on cold pages.

> If you don't want `--allow-unauthenticated`, keep the service private and put
> the backend's service account on it with `roles/run.invoker`, then send an
> identity token. The current renderer assumes a public URL for simplicity.

## 3. Point the backend at it

Set `GOTENBERG_URL` to the service URL (no trailing slash):

```bash
# Vercel (production)
vercel env add GOTENBERG_URL
# value: https://gotenberg-abc123-uc.a.run.app

# Local dev (.env)
GOTENBERG_URL=http://localhost:3000   # if running gotenberg locally via Docker
```

Local Docker for development:

```bash
docker run --rm -p 3000:3000 gotenberg/gotenberg:8 \
  gotenberg --chromium-deny-list=.* --chromium-allow-list='^file:///tmp/.*' \
  --chromium-disable-javascript=true
```

When `GOTENBERG_URL` is empty, `POST /api/resumes/render-pdf` returns
`503 "PDF rendering isn't configured on the server"` — the rest of the app is
unaffected.

## 4. Cold-start behavior (already handled)

`services/pdf/renderHtml.ts`:
- first attempt with a ~30s timeout,
- on failure, pings `/health` to wake the instance and retries **once** (~35s),
- if it still can't render, returns `503 "The PDF service is warming up — please
  try again in a few seconds."` so the UI can prompt a retry.

## 5. Verify

```bash
curl -F "files=@index.html" \
  https://gotenberg-abc123-uc.a.run.app/forms/chromium/convert/html \
  -o out.pdf
# where index.html is any small HTML file → out.pdf should be a valid PDF
```

Health check: `GET https://gotenberg-abc123-uc.a.run.app/health` → `200`.
