const API_BASE = "https://hiretrail.manavkaneria.me/api";

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
  if (msg.type === "GOOGLE_LOGIN") {
    handleGoogleLogin().then(sendResponse);
    return true;
  }
});

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
  if (!token) return { success: false, error: "Not logged in" };

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
    const res = await fetch(`${API_BASE}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        company: data.company || "Unknown",
        role: data.title || "Unknown",
        jobUrl: data.url || "",
        stage: "Applied",
        notes: "",
        resumeId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error || "Failed to track" };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
