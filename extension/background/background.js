const API_BASE = "https://hiretrail.onrender.com/api";

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
        resumeId: null,
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
