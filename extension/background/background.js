const API_BASE = "https://hiretrail.manavkaneria.me/api";
/** Web app origin (no /api). Used to open the HireTrail Tailor page after extension actions. */
const WEB_BASE = "https://hiretrail.manavkaneria.me";
const TELEMETRY_KEY = "telemetryEvents";
const TELEMETRY_STATUS_KEY = "telemetryStatus";
const MAX_TELEMETRY_EVENTS = 50;
const ERROR_CODES = {
  AUTH_MISSING: "AUTH_MISSING",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  DUPLICATE: "DUPLICATE",
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  NETWORK_ERROR: "NETWORK_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
  API_ERROR: "API_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

// Google OAuth config — same client ID as the web app
const GOOGLE_CLIENT_ID = "15875098947-v3ki4761r0f9d2co11f1kef87oj0ocar.apps.googleusercontent.com";
const GOOGLE_SCOPES = "openid email profile";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TRACK_JOB") {
    trackJob(msg.data).then(sendResponse);
    return true; // async
  }
  if (msg.type === "CHECK_AUTH") {
    chrome.storage.local.get(["token"]).then(({ token }) => {
      sendResponse({ authenticated: !!token });
    });
    return true;
  }
  if (msg.type === "REFRESH_PREFS") {
    refreshClipboardPrefs().then(sendResponse);
    return true;
  }
  if (msg.type === "GOOGLE_LOGIN") {
    handleGoogleLogin().then(sendResponse);
    return true;
  }
  if (msg.type === "GET_TELEMETRY") {
    getTelemetry().then(sendResponse);
    return true;
  }
  if (msg.type === "CLEAR_TELEMETRY") {
    clearTelemetry().then(sendResponse);
    return true;
  }
  if (msg.type === "TAILOR_INIT") {
    tailorInit(msg.data).then(sendResponse);
    return true;
  }
  if (msg.type === "FIND_DRAFT_FOR_URL") {
    findDraftForUrl(msg.url).then(sendResponse);
    return true;
  }
  if (msg.type === "TRACK_CONTACT") {
    trackContact(msg.data).then(sendResponse);
    return true;
  }
});

/** Pull the user's clipboard preferences from the web app and cache them in
 *  chrome.storage.local so the content script can read them synchronously at
 *  click-time (a network fetch there would drop the clipboard user-gesture).
 *  Falls back to safe defaults; never throws. */
async function refreshClipboardPrefs() {
  const { token } = await chrome.storage.local.get(["token"]);
  if (!token) return { ok: false };
  try {
    const res = await fetchWithTimeout(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false };
    const me = await res.json();
    const prefs = {
      clipboardCopyOnTrack: me.clipboardCopyOnTrack === true,
      clipboardFormat: ["raw", "metadata", "prompt"].includes(me.clipboardFormat)
        ? me.clipboardFormat
        : "metadata",
      clipboardPromptTemplate: typeof me.clipboardPromptTemplate === "string" ? me.clipboardPromptTemplate : "",
    };
    await chrome.storage.local.set(prefs);
    return { ok: true, ...prefs };
  } catch {
    return { ok: false };
  }
}

/** Track a LinkedIn-profile contact. Find-or-creates the Company server-side
 *  (the /contacts POST handler does that when companyId is empty), and writes
 *  a short auto-note explaining provenance. */
async function trackContact(data) {
  const { token } = await chrome.storage.local.get(["token"]);
  if (!token) return { success: false, error: "Not signed in.", code: ERROR_CODES.AUTH_MISSING };

  const name = truncate(data?.name || "", 100);
  const linkedinUrl = truncate(data?.linkedinUrl || "", 500);
  const company = truncate(data?.company || "", 200);
  const role = truncate(data?.role || "", 100);
  const headline = truncate(data?.headline || "", 300);
  const location = truncate(data?.location || "", 200);

  if (!name) return { success: false, error: "Couldn't read the profile name." };
  if (!linkedinUrl) return { success: false, error: "Couldn't read the LinkedIn URL." };

  // Compact 4-5 line provenance + context note so the user sees why this contact exists.
  const noteLines = [
    `Saved from LinkedIn on ${new Date().toLocaleDateString()}.`,
  ];
  if (headline) noteLines.push(`Headline: ${headline}`);
  if (company || role) noteLines.push(`${role ? `${role} ` : ""}${company ? `at ${company}` : ""}`.trim());
  if (location) noteLines.push(`Based in ${location}.`);
  noteLines.push("Reach out with a personalized note — referencing a shared interest helps a lot.");
  const notes = noteLines.filter(Boolean).slice(0, 5).join("\n");

  const payload = {
    name,
    company: company || "Unknown",
    role,
    linkedinUrl,
    connectionSource: "LinkedIn",
    notes,
    companyId: null,
    applicationIds: [],
    outreachStatus: "not_contacted",
    nextFollowUpDate: null,
    source: "extension",
  };

  try {
    const res = await fetchWithTimeout(`${API_BASE}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) return { success: false, error: "Session expired — sign in again.", code: ERROR_CODES.AUTH_EXPIRED };
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || "Could not save contact." };
    }
    const contact = await res.json();
    return { success: true, contact };
  } catch (err) {
    if (err?.name === "AbortError") return { success: false, error: "Timed out.", code: ERROR_CODES.NETWORK_TIMEOUT };
    return { success: false, error: err?.message || "Network error", code: ERROR_CODES.NETWORK_ERROR };
  }
}

/** Used by Apply auto-detect: if the user previously clicked "Tailor" for this JD,
 *  return the session id so content.js can prompt them to confirm in HireTrail rather
 *  than silently creating a duplicate "Applied" record. */
async function findDraftForUrl(url) {
  if (!url) return { session: null };
  const { token } = await chrome.storage.local.get(["token"]);
  if (!token) return { session: null };
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tailor/sessions/find-draft?url=${encodeURIComponent(url)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { session: null };
    const data = await res.json();
    return data;
  } catch {
    return { session: null };
  }
}

/** Extension "Tailor" entrypoint — creates a Drafting Application + TailorSession server-side,
 *  returns the session id so content.js can open the HireTrail Tailor page in a new tab. */
async function tailorInit(data) {
  const { token } = await chrome.storage.local.get(["token"]);
  if (!token) return { success: false, error: "Not signed in. Open the popup and sign in first.", code: ERROR_CODES.AUTH_MISSING };
  try {
    const res = await fetchWithTimeout(`${API_BASE}/tailor/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jobDescription: data.jobDescription || "",
        jobTitle: data.title || "",
        company: data.company || "",
        role: data.title || "",
        url: data.url || "",
      }),
    });
    if (res.status === 401) return { success: false, error: "Session expired — sign in again.", code: ERROR_CODES.AUTH_EXPIRED };
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg = typeof body?.error === "string" ? body.error : "Could not start a tailor session.";
      return { success: false, error: errMsg, code: ERROR_CODES.API_ERROR };
    }
    const result = await res.json();
    const sessionId = result?.session?._id;
    if (!sessionId) return { success: false, error: "No session id returned.", code: ERROR_CODES.API_ERROR };
    const applicationId = result?.application?._id;
    // Open the broad tailoring drawer over the application in the HireTrail web app
    // (the JD is already on the session, so it's not passed in the URL).
    try {
      const url = applicationId
        ? `${WEB_BASE}/applications?tailor=${applicationId}`
        : `${WEB_BASE}/applications?tailorSession=${sessionId}`;
      await chrome.tabs.create({ url });
    } catch { /* user can navigate manually if popup blocked */ }
    return { success: true, sessionId, applicationId };
  } catch (err) {
    if (err?.name === "AbortError") return { success: false, error: "Timed out.", code: ERROR_CODES.NETWORK_TIMEOUT };
    return { success: false, error: err?.message || "Network error", code: ERROR_CODES.NETWORK_ERROR };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function retryRequest(requestFn, { attempts = 3, baseDelayMs = 600 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const jitter = Math.floor(Math.random() * 250);
      const delay = baseDelayMs * attempt + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function humanMessageForCode(errorCode) {
  switch (errorCode) {
    case ERROR_CODES.AUTH_MISSING:
      return "Not logged in";
    case ERROR_CODES.VALIDATION_FAILED:
      return "Invalid job data";
    case ERROR_CODES.AUTH_EXPIRED:
      return "Session expired";
    case ERROR_CODES.DUPLICATE:
      return "Job already tracked";
    case ERROR_CODES.NETWORK_TIMEOUT:
      return "Request timed out";
    case ERROR_CODES.NETWORK_ERROR:
      return "Network error";
    case ERROR_CODES.SERVER_ERROR:
      return "Server error";
    case ERROR_CODES.API_ERROR:
      return "API error";
    default:
      return "Unknown error";
  }
}

async function appendTelemetryEvent(event) {
  const { [TELEMETRY_KEY]: events = [] } = await chrome.storage.local.get([TELEMETRY_KEY]);
  const nextEvents = [
    { ts: Date.now(), ...event },
    ...events,
  ].slice(0, MAX_TELEMETRY_EVENTS);
  await chrome.storage.local.set({ [TELEMETRY_KEY]: nextEvents });
}

async function setTelemetryStatus(partialStatus) {
  const { [TELEMETRY_STATUS_KEY]: existing = {} } = await chrome.storage.local.get([TELEMETRY_STATUS_KEY]);
  const next = { ...existing, ...partialStatus, updatedAt: Date.now() };
  await chrome.storage.local.set({ [TELEMETRY_STATUS_KEY]: next });
}

async function getTelemetry() {
  const result = await chrome.storage.local.get([TELEMETRY_KEY, TELEMETRY_STATUS_KEY]);
  return {
    events: result[TELEMETRY_KEY] || [],
    status: result[TELEMETRY_STATUS_KEY] || {},
  };
}

async function clearTelemetry() {
  await chrome.storage.local.set({
    [TELEMETRY_KEY]: [],
    [TELEMETRY_STATUS_KEY]: {
      successCount: 0,
      errorCount: 0,
      lastErrorCode: "",
      lastErrorMessage: "",
      updatedAt: Date.now(),
    },
  });
  return { success: true };
}

function truncate(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeIncomingJob(data) {
  const normalized = {
    company: truncate(data?.company || "Unknown", 200),
    role: truncate(data?.title || "Unknown", 200),
    jobUrl: truncate(data?.url || "", 2000),
    stage: "Applied",
    notes: "",
    jobDescription: truncate(data?.jobDescription || "", 12000),
    location: truncate(data?.location || "", 300),
    salary: truncate(data?.salary || "", 200),
    jobType: truncate(data?.jobType || "", 120),
    source: "extension",
  };
  if (!normalized.jobUrl.startsWith("http://") && !normalized.jobUrl.startsWith("https://")) {
    normalized.jobUrl = "";
  }
  return normalized;
}

/**
 * Google sign-in via chrome.identity.launchWebAuthFlow
 * Opens a Google consent popup, gets an access token, exchanges it for a HireTrail JWT
 */
async function handleGoogleLogin() {
  try {
    const redirectUrl = chrome.identity.getRedirectURL();

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", GOOGLE_SCOPES);
    authUrl.searchParams.set("prompt", "select_account");

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    // Extract access_token from the redirect URL fragment
    const hashParams = new URL(responseUrl.replace("#", "?")).searchParams;
    const accessToken = hashParams.get("access_token");

    if (!accessToken) {
      return { error: "No access token received from Google" };
    }

    // Exchange Google access token for a HireTrail JWT
    const res = await fetch(`${API_BASE}/auth/google/extension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { error: err.error || "Google sign-in failed" };
    }

    const data = await res.json();
    return { token: data.token, user: data.user };
  } catch (err) {
    // User closed the popup or flow was cancelled
    if (err.message?.includes("canceled") || err.message?.includes("closed")) {
      return { error: "Sign-in was cancelled" };
    }
    return { error: err.message || "Google sign-in failed" };
  }
}

async function trackJob(data) {
  const { token } = await chrome.storage.local.get(["token"]);
  if (!token) {
    const errorCode = ERROR_CODES.AUTH_MISSING;
    await appendTelemetryEvent({
      level: "warn",
      type: "track_failed",
      errorCode,
      message: humanMessageForCode(errorCode),
      url: data?.url || "",
    });
    await setTelemetryStatus({
      errorCount: (await getTelemetry()).status.errorCount + 1 || 1,
      lastErrorCode: errorCode,
      lastErrorMessage: humanMessageForCode(errorCode),
    });
    return { success: false, error: "Not logged in", errorCode };
  }
  const normalizedJob = normalizeIncomingJob(data);
  if (!normalizedJob.role || normalizedJob.role.length < 2) {
    const errorCode = ERROR_CODES.VALIDATION_FAILED;
    await appendTelemetryEvent({
      level: "warn",
      type: "track_failed",
      errorCode,
      message: "Missing/invalid title",
      url: normalizedJob.jobUrl,
    });
    await setTelemetryStatus({
      errorCount: (await getTelemetry()).status.errorCount + 1 || 1,
      lastErrorCode: errorCode,
      lastErrorMessage: humanMessageForCode(errorCode),
    });
    return { success: false, error: "Could not detect a valid job title on this page.", errorCode };
  }

  let resumeId = null;
  try {
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      resumeId = me.primaryResumeId || null;
    }
  } catch {
    /* still create application without resume */
  }

  try {
    await appendTelemetryEvent({
      level: "info",
      type: "track_started",
      url: normalizedJob.jobUrl,
      message: "Track request started",
    });

    // Just the job: HireTrail reads the posting server-side and fills in the
    // company, role, location, pay and type — nothing is written into notes.
    const payload = { ...normalizedJob, resumeId };
    const res = await retryRequest(async () => {
      const response = await fetchWithTimeout(`${API_BASE}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }, 15000);
      if (response.status >= 500) {
        throw new Error(`Server error ${response.status}`);
      }
      return response;
    });

    if (res.status === 409) {
      const errorCode = ERROR_CODES.DUPLICATE;
      const status = (await getTelemetry()).status;
      await appendTelemetryEvent({
        level: "info",
        type: "track_duplicate",
        errorCode,
        message: humanMessageForCode(errorCode),
        url: normalizedJob.jobUrl,
      });
      await setTelemetryStatus({
        errorCount: (status.errorCount || 0) + 1,
        lastErrorCode: errorCode,
        lastErrorMessage: humanMessageForCode(errorCode),
      });
      return { success: false, duplicate: true, error: "Already tracked!", errorCode };
    }

    if (res.status === 401) {
      await chrome.storage.local.remove(["token", "user"]);
      const errorCode = ERROR_CODES.AUTH_EXPIRED;
      const status = (await getTelemetry()).status;
      await appendTelemetryEvent({
        level: "warn",
        type: "track_failed",
        errorCode,
        message: humanMessageForCode(errorCode),
        url: normalizedJob.jobUrl,
      });
      await setTelemetryStatus({
        errorCount: (status.errorCount || 0) + 1,
        lastErrorCode: errorCode,
        lastErrorMessage: humanMessageForCode(errorCode),
      });
      return { success: false, error: "Session expired. Please log in again.", errorCode };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorCode = res.status >= 500 ? ERROR_CODES.SERVER_ERROR : ERROR_CODES.API_ERROR;
      const status = (await getTelemetry()).status;
      await appendTelemetryEvent({
        level: "error",
        type: "track_failed",
        errorCode,
        message: err.error || humanMessageForCode(errorCode),
        status: res.status,
        url: normalizedJob.jobUrl,
      });
      await setTelemetryStatus({
        errorCount: (status.errorCount || 0) + 1,
        lastErrorCode: errorCode,
        lastErrorMessage: err.error || humanMessageForCode(errorCode),
      });
      return { success: false, error: err.error || "Failed to track", errorCode };
    }

    // Update badge count
    const { badgeCount = 0 } = await chrome.storage.local.get(["badgeCount"]);
    const newCount = badgeCount + 1;
    await chrome.storage.local.set({ badgeCount: newCount });
    chrome.action.setBadgeText({ text: String(newCount) });
    chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
    const status = (await getTelemetry()).status;
    await appendTelemetryEvent({
      level: "info",
      type: "track_success",
      message: "Job tracked successfully",
      url: normalizedJob.jobUrl,
    });
    await setTelemetryStatus({
      successCount: (status.successCount || 0) + 1,
      lastSuccessAt: Date.now(),
    });

    return { success: true };
  } catch (err) {
    const errorCode = err?.name === "AbortError" ? ERROR_CODES.NETWORK_TIMEOUT : ERROR_CODES.NETWORK_ERROR;
    const message = err?.name === "AbortError"
      ? "Request timed out. Please retry."
      : (err?.message || "Request failed");
    const status = (await getTelemetry()).status;
    await appendTelemetryEvent({
      level: "error",
      type: "track_failed",
      errorCode,
      message,
      url: normalizedJob.jobUrl,
    });
    await setTelemetryStatus({
      errorCount: (status.errorCount || 0) + 1,
      lastErrorCode: errorCode,
      lastErrorMessage: message,
    });
    return { success: false, error: message, errorCode };
  }
}

// Badge reset alarm — daily at midnight
chrome.alarms.create("resetBadge", { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetBadge") {
    chrome.storage.local.set({ badgeCount: 0 });
    chrome.action.setBadgeText({ text: "" });
  }
});
