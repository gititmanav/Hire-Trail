(() => {
  if (document.getElementById("hiretrail-fab")) return;

  const scrapers = {
    "linkedin.com": () => ({
      title: document.querySelector(".job-details-jobs-unified-top-card__job-title")?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim() || "",
      company: document.querySelector(".job-details-jobs-unified-top-card__company-name")?.textContent?.trim()
        || document.querySelector(".jobs-unified-top-card__company-name")?.textContent?.trim() || "",
      jobDescription: (document.querySelector(".jobs-description__content") || document.querySelector("#job-details"))?.innerText?.trim() || "",
      location: document.querySelector(".tvm__text")?.textContent?.trim()
        || document.querySelector(".job-details-jobs-unified-top-card__bullet")?.textContent?.trim() || "",
      salary: document.querySelector("[class*='salary']")?.textContent?.trim()
        || document.querySelector(".job-details-jobs-unified-top-card__job-insight span")?.textContent?.trim() || "",
      jobType: "",
    }),
    "indeed.com": () => ({
      title: document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim() || "",
      company: document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim()
        || document.querySelector(".jobsearch-InlineCompanyRating-companyHeader")?.textContent?.trim() || "",
      jobDescription: document.querySelector("#jobDescriptionText")?.innerText?.trim() || "",
      location: document.querySelector('[data-testid="jobsearch-JobInfoHeader-companyLocation"]')?.textContent?.trim()
        || document.querySelector('[data-testid="job-location"]')?.textContent?.trim() || "",
      salary: document.querySelector(".salary-snippet")?.textContent?.trim()
        || document.querySelector("#salaryInfoAndJobType span")?.textContent?.trim() || "",
      jobType: document.querySelector(".jobsearch-JobMetadataHeader-item")?.textContent?.trim() || "",
    }),
    "greenhouse.io": () => ({
      title: document.querySelector(".app-title")?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim() || "",
      company: document.querySelector(".company-name")?.textContent?.trim() || "",
      jobDescription: document.querySelector("#content .body")?.innerText?.trim()
        || document.querySelector("#content")?.innerText?.trim() || "",
      location: document.querySelector(".location")?.textContent?.trim() || "",
      salary: "",
      jobType: "",
    }),
    "lever.co": () => ({
      title: document.querySelector(".posting-headline h2")?.textContent?.trim() || "",
      company: document.querySelector(".posting-headline .sort-by-time")?.textContent?.trim()
        || document.querySelector(".posting-headline a")?.textContent?.trim() || "",
      jobDescription: (document.querySelector('[data-qa="job-description"]') || document.querySelector(".section.page-centered"))?.innerText?.trim() || "",
      location: document.querySelector(".sort-by-location")?.textContent?.trim()
        || document.querySelector(".posting-categories .location")?.textContent?.trim() || "",
      salary: "",
      jobType: document.querySelector(".commitment")?.textContent?.trim() || "",
    }),
    "glassdoor.com": () => ({
      title: document.querySelector('[data-test="job-title"]')?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim() || "",
      company: document.querySelector('[data-test="employer-name"]')?.textContent?.trim() || "",
      jobDescription: document.querySelector('[data-test="description"]')?.innerText?.trim() || "",
      location: document.querySelector('[data-test="job-location"]')?.textContent?.trim() || "",
      salary: document.querySelector('[data-test="detailSalary"]')?.textContent?.trim() || "",
      jobType: "",
    }),
    "myworkdayjobs.com": () => {
      // Try JSON-LD structured data first (available before JS renders)
      const jsonLd = (() => {
        try {
          const script = document.querySelector('script[type="application/ld+json"]');
          if (script) return JSON.parse(script.textContent);
        } catch {}
        return null;
      })();

      // DOM selectors (available after SPA renders)
      const title = document.querySelector('a[data-automation-id="jobTitle"]')?.textContent?.trim()
        || document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim()
        || document.querySelector("h2")?.textContent?.trim()
        || jsonLd?.title || "";

      const company = (() => {
        // Try JSON-LD hiringOrganization first
        if (jsonLd?.hiringOrganization?.name) return jsonLd.hiringOrganization.name;
        // Fall back to subdomain
        const sub = window.location.hostname.split(".")[0];
        return sub.charAt(0).toUpperCase() + sub.slice(1);
      })();

      const jobDescription = document.querySelector('[data-automation-id="richTextBody"]')?.innerText?.trim()
        || document.querySelector('[data-automation-id="jobPostingDescription"]')?.innerText?.trim()
        || jsonLd?.description || "";

      const location = document.querySelector('[data-automation-id="jobPostingLocation"]')?.textContent?.trim()
        || document.querySelector('[data-automation-id="locations"]')?.textContent?.trim()
        || jsonLd?.jobLocation?.address?.addressLocality || "";

      const jobType = jsonLd?.employmentType || "";

      return { title, company, jobDescription, location, salary: "", jobType };
    },
  };

  // Wait for a selector to appear (for SPAs like Workday). Supports comma-separated selectors.
  function waitForSelector(selector, timeout = 8000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  function scrape() {
    const host = window.location.hostname;
    for (const [domain, fn] of Object.entries(scrapers)) {
      if (host.includes(domain)) return fn();
    }
    return { title: document.title, company: "", jobDescription: "", location: "", salary: "", jobType: "" };
  }

  // Apply button selectors for auto-detect
  const applySelectors = {
    "linkedin.com": ['button[aria-label*="Apply"]', '.jobs-apply-button'],
    "indeed.com": ['.indeed-apply-button'],
    "greenhouse.io": ['.apply-button', '#apply_button'],
    "lever.co": ['.postings-btn-submit'],
    "glassdoor.com": ['button[data-test="apply-button"]'],
    "myworkdayjobs.com": ['button[data-automation-id="applyButton"]'],
  };

  // Auto-detect Apply button clicks
  function setupApplyDetection() {
    const host = window.location.hostname;
    let selectors = [];
    for (const [domain, sels] of Object.entries(applySelectors)) {
      if (host.includes(domain)) { selectors = sels; break; }
    }
    if (selectors.length === 0) return;

    let debounceTimer = null;
    document.body.addEventListener("click", async (e) => {
      const target = e.target;
      const match = selectors.some((sel) => target.closest(sel));
      if (!match) return;
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => { debounceTimer = null; }, 5000);

      // Silently check auth & track
      try {
        const authRes = await chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
        if (!authRes || !authRes.authenticated) return;
        const data = scrape();
        data.url = window.location.href;
        const result = await chrome.runtime.sendMessage({ type: "TRACK_JOB", data });
        if (result && result.success) {
          showStatus("Auto-tracked!", "success");
        }
        // Silent on 409 duplicate
      } catch {
        // Extension context invalidated — ignore silently
      }
    }, true);
  }

  // For Workday SPA, wait for content to load before showing FAB
  const host = window.location.hostname;
  if (host.includes("myworkdayjobs.com")) {
    // Wait for any of the known Workday job detail elements to appear
    waitForSelector('[data-automation-id="jobTitle"], [data-automation-id="jobPostingHeader"], [data-automation-id="richTextBody"]', 8000).then(() => initFAB());
  } else {
    initFAB();
  }

  function initFAB() {
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
      try {
        const authRes = await chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
        if (!authRes || !authRes.authenticated) {
          showStatus("Log in via extension popup first", "error");
          return;
        }

        const data = scrape();
        data.url = window.location.href;

        btn.style.opacity = "0.6";
        btn.style.pointerEvents = "none";
        btn.textContent = "...";

        const result = await chrome.runtime.sendMessage({ type: "TRACK_JOB", data });

        if (result && result.success) {
          showStatus("Tracked!", "success");
          btn.style.background = "#1d9e75";
          btn.textContent = "\u2713";
        } else if (result && result.duplicate) {
          showStatus("Already tracked!", "warning");
          btn.style.background = "#f59e0b";
          btn.textContent = "\u2713";
        } else {
          showStatus(result?.error || "Failed", "error");
          btn.style.background = "#e24b4a";
          btn.textContent = "!";
        }
      } catch (err) {
        showStatus("Refresh page & try again", "error");
        btn.style.background = "#e24b4a";
        btn.textContent = "!";
      } finally {
        setTimeout(() => {
          btn.style.background = "#378add";
          btn.textContent = "H";
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
        }, 2000);
      }
    });

    // Setup auto-detect after FAB
    setupApplyDetection();
  }

  function showStatus(text, type) {
    const existing = document.getElementById("hiretrail-status");
    if (existing) existing.remove();

    const colors = {
      success: "#1d9e75",
      error: "#e24b4a",
      warning: "#f59e0b",
    };

    const toast = document.createElement("div");
    toast.id = "hiretrail-status";
    toast.textContent = text;
    toast.style.cssText = `
      position: fixed; bottom: 84px; right: 24px; z-index: 999999;
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      font-family: -apple-system, sans-serif; font-weight: 500;
      color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      background: ${colors[type] || colors.error};
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
