(() => {
  if (document.getElementById("hiretrail-fab")) return;

  const scrapers = {
    "linkedin.com": () => ({
      title: document.querySelector(".job-details-jobs-unified-top-card__job-title")?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim() || "",
      company: document.querySelector(".job-details-jobs-unified-top-card__company-name")?.textContent?.trim()
        || document.querySelector(".jobs-unified-top-card__company-name")?.textContent?.trim() || "",
    }),
    "indeed.com": () => ({
      title: document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim() || "",
      company: document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim()
        || document.querySelector(".jobsearch-InlineCompanyRating-companyHeader")?.textContent?.trim() || "",
    }),
    "greenhouse.io": () => ({
      title: document.querySelector(".app-title")?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim() || "",
      company: document.querySelector(".company-name")?.textContent?.trim() || "",
    }),
    "lever.co": () => ({
      title: document.querySelector(".posting-headline h2")?.textContent?.trim() || "",
      company: document.querySelector(".posting-headline .sort-by-time")?.textContent?.trim()
        || document.querySelector(".posting-headline a")?.textContent?.trim() || "",
    }),
  };

  function scrape() {
    const host = window.location.hostname;
    for (const [domain, fn] of Object.entries(scrapers)) {
      if (host.includes(domain)) return fn();
    }
    return { title: document.title, company: "" };
  }

  // Create floating action button
  const fab = document.createElement("div");
  fab.id = "hiretrail-fab";
  fab.innerHTML = `
    <div style="
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      width: 52px; height: 52px; border-radius: 50%;
      background: #378add; color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 14px rgba(55, 138, 221, 0.4);
      font-weight: 700; font-size: 18px; font-family: -apple-system, sans-serif;
      transition: all 0.2s ease;
    " id="hiretrail-btn">H</div>
  `;
  document.body.appendChild(fab);

  const btn = document.getElementById("hiretrail-btn");

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.1)";
    btn.style.boxShadow = "0 6px 20px rgba(55, 138, 221, 0.5)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 4px 14px rgba(55, 138, 221, 0.4)";
  });

  btn.addEventListener("click", async () => {
    // Check auth first
    const authRes = await chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
    if (!authRes.authenticated) {
      showStatus("Log in via extension popup first", "error");
      return;
    }

    const data = scrape();
    data.url = window.location.href;

    btn.style.opacity = "0.6";
    btn.style.pointerEvents = "none";
    btn.textContent = "...";

    const result = await chrome.runtime.sendMessage({ type: "TRACK_JOB", data });

    if (result.success) {
      showStatus("Tracked!", "success");
      btn.style.background = "#1d9e75";
      btn.textContent = "\u2713";
      setTimeout(() => {
        btn.style.background = "#378add";
        btn.textContent = "H";
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
      }, 2000);
    } else {
      showStatus(result.error || "Failed", "error");
      btn.style.background = "#e24b4a";
      btn.textContent = "!";
      setTimeout(() => {
        btn.style.background = "#378add";
        btn.textContent = "H";
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
      }, 2000);
    }
  });

  function showStatus(text, type) {
    const existing = document.getElementById("hiretrail-status");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "hiretrail-status";
    toast.textContent = text;
    toast.style.cssText = `
      position: fixed; bottom: 84px; right: 24px; z-index: 999999;
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      font-family: -apple-system, sans-serif; font-weight: 500;
      color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      background: ${type === "success" ? "#1d9e75" : "#e24b4a"};
      animation: hiretrail-fadein 0.2s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Inject animation keyframe
  const style = document.createElement("style");
  style.textContent = `@keyframes hiretrail-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`;
  document.head.appendChild(style);
})();
