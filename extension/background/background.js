const API_BASE = "https://hiretrail.manavkaneria.me/api";

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
});

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
