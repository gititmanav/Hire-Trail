(() => {
  if (document.getElementById("hiretrail-fab")) return;
  const core = window.HireTrailExtractionCore;
  const extractorConfig = window.HireTrailExtractorsConfig;
  if (!core || !extractorConfig?.buildExtractorRegistry) return;
  let lastTrackedUrl = "";
  let isFabInitialized = false;
  const FAB_TOP_RATIO_KEY = "fabTopRatio";

  // --- Clipboard copy -------------------------------------------------------
  // Cached user prefs so the content script can decide what/whether to copy
  // synchronously at click-time. A network fetch here would lose the clipboard
  // user-gesture, so prefs are hydrated from chrome.storage (synced by the
  // background script from /auth/me) and kept live via storage change events.
  const DEFAULT_CLIPBOARD_PROMPT =
    "Here's a job description. Based on my resume, what should I emphasize for this role, and what gaps should I prepare to address?";
  const clipboardPrefs = { copyOnTrack: false, format: "metadata", promptTemplate: "" };
  /** Merge a prefs object (from storage or a REFRESH_PREFS response) into the cache. */
  function applyClipboardPrefs(p) {
    if (!p) return;
    if (typeof p.clipboardCopyOnTrack === "boolean") clipboardPrefs.copyOnTrack = p.clipboardCopyOnTrack;
    if (typeof p.clipboardFormat === "string") clipboardPrefs.format = p.clipboardFormat;
    if (typeof p.clipboardPromptTemplate === "string") clipboardPrefs.promptTemplate = p.clipboardPromptTemplate;
  }
  chrome.storage.local
    .get(["clipboardCopyOnTrack", "clipboardFormat", "clipboardPromptTemplate"])
    .then(applyClipboardPrefs)
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.clipboardCopyOnTrack && typeof changes.clipboardCopyOnTrack.newValue === "boolean") {
      clipboardPrefs.copyOnTrack = changes.clipboardCopyOnTrack.newValue;
    }
    if (changes.clipboardFormat && typeof changes.clipboardFormat.newValue === "string") {
      clipboardPrefs.format = changes.clipboardFormat.newValue;
    }
    if (changes.clipboardPromptTemplate && typeof changes.clipboardPromptTemplate.newValue === "string") {
      clipboardPrefs.promptTemplate = changes.clipboardPromptTemplate.newValue;
    }
  });
  // Ask the background to refresh prefs from the server for next time.
  try { chrome.runtime.sendMessage({ type: "REFRESH_PREFS" }).catch(() => {}); } catch { /* context not ready */ }

  /** Write text to the clipboard. Must be called synchronously inside a user
   *  gesture (e.g. a FAB-popover click) for the async Clipboard API to be
   *  allowed; falls back to a hidden-textarea execCommand copy. */
  async function copyTextToClipboard(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  /** One-line "Role · Company · Location" header for the metadata/prompt formats. */
  function clipboardJobLine(data) {
    const parts = [];
    const title = (data.title || data.role || "").trim();
    const company = (data.company || "").trim();
    const location = (data.location || "").trim();
    if (title) parts.push(title);
    if (company) parts.push(company);
    if (location) parts.push(location);
    return parts.join(" · ");
  }

  /** Build the clipboard payload for the chosen format. Uses the full scraped
   *  JD (not the truncated copy that tracking sends to the server). */
  function buildClipboardText(data, format) {
    const jd = (data.jobDescription || "").trim();
    if (format === "raw") return jd;
    const jobLine = clipboardJobLine(data);
    const url = (data.url || "").trim();
    const header = (jobLine ? jobLine + "\n" : "") + (url ? "Source: " + url + "\n" : "");
    const jdBlock = header + "\n--- Job Description ---\n" + jd;
    if (format === "prompt") {
      const tmpl = (clipboardPrefs.promptTemplate || "").trim() || DEFAULT_CLIPBOARD_PROMPT;
      // `{jd}` lets the user place the description anywhere (prepend or append);
      // without it, the description block is appended after their prompt.
      if (tmpl.includes("{jd}")) return tmpl.replace(/\{jd\}/g, jdBlock);
      return tmpl + "\n\n" + jdBlock;
    }
    // "metadata" (default)
    return jdBlock;
  }

  const scrapers = {
    "linkedin.com": () => {
      // Scope selectors to LinkedIn's own containers to avoid third-party extension
      // injections (e.g., Jobright) that add their own h1/h2 elements into the DOM.
      const topCard = document.querySelector(".job-details-jobs-unified-top-card__container--two-pane")
        || document.querySelector(".jobs-unified-top-card");

      const title = topCard?.querySelector(".job-details-jobs-unified-top-card__job-title h1")?.textContent?.trim()
        || topCard?.querySelector(".job-details-jobs-unified-top-card__job-title")?.textContent?.trim()
        || topCard?.querySelector("h1 a")?.textContent?.trim()
        || topCard?.querySelector("h1")?.textContent?.trim()
        || document.querySelector(".job-details-jobs-unified-top-card__job-title")?.textContent?.trim() || "";

      const company = topCard?.querySelector(".job-details-jobs-unified-top-card__company-name a")?.textContent?.trim()
        || topCard?.querySelector(".job-details-jobs-unified-top-card__company-name")?.textContent?.trim()
        || document.querySelector(".jobs-unified-top-card__company-name")?.textContent?.trim() || "";

      // For JD, only read LinkedIn's own description content, not injected elements
      const jdEl = document.querySelector(".jobs-description__content .jobs-box__html-content")
        || document.querySelector("#job-details")
        || document.querySelector(".jobs-description__content");
      const jobDescription = jdEl?.innerText?.trim() || "";

      const location = topCard?.querySelector(".tvm__text")?.textContent?.trim()
        || topCard?.querySelector(".job-details-jobs-unified-top-card__bullet")?.textContent?.trim()
        || document.querySelector(".tvm__text")?.textContent?.trim() || "";

      const salary = document.querySelector("[class*='salary']")?.textContent?.trim()
        || document.querySelector(".job-details-jobs-unified-top-card__job-insight span")?.textContent?.trim() || "";

      return { title, company, jobDescription, location, salary, jobType: "" };
    },
    "indeed.com": () => {
      const container = document.querySelector(".jobsearch-ViewjobPaneWrapper")
        || document.querySelector(".jobsearch-JobComponent");

      const title = container?.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim()
        || container?.querySelector("h2.jobsearch-JobInfoHeader-title")?.textContent?.trim()
        || document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim() || "";

      const company = container?.querySelector('[data-testid="inlineHeader-companyName"] a')?.textContent?.trim()
        || container?.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim()
        || document.querySelector(".jobsearch-InlineCompanyRating-companyHeader")?.textContent?.trim() || "";

      const location = container?.querySelector('[data-testid="inlineHeader-companyLocation"]')?.textContent?.trim()
        || document.querySelector('[data-testid="jobsearch-JobInfoHeader-companyLocation"]')?.textContent?.trim()
        || document.querySelector('[data-testid="job-location"]')?.textContent?.trim() || "";

      const salary = document.querySelector("#salaryInfoAndJobType span")?.textContent?.trim()
        || document.querySelector(".salary-snippet")?.textContent?.trim() || "";

      const jobType = document.querySelector('#salaryInfoAndJobType .css-1u1g3ig')?.textContent?.trim()
        || document.querySelector(".jobsearch-JobMetadataHeader-item")?.textContent?.trim() || "";

      return { title, company, jobDescription: document.querySelector("#jobDescriptionText")?.innerText?.trim() || "", location, salary, jobType };
    },
    "greenhouse.io": () => {
      // New Greenhouse layout uses .job__title h1, old uses .app-title
      const title = document.querySelector(".job__title h1")?.textContent?.trim()
        || document.querySelector(".app-title")?.textContent?.trim()
        || document.querySelector(".job-post-container h1")?.textContent?.trim() || "";

      const company = document.querySelector(".company-name")?.textContent?.trim()
        || document.querySelector('.job-post-container .logo img')?.alt?.replace(/\s*logo\s*/i, "")?.trim() || "";

      const jobDescription = document.querySelector(".job__description")?.innerText?.trim()
        || document.querySelector("#content .body")?.innerText?.trim()
        || document.querySelector("#content")?.innerText?.trim() || "";

      const location = document.querySelector(".job__location")?.textContent?.trim()
        || document.querySelector(".location")?.textContent?.trim() || "";

      return { title, company, jobDescription, location, salary: "", jobType: "" };
    },
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
    "glassdoor.com": () => {
      // Glassdoor redesigned — title is now h1 inside the job details header
      const header = document.querySelector('[data-test="job-details-header"]')
        || document.querySelector(".JobDetails_jobDetailsHeader__Hd9M3");

      const title = header?.querySelector("h1")?.textContent?.trim()
        || document.querySelector('[data-test="job-title"]')?.textContent?.trim()
        || document.querySelector("#jd-job-title")?.textContent?.trim() || "";

      // Company name is inside the employer profile heading
      const company = header?.querySelector('[class*="EmployerProfile_employerNameHeading"] h4')?.textContent?.trim()
        || header?.querySelector('[class*="EmployerProfile_employerInfo"] h4')?.textContent?.trim()
        || document.querySelector('[data-test="employer-name"]')?.textContent?.trim() || "";

      // JD is inside a blurred/expandable container
      const jobDescription = document.querySelector('[class*="JobDetails_jobDescription"] > div')?.innerText?.trim()
        || document.querySelector('[data-test="description"]')?.innerText?.trim() || "";

      const location = document.querySelector('[data-test="location"]')?.textContent?.trim()
        || document.querySelector('[data-test="job-location"]')?.textContent?.trim() || "";

      const salary = document.querySelector('[data-test="detailSalary"]')?.textContent?.trim() || "";

      return { title, company, jobDescription, location, salary, jobType: "" };
    },
    "myworkdayjobs.com": () => {
      // Try JSON-LD structured data first (available before JS renders)
      const jsonLd = (() => {
        try {
          const script = document.querySelector('script[type="application/ld+json"]');
          if (script) return JSON.parse(script.textContent);
        } catch {}
        return null;
      })();

      // DOM selectors scoped to job details section to avoid third-party injections
      const jobDetails = document.querySelector('[data-automation-id="jobDetails"]');
      const title = jobDetails?.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim()
        || document.querySelector('a[data-automation-id="jobTitle"]')?.textContent?.trim()
        || jsonLd?.title || "";

      const company = (() => {
        // Try JSON-LD hiringOrganization first
        if (jsonLd?.hiringOrganization?.name) return jsonLd.hiringOrganization.name;
        // Fall back to subdomain
        const sub = window.location.hostname.split(".")[0];
        return sub.charAt(0).toUpperCase() + sub.slice(1);
      })();

      const jobDescription = jobDetails?.querySelector('[data-automation-id="jobPostingDescription"]')?.innerText?.trim()
        || document.querySelector('[data-automation-id="richTextBody"]')?.innerText?.trim()
        || document.querySelector('[data-automation-id="jobPostingDescription"]')?.innerText?.trim()
        || jsonLd?.description || "";

      const location = document.querySelector('[data-automation-id="locations"] dd')?.textContent?.trim()
        || document.querySelector('[data-automation-id="jobPostingLocation"]')?.textContent?.trim()
        || document.querySelector('[data-automation-id="locations"]')?.textContent?.trim()
        || jsonLd?.jobLocation?.address?.addressLocality || "";

      const jobType = jsonLd?.employmentType || "";

      return { title, company, jobDescription, location, salary: "", jobType };
    },
  };
  const extractorRegistry = extractorConfig.buildExtractorRegistry(scrapers);

  /** Detect "I'm currently on a LinkedIn member profile page".
   *  LinkedIn profile URLs are linkedin.com/in/<vanity> (not /jobs/, /feed/, etc). */
  function isLinkedInProfilePage() {
    return window.location.hostname.includes("linkedin.com")
      && /^\/in\/[^\/?#]+/.test(window.location.pathname);
  }

  /** Scrape the displayed profile.
   *
   *  LinkedIn migrated profiles to a server-driven UI whose class names are
   *  obfuscated hashes ("_6bc9d9b3") that rotate frequently, so selector-based
   *  scraping rots fast. We instead match on the *text shape* of elements
   *  (which is stable) and fall back to the legacy selectors for older layouts.
   *
   *  Company precedence (most → least reliable for the *current* employer):
   *    1. Headline: "Role @ Company | …" / "Role at Company"  (user-authored)
   *    2. "Company · School" summary line under the headline
   *    3. First company logo in the Experience section (alt = "Company logo")
   *    4. Legacy top-card selectors
   */
  function scrapeLinkedInProfile() {
    const url = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "");
    let name = "", headline = "", company = "", role = "", location = "";

    try {
      const cleanTitle = (document.title || "")
        .replace(/\s*\|\s*LinkedIn.*$/i, "")
        .replace(/^\(\d+\)\s*/, "")
        .trim();

      // ---- name ---- (the page <h1>/<h2> first, else the document title) ----
      name = document.querySelector("main h1, main h2")?.textContent?.trim()
        || document.querySelector("h1")?.textContent?.trim()
        || cleanTitle;

      // Lines we never want to treat as headline/company/location.
      const isNoise = (t) =>
        !t || t.length < 4 || t.length > 320
        || /^·/.test(t)
        || /·\s*(1st|2nd|3rd)\b/i.test(t)
        || /\b(followers?|connections?|mutual connection)\b/i.test(t)
        || /^Contact info$/i.test(t);

      // Snapshot of the top ~60 paragraph-ish lines, in document order.
      const lines = Array.from(document.querySelectorAll("main p, section p"))
        .slice(0, 60)
        .map((p) => (p.textContent || "").replace(/\s+/g, " ").trim());

      // ---- headline ---- (first title-like line: has "@"/" at "/"|") ----
      for (const t of lines) {
        if (isNoise(t)) continue;
        if (/(@|\bat\b)/i.test(t) || t.includes("|")) { headline = t; break; }
      }
      if (!headline) {
        headline = document.querySelector(".text-body-medium.break-words")?.textContent?.trim()
          || document.querySelector("[data-generated-suggestion-target]")?.textContent?.trim()
          || "";
      }

      // ---- (1) parse company + role from the headline ----
      if (headline) {
        const seg = headline.split("|")[0].trim();
        const m = seg.match(/^(.*?)\s*(?:@|\bat\b)\s*(.+)$/i);
        if (m) { role = m[1].trim(); company = m[2].trim(); }
        else { role = seg; }
        // Strip a trailing ",City" / "· …" the headline sometimes appends.
        company = company.split(/[,|·]/)[0].trim();
      }

      // ---- (2) "Company · School" summary line ----
      if (!company) {
        for (const t of lines) {
          if (isNoise(t) || /\d/.test(t) || t.length > 120) continue;
          const parts = t.split("·").map((s) => s.trim()).filter(Boolean);
          if (parts.length >= 2 && parts.length <= 3) { company = parts[0]; break; }
        }
      }

      // ---- (3) first company logo alt in the Experience section ----
      if (!company) {
        const expHeading = Array.from(document.querySelectorAll("section h2, section h3"))
          .find((h) => /^experience$/i.test((h.textContent || "").trim()));
        const scope = expHeading?.closest("section") || document;
        const logo = scope.querySelector('img[alt$=" logo" i]');
        if (logo) company = (logo.getAttribute("alt") || "").replace(/\s+logo$/i, "").trim();
      }

      // ---- (4) legacy top-card selectors ----
      if (!company) {
        const expBtn = document.querySelector('[aria-label*="Current company" i]')
          || document.querySelector('button[data-field="experience_company_logo"]');
        const t = expBtn?.textContent?.trim();
        if (t) company = t.split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
      }

      if (!role && headline) {
        role = headline.split("|")[0].split(/\s*(?:@|\bat\b)\s*/i)[0].trim();
      }

      // ---- location ---- (labelled selector, else a place-shaped line) ----
      location = document.querySelector(".text-body-small.inline.t-black--light.break-words")?.textContent?.trim()
        || document.querySelector(".pv-text-details__left-panel .text-body-small")?.textContent?.trim()
        || "";
      if (!location) {
        for (const t of lines) {
          if (isNoise(t) || /[@|·]/.test(t) || /\d/.test(t) || t.length > 80) continue;
          if (/(United States|United Kingdom|India|Canada|Australia|Germany|France|Singapore|, [A-Z]{2}\b)/.test(t)) {
            location = t; break;
          }
        }
      }
    } catch (err) {
      // Never let a DOM change break the FAB — return whatever we have.
      console.warn("[HireTrail] LinkedIn scrape failed:", err);
    }

    // Guard against the page-title leaking a non-name when nothing parsed.
    company = (company || "").slice(0, 200);
    role = (role || "").slice(0, 120);
    return { name, headline, company, role, location, linkedinUrl: url };
  }

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
    for (const extractor of extractorRegistry) {
      if (host.includes(extractor.domain)) return extractor.scrape();
    }
    return { title: document.title, company: "", jobDescription: "", location: "", salary: "", jobType: "" };
  }

  function scrapeWithFallback() {
    return core.scrapeWithFallback(scrape, document, window.location);
  }

  // Auto-detect Apply button clicks
  function setupApplyDetection() {
    const host = window.location.hostname;
    const selectors = extractorRegistry.find((extractor) => host.includes(extractor.domain))?.applySelectors || [];
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
        const data = scrapeWithFallback();
        if (!core.isLikelyJobPage(
          data,
          window.location.hostname,
          window.location.pathname,
          document.body?.innerText?.slice(0, 3000) || "",
        )) return;
        if (lastTrackedUrl === data.url) return;

        // If the user previously clicked "Tailor" on this JD, there's already a Drafting
        // application linked to a TailorSession. Prompt them to come to HireTrail and pick
        // which resume they sent — DON'T silently create a duplicate "Applied" record.
        const draft = await chrome.runtime.sendMessage({ type: "FIND_DRAFT_FOR_URL", url: data.url });
        if (draft && draft.session && draft.session._id) {
          lastTrackedUrl = data.url; // suppress repeat fires on the same click stream
          showApplyDetectedBanner(draft.session._id, data.company || draft.session.company || "this application");
          return;
        }

        const result = await chrome.runtime.sendMessage({ type: "TRACK_JOB", data });
        if (result && result.success) {
          lastTrackedUrl = data.url;
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
    if (isFabInitialized) return;
    isFabInitialized = true;
    // Create floating action button
    const fab = document.createElement("div");
    fab.id = "hiretrail-fab";
    // Brand background = the same blue gradient used in /favicon.svg on the web app.
    // Status states (loading / success / error) override this via setFabVisual().
    // FAB tab — anchored to the right edge so the rounded-left / flat-right
    // shape reads as "pull this out from the side." Width 36px keeps the
    // touch target well above the 32px floor while leaving the H glyph
    // dominant (24px = 67% of the button). Shadow uses brand-tinted ambient
    // light + a subtle inner highlight so it lifts off any host page bg.
    fab.innerHTML = `
      <div style="
        position: fixed; right: 0; top: 10vh; z-index: 999999;
        width: 36px; height: 40px;
        border-radius: 10px;
        border-top-right-radius: 0; border-bottom-right-radius: 0;
        background: linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        box-shadow:
          0 6px 16px -2px rgba(30, 58, 138, 0.45),
          0 2px 4px -1px rgba(15, 23, 42, 0.20),
          inset 0 1px 0 rgba(255, 255, 255, 0.16),
          inset 0 0 0 1px rgba(255, 255, 255, 0.06);
        font-weight: 800; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transition: box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.2s ease, filter 0.2s ease, width 0.2s ease;
        touch-action: none;
      " id="hiretrail-btn" aria-label="HireTrail tracker" title="HireTrail">
        <span id="hiretrail-glyph" style="display:flex; align-items:center; justify-content:center; pointer-events:none;">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M10 8h3v6h6V8h3v16h-3v-7h-6v7h-3V8z" fill="#FFFFFF" />
          </svg>
        </span>
      </div>
    `;
    document.body.appendChild(fab);

    const btn = document.getElementById("hiretrail-btn");
    const glyph = document.getElementById("hiretrail-glyph");
    let dragState = {
      pointerId: null,
      dragging: false,
      moved: false,
      startY: 0,
      startTop: 0,
    };

    function setFabVisual(state) {
      if (!btn || !glyph) return;
      const setText = (t) => { glyph.textContent = t; };
      /** Restore the brand mark — same H glyph used in /favicon.svg on the web app. */
      const setBrandGlyph = () => {
        glyph.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M10 8h3v6h6V8h3v16h-3v-7h-6v7h-3V8z" fill="#FFFFFF" />
          </svg>
        `;
      };
      /** Brand gradient — matches the favicon's linearGradient stops. */
      const BRAND_GRADIENT = "linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)";

      if (state === "loading") {
        setText("…");
        btn.style.background = "#1f2937";
        btn.style.color = "#ffffff";
        return;
      }
      if (state === "success") {
        setText("\u2713");
        btn.style.background = "linear-gradient(135deg, #10b981 0%, #047857 100%)";
        btn.style.color = "#ffffff";
        return;
      }
      if (state === "duplicate") {
        setText("\u2713");
        btn.style.background = "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
        btn.style.color = "#ffffff";
        return;
      }
      if (state === "error") {
        setText("!");
        btn.style.background = "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)";
        btn.style.color = "#ffffff";
        return;
      }

      // idle \u2014 brand gradient + H mark, matching /favicon.svg on the web app.
      setBrandGlyph();
      btn.style.background = BRAND_GRADIENT;
      btn.style.color = "#ffffff";
    }

    function clampFabTop(topPx) {
      const margin = 8;
      const maxTop = Math.max(margin, window.innerHeight - btn.offsetHeight - margin);
      return Math.min(maxTop, Math.max(margin, topPx));
    }

    function applyFabTop(topPx) {
      btn.style.top = `${clampFabTop(topPx)}px`;
    }

    function persistFabTop(topPx) {
      const ratio = clampFabTop(topPx) / Math.max(window.innerHeight, 1);
      chrome.storage.local.set({ [FAB_TOP_RATIO_KEY]: ratio }).catch(() => {});
    }

    // Restore persisted vertical position for a consistent cross-site experience.
    chrome.storage.local.get([FAB_TOP_RATIO_KEY]).then((result) => {
      const ratio = typeof result[FAB_TOP_RATIO_KEY] === "number" ? result[FAB_TOP_RATIO_KEY] : 0.1;
      applyFabTop(window.innerHeight * ratio);
    }).catch(() => {
      applyFabTop(window.innerHeight * 0.1);
    });

    btn.addEventListener("pointerdown", (event) => {
      dragState.pointerId = event.pointerId;
      dragState.dragging = false;
      dragState.moved = false;
      dragState.startY = event.clientY;
      dragState.startTop = parseFloat(btn.style.top) || btn.getBoundingClientRect().top;
      btn.setPointerCapture(event.pointerId);
      btn.style.cursor = "grabbing";
      btn.style.transition = "box-shadow 0.1s ease, background 0.2s ease";
    });

    btn.addEventListener("pointermove", (event) => {
      if (dragState.pointerId !== event.pointerId) return;
      const deltaY = event.clientY - dragState.startY;
      if (!dragState.dragging && Math.abs(deltaY) > 4) {
        dragState.dragging = true;
        dragState.moved = true;
      }
      if (!dragState.dragging) return;
      event.preventDefault();
      applyFabTop(dragState.startTop + deltaY);
    });

    function finishDrag(event) {
      if (dragState.pointerId !== event.pointerId) return;
      if (dragState.dragging) {
        const currentTop = parseFloat(btn.style.top) || btn.getBoundingClientRect().top;
        persistFabTop(currentTop);
      }
      dragState.pointerId = null;
      dragState.dragging = false;
      btn.style.cursor = "pointer";
      btn.style.transition = "box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease";
      setTimeout(() => {
        dragState.moved = false;
      }, 120);
    }

    btn.addEventListener("pointerup", finishDrag);
    btn.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", () => {
      const currentTop = parseFloat(btn.style.top) || btn.getBoundingClientRect().top;
      applyFabTop(currentTop);
    });

    // Hover: peek out from the edge by ~4px (the tab feels "grabbed"),
    // intensify the brand-tinted ambient shadow, and a small brightness lift.
    // Keeps the surface readable on dark host pages without flashing white.
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateX(-3px)";
      btn.style.boxShadow = [
        "0 10px 24px -2px rgba(30, 58, 138, 0.55)",
        "0 3px 6px -1px rgba(15, 23, 42, 0.25)",
        "inset 0 1px 0 rgba(255, 255, 255, 0.22)",
        "inset 0 0 0 1px rgba(255, 255, 255, 0.10)",
      ].join(", ");
      btn.style.filter = "brightness(1.08)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateX(0)";
      btn.style.boxShadow = [
        "0 6px 16px -2px rgba(30, 58, 138, 0.45)",
        "0 2px 4px -1px rgba(15, 23, 42, 0.20)",
        "inset 0 1px 0 rgba(255, 255, 255, 0.16)",
        "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
      ].join(", ");
      btn.style.filter = "none";
    });

    /** Run a "Track" — same as the legacy single-click behavior. */
    async function performTrack() {
      const data = scrapeWithFallback();
      if (!core.isLikelyJobPage(
        data,
        window.location.hostname,
        window.location.pathname,
        document.body?.innerText?.slice(0, 3000) || "",
      )) {
        showStatus("This page does not look like a job posting yet", "warning");
        return;
      }
      // Opt-in: copy the JD to the clipboard as part of tracking. Done before
      // the network call so the write still rides the click's user-gesture.
      let jdCopied = false;
      if (clipboardPrefs.copyOnTrack && data.jobDescription) {
        jdCopied = await copyTextToClipboard(buildClipboardText(data, clipboardPrefs.format));
      }
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "none";
      setFabVisual("loading");
      try {
        const result = await chrome.runtime.sendMessage({ type: "TRACK_JOB", data });
        if (result && result.success) {
          lastTrackedUrl = data.url;
          showStatus(jdCopied ? "Tracked · JD copied" : "Tracked!", "success");
          setFabVisual("success");
        } else if (result && result.duplicate) {
          showStatus("Already tracked!", "warning");
          setFabVisual("duplicate");
        } else {
          showStatus(result?.error || "Failed", "error");
          setFabVisual("error");
        }
      } catch {
        showStatus("Refresh page & try again", "error");
        setFabVisual("error");
      } finally {
        setTimeout(() => {
          setFabVisual("idle");
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
        }, 2000);
      }
    }

    /** Copy the scraped JD to the clipboard, independent of tracking. Always
     *  available in the FAB popover regardless of the auto-copy-on-track pref. */
    async function performCopyJd() {
      const data = scrapeWithFallback();
      const jd = (data.jobDescription || "").trim();
      if (jd.length < 30) {
        showStatus("Couldn't find a job description on this page", "warning");
        return;
      }
      const ok = await copyTextToClipboard(buildClipboardText(data, clipboardPrefs.format));
      if (ok) {
        showStatus("JD copied to clipboard", "success");
        setFabVisual("success");
      } else {
        showStatus("Couldn't copy — try again", "error");
        setFabVisual("error");
      }
      setTimeout(() => setFabVisual("idle"), 1600);
    }

    /** Save the current LinkedIn profile as a HireTrail contact. */
    async function performTrackContact() {
      if (!isLinkedInProfilePage()) {
        showStatus("Open a LinkedIn profile to save a contact", "warning");
        return;
      }
      const data = scrapeLinkedInProfile();
      if (!data.name) {
        showStatus("Couldn't read the profile name yet — wait for the page to finish loading", "warning");
        return;
      }
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "none";
      setFabVisual("loading");
      try {
        const result = await chrome.runtime.sendMessage({ type: "TRACK_CONTACT", data });
        if (result && result.success) {
          showStatus(`Saved ${data.name} to contacts`, "success");
          setFabVisual("success");
        } else {
          showStatus(result?.error || "Failed to save contact", "error");
          setFabVisual("error");
        }
      } catch {
        showStatus("Refresh page & try again", "error");
        setFabVisual("error");
      } finally {
        setTimeout(() => {
          setFabVisual("idle");
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
        }, 2000);
      }
    }

    /** Run a "Tailor" — POSTs /tailor/init server-side, opens HireTrail Tailor in new tab. */
    async function performTailor() {
      const data = scrapeWithFallback();
      if (!data.jobDescription || data.jobDescription.length < 50) {
        showStatus("Couldn't scrape a job description from this page", "warning");
        return;
      }
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "none";
      setFabVisual("loading");
      try {
        const result = await chrome.runtime.sendMessage({ type: "TAILOR_INIT", data });
        if (result && result.success) {
          showStatus("Tailor session started — opening HireTrail…", "success");
          setFabVisual("success");
        } else {
          showStatus(result?.error || "Failed to start tailor", "error");
          setFabVisual("error");
        }
      } catch {
        showStatus("Refresh page & try again", "error");
        setFabVisual("error");
      } finally {
        setTimeout(() => {
          setFabVisual("idle");
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
        }, 2000);
      }
    }

    btn.addEventListener("click", async () => {
      if (dragState.moved || dragState.dragging) return;
      // If a popover is already open, treat this click as "close it".
      if (document.getElementById("hiretrail-popover")) {
        closeHireTrailPopover();
        return;
      }
      try {
        const authRes = await chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
        if (!authRes || !authRes.authenticated) {
          showStatus("Log in via extension popup first", "error");
          return;
        }
        // Pull the freshest clipboard prefs before opening the menu so a just-
        // changed Settings toggle takes effect without a page reload. This await
        // is on the open path, not the copy path, so it can't drop the gesture
        // for the subsequent Track/Copy click.
        try {
          const prefsRes = await chrome.runtime.sendMessage({ type: "REFRESH_PREFS" });
          if (prefsRes && prefsRes.ok) applyClipboardPrefs(prefsRes);
        } catch { /* keep cached prefs */ }
        openHireTrailPopover(btn, {
          onTrack: performTrack,
          onTailor: performTailor,
          onCopyJd: performCopyJd,
          onTrackContact: performTrackContact,
          isLinkedInProfile: isLinkedInProfilePage(),
        });
      } catch {
        showStatus("Refresh page & try again", "error");
        setFabVisual("error");
      }
    });

    setFabVisual("idle");

    // The "Tailor" action now lives in the FAB popover (see openHireTrailPopover above),
    // not as a separate secondary button.

    // Setup auto-detect after FAB
    setupApplyDetection();
  }

  function initTailorButton() {
    if (document.getElementById("hiretrail-tailor-btn")) return;
    const fabEl = document.getElementById("hiretrail-btn");
    if (!fabEl) return;

    const tailorBtn = document.createElement("div");
    tailorBtn.id = "hiretrail-tailor-btn";
    tailorBtn.title = "Tailor with AI";
    tailorBtn.setAttribute("aria-label", "Tailor with AI");
    tailorBtn.style.cssText = `
      position: fixed; right: 0; z-index: 999999;
      width: 36px; height: 36px;
      border-radius: 10px;
      border-top-right-radius: 0; border-bottom-right-radius: 0;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(99,102,241,0.35);
      transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    tailorBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2l1.6 4.2L18 8l-4.4 1.8L12 14l-1.6-4.2L6 8l4.4-1.8L12 2z"/>
        <path d="M18 13l1 2.5L21.5 16 19 17l-1 2.5L17 17l-2.5-1L17 15l1-2z"/>
      </svg>
    `;
    document.body.appendChild(tailorBtn);

    function positionTailorBelowFab() {
      const rect = fabEl.getBoundingClientRect();
      tailorBtn.style.top = `${rect.bottom + 8}px`;
    }
    positionTailorBelowFab();
    new ResizeObserver(positionTailorBelowFab).observe(fabEl);
    window.addEventListener("resize", positionTailorBelowFab);
    // FAB has dragstate; reposition on every pointer move.
    document.addEventListener("pointermove", positionTailorBelowFab);

    tailorBtn.addEventListener("mouseenter", () => {
      tailorBtn.style.transform = "translateX(-2px) scale(1.08)";
      tailorBtn.style.filter = "brightness(1.1)";
    });
    tailorBtn.addEventListener("mouseleave", () => {
      tailorBtn.style.transform = "translateX(0) scale(1)";
      tailorBtn.style.filter = "none";
    });

    tailorBtn.addEventListener("click", async () => {
      try {
        const authRes = await chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
        if (!authRes || !authRes.authenticated) {
          showStatus("Sign in via the extension popup first", "error");
          return;
        }
        const data = scrapeWithFallback();
        if (!data.jobDescription || data.jobDescription.length < 80) {
          showStatus("Couldn't find a job description on this page", "warning");
          return;
        }

        openSidebar({ state: "loading", title: data.title, company: data.company });
        const result = await chrome.runtime.sendMessage({ type: "ANALYZE_JD", data });
        if (result && result.success) {
          openSidebar({ state: "result", session: result.session });
        } else {
          openSidebar({ state: "error", error: result?.error || "Analysis failed" });
        }
      } catch (err) {
        openSidebar({ state: "error", error: "Could not reach extension. Refresh the page." });
      }
    });
  }

  /* ---------- Sidebar UI ---------- */

  function openSidebar(payload) {
    let panel = document.getElementById("hiretrail-tailor-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "hiretrail-tailor-panel";
      panel.style.cssText = `
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 999999;
        width: 380px; max-width: 100vw;
        background: #ffffff; color: #111;
        box-shadow: -16px 0 36px rgba(0,0,0,0.18);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex; flex-direction: column;
        animation: hiretrail-slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      `;
      panel.innerHTML = `
        <div id="hiretrail-tailor-head" style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #e5e7eb; background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); color:#fff;">
          <div style="display:flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.6 4.2L18 8l-4.4 1.8L12 14l-1.6-4.2L6 8l4.4-1.8L12 2z"/></svg>
            <span style="font-weight:700; font-size:14px;">HireTrail · AI Tailor</span>
          </div>
          <button id="hiretrail-tailor-close" aria-label="Close" style="background:none; border:none; color:#fff; cursor:pointer; padding:4px; line-height:0; border-radius:6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>
        <div id="hiretrail-tailor-body" style="flex:1; overflow-y:auto; padding:16px;"></div>
      `;
      document.body.appendChild(panel);
      panel.querySelector("#hiretrail-tailor-close").addEventListener("click", () => panel.remove());
    }

    const body = panel.querySelector("#hiretrail-tailor-body");
    if (payload.state === "loading") {
      body.innerHTML = `
        <div style="padding:24px 8px; text-align:center;">
          <div style="font-size:13px; color:#6b7280; margin-bottom:8px;">Analyzing this JD against your master profile…</div>
          <div style="font-size:12px; color:#9ca3af;">${escapeHtml((payload.title || "") + (payload.company ? " · " + payload.company : ""))}</div>
        </div>
      `;
      return;
    }
    if (payload.state === "error") {
      body.innerHTML = `
        <div style="padding:16px; border:1px solid #fecaca; background:#fef2f2; border-radius:10px; font-size:13px; color:#991b1b;">
          ${escapeHtml(payload.error || "Unknown error")}
        </div>
      `;
      return;
    }
    if (payload.state !== "result" || !payload.session) return;
    body.innerHTML = renderResult(payload.session);
    const openBtn = body.querySelector("#hiretrail-open-tailor");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "OPEN_TAILOR", sessionId: payload.session._id });
        const url = `https://hiretrail.manavkaneria.me/applications?tailorSession=${encodeURIComponent(payload.session._id)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      });
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderResult(s) {
    const gradeTone = { A: "#059669", B: "#0284c7", C: "#d97706", D: "#ea580c", F: "#dc2626" }[s.fitGrade] || "#6b7280";
    const matchedChips = (s.matchedSkills || []).slice(0, 12).map((k) =>
      `<span style="display:inline-block; font-size:11px; padding:2px 8px; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; border-radius:999px; margin:2px;">${escapeHtml(k)}</span>`
    ).join("");
    const missingChips = (s.missingSkills || []).slice(0, 12).map((k) =>
      `<span style="display:inline-block; font-size:11px; padding:2px 8px; background:#fffbeb; color:#92400e; border:1px solid #fde68a; border-radius:999px; margin:2px;">${escapeHtml(k)}</span>`
    ).join("");
    const topSuggestions = (s.suggestions || []).slice(0, 4).map((sg) => `
      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; margin-bottom:8px; background:#fafafa;">
        <div style="display:flex; gap:6px; margin-bottom:6px;">
          <span style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:2px 6px; background:#e0e7ff; color:#3730a3; border-radius:4px;">${escapeHtml(sg.section)}</span>
          <span style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:2px 6px; background:#f3f4f6; color:#374151; border-radius:4px;">${escapeHtml(sg.kind)}</span>
        </div>
        <div style="font-size:12.5px; color:#111; line-height:1.45;">${escapeHtml(sg.suggested)}</div>
        ${sg.rationale ? `<div style="font-size:11px; color:#6b7280; margin-top:4px; font-style:italic;">${escapeHtml(sg.rationale)}</div>` : ""}
      </div>
    `).join("");

    return `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
        <div style="width:54px; height:54px; border-radius:12px; background:${gradeTone}1A; border:1px solid ${gradeTone}; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; color:${gradeTone};">${escapeHtml(s.fitGrade)}</div>
        <div>
          <div style="font-size:18px; font-weight:700; color:#111;">${s.fitScore} / 5</div>
          <div style="font-size:11px; color:#6b7280;">${escapeHtml(s.fitGrade)}-grade fit</div>
        </div>
      </div>
      <p style="font-size:12.5px; color:#111; line-height:1.5; margin:0 0 14px;">${escapeHtml(s.summary || "")}</p>

      ${matchedChips ? `<div style="margin-bottom:10px;"><div style="font-size:10px; font-weight:700; color:#065f46; text-transform:uppercase; letter-spacing:.6px; margin-bottom:4px;">Matched</div>${matchedChips}</div>` : ""}
      ${missingChips ? `<div style="margin-bottom:14px;"><div style="font-size:10px; font-weight:700; color:#92400e; text-transform:uppercase; letter-spacing:.6px; margin-bottom:4px;">Missing</div>${missingChips}</div>` : ""}

      ${topSuggestions ? `<div style="font-size:10px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:.6px; margin-bottom:8px;">Top suggestions</div>${topSuggestions}` : ""}

      <button id="hiretrail-open-tailor" style="width:100%; margin-top:8px; padding:10px 12px; font-size:13px; font-weight:600; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
        Open in HireTrail to accept / generate PDF
      </button>
      <p style="font-size:11px; color:#6b7280; text-align:center; margin:10px 0 0;">Provider: ${escapeHtml(s.provider || "")}:${escapeHtml(s.modelId || "")}</p>
    `;
  }

  /** Show a small popover next to the FAB with contextual actions.
   *  Closes on outside click, Escape, or after any action runs. */
  function openHireTrailPopover(anchorEl, { onTrack, onTailor, onCopyJd, onTrackContact, isLinkedInProfile }) {
    if (document.getElementById("hiretrail-popover")) return;
    const rect = anchorEl.getBoundingClientRect();

    // Context label shown in the header so the user knows what page we think they're on.
    const contextLabel = isLinkedInProfile
      ? "LinkedIn profile"
      : (() => {
          const host = window.location.hostname.replace(/^www\./, "");
          return host || "This page";
        })();

    // Live preview of what HireTrail will track. Runs the same scraper Track
    // would run so the user sees the exact role + company that's about to
    // get saved — and can bail if the detection is wrong. Suppressed for
    // LinkedIn-profile context (no JD to detect) and when the scraper
    // didn't find anything substantive.
    const detected = !isLinkedInProfile ? scrapeWithFallback() : null;
    const detectedRole = detected?.role?.trim();
    const detectedCompany = detected?.company?.trim();
    const hasDetection = !!(detectedRole || detectedCompany);

    const popover = document.createElement("div");
    popover.id = "hiretrail-popover";
    // Hugs content width (max 312px) — no dead right-hand space. Anchors to
    // the FAB's left edge, clamps to viewport so it never spills off-screen.
    popover.style.cssText = `
      position: fixed;
      right: ${Math.max(8, window.innerWidth - rect.left + 8)}px;
      top: ${Math.min(rect.top, window.innerHeight - 280)}px;
      z-index: 1000000;
      width: 248px;
      max-width: calc(100vw - 16px);
      padding: 0;
      animation: ht-pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
    `;
    // Save-as-contact only renders on LinkedIn profile pages. Each action is
    // a self-contained section, separated by an explicit divider — no naked
    // hover row, every row reads as its own "card."
    const trackContactRow = isLinkedInProfile ? `
      <button id="ht-pop-contact" type="button" class="ht-action">
        <span class="ht-glyph" style="background: linear-gradient(135deg, #0a66c2, #004182);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.11 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.55h4.56V23H.22zM8 8.55h4.37v1.98h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.48 3.04 5.48 7v7.83h-4.56v-6.94c0-1.65-.03-3.77-2.3-3.77-2.3 0-2.65 1.79-2.65 3.65V23H8z"/>
          </svg>
        </span>
        <span class="ht-text">
          <span class="ht-label">Save as contact</span>
        </span>
        <svg class="ht-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      <div class="ht-divider"></div>
    ` : "";

    popover.innerHTML = `
      <style>
        @keyframes ht-pop-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* Card appearance lives here (not inline) so the dark-mode media query
         * below can flip the whole surface — background AND text — together.
         * Previously the white bg was set inline and won over the media query,
         * leaving light text on a white card (invisible header) in OS dark mode. */
        #hiretrail-popover {
          box-sizing: border-box;
          background: #ffffff;
          color: #0f172a;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 14px;
          box-shadow: 0 24px 56px -12px rgba(15, 23, 42, 0.24), 0 6px 16px -4px rgba(15, 23, 42, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          overflow: hidden;
        }
        #hiretrail-popover .ht-header {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 12px 14px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(139, 92, 246, 0.04));
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        #hiretrail-popover .ht-brand {
          display: inline-flex; align-items: center; gap: 8px;
          font-weight: 700; font-size: 13px; letter-spacing: -0.01em;
          color: #0f172a;
        }
        #hiretrail-popover .ht-brand-dot {
          width: 22px; height: 22px; border-radius: 6px;
          background: linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%);
          display: inline-flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 800; font-size: 13px; line-height: 1;
          box-shadow:
            0 2px 4px -1px rgba(30, 58, 138, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }
        #hiretrail-popover .ht-context {
          font-size: 10.5px; font-weight: 600; letter-spacing: 0.02em;
          color: #1e3a8a;
          background: rgba(59, 130, 246, 0.08);
          padding: 3px 8px; border-radius: 999px;
          max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          text-transform: uppercase;
        }
        #hiretrail-popover .ht-body { padding: 4px; }
        #hiretrail-popover .ht-action {
          width: 100%; min-width: 0;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          border: none; background: transparent; color: inherit;
          font: inherit; text-align: left; cursor: pointer;
          border-radius: 10px;
          position: relative;
          transition: background 140ms ease, transform 140ms ease;
        }
        #hiretrail-popover .ht-action:hover {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(139, 92, 246, 0.05));
        }
        #hiretrail-popover .ht-action:hover .ht-chev { transform: translateX(2px); color: rgba(15, 23, 42, 0.7); }
        #hiretrail-popover .ht-action:active { transform: scale(0.99); }
        #hiretrail-popover .ht-action:focus-visible {
          outline: 2px solid #3B82F6; outline-offset: -2px;
        }
        #hiretrail-popover .ht-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        #hiretrail-popover .ht-label {
          font-weight: 600; line-height: 1.2; font-size: 13.5px;
          letter-spacing: -0.005em;
        }
        #hiretrail-popover .ht-sub {
          font-size: 11.5px; color: rgba(15, 23, 42, 0.55);
          margin-top: 3px; line-height: 1.35;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 220px;
        }
        #hiretrail-popover .ht-glyph {
          width: 32px; height: 32px; border-radius: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: #ffffff;
          box-shadow:
            0 4px 8px -2px rgba(15, 23, 42, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }
        #hiretrail-popover .ht-chev {
          color: rgba(15, 23, 42, 0.32);
          flex-shrink: 0;
          transition: transform 140ms ease, color 140ms ease;
        }
        /* Full-width divider so each action reads as its own row. */
        #hiretrail-popover .ht-divider {
          height: 1px; margin: 0;
          background: rgba(15, 23, 42, 0.06);
        }
        /* "Detected" preview strip — sits between header and actions when the
         *  scraper found a real role/company on the page. Reads as a quiet
         *  confirmation so the user sees what's about to be saved before
         *  hitting Track. */
        #hiretrail-popover .ht-detected {
          padding: 10px 14px 12px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          background: rgba(15, 23, 42, 0.015);
        }
        #hiretrail-popover .ht-detected-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(15, 23, 42, 0.5);
          margin-bottom: 5px;
        }
        #hiretrail-popover .ht-detected-label svg { color: #10b981; }
        #hiretrail-popover .ht-detected-role {
          font-size: 13px; font-weight: 600;
          color: #0f172a;
          line-height: 1.25;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        #hiretrail-popover .ht-detected-co {
          font-size: 11.5px; color: rgba(15, 23, 42, 0.6);
          margin-top: 2px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        @media (prefers-color-scheme: dark) {
          #hiretrail-popover .ht-detected {
            background: rgba(248, 250, 252, 0.025);
            border-bottom-color: rgba(248, 250, 252, 0.06);
          }
          #hiretrail-popover .ht-detected-label { color: rgba(248, 250, 252, 0.5); }
          #hiretrail-popover .ht-detected-role { color: #f8fafc; }
          #hiretrail-popover .ht-detected-co { color: rgba(248, 250, 252, 0.6); }
        }
        #hiretrail-popover .ht-footer {
          padding: 9px 14px;
          border-top: 1px solid rgba(15, 23, 42, 0.06);
          background: rgba(15, 23, 42, 0.02);
          font-size: 10.5px; color: rgba(15, 23, 42, 0.55);
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        #hiretrail-popover .ht-footer a {
          color: #2563eb; text-decoration: none; font-weight: 600;
          display: inline-flex; align-items: center; gap: 4px;
        }
        #hiretrail-popover .ht-footer a:hover { text-decoration: underline; }
        @media (prefers-color-scheme: dark) {
          #hiretrail-popover {
            background: #0f172a; color: #f8fafc;
            border-color: rgba(248, 250, 252, 0.1);
            box-shadow: 0 24px 56px -12px rgba(0, 0, 0, 0.55), 0 6px 16px -4px rgba(0, 0, 0, 0.32);
          }
          #hiretrail-popover .ht-header {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.08));
            border-bottom-color: rgba(248, 250, 252, 0.06);
          }
          #hiretrail-popover .ht-brand { color: #f8fafc; }
          #hiretrail-popover .ht-context {
            color: #93c5fd;
            background: rgba(59, 130, 246, 0.14);
          }
          #hiretrail-popover .ht-action:hover {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.10), rgba(139, 92, 246, 0.08));
          }
          #hiretrail-popover .ht-action:hover .ht-chev { color: rgba(248, 250, 252, 0.8); }
          #hiretrail-popover .ht-sub { color: rgba(248, 250, 252, 0.55); }
          #hiretrail-popover .ht-chev { color: rgba(248, 250, 252, 0.35); }
          #hiretrail-popover .ht-divider { background: rgba(248, 250, 252, 0.06); }
          #hiretrail-popover .ht-footer {
            background: rgba(248, 250, 252, 0.03);
            border-top-color: rgba(248, 250, 252, 0.06);
            color: rgba(248, 250, 252, 0.55);
          }
        }
      </style>
      <div class="ht-header">
        <span class="ht-brand">
          <span class="ht-brand-dot">H</span>
          HireTrail
        </span>
        <span class="ht-context" title="${escapeHtml(contextLabel)}">${escapeHtml(contextLabel)}</span>
      </div>
      ${hasDetection ? `
        <div class="ht-detected">
          <div class="ht-detected-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Detected on this page
          </div>
          ${detectedRole ? `<p class="ht-detected-role">${escapeHtml(detectedRole)}</p>` : ""}
          ${detectedCompany ? `<p class="ht-detected-co">${escapeHtml(detectedCompany)}</p>` : ""}
        </div>
      ` : ""}
      <div class="ht-body">
        ${trackContactRow}
        <button id="ht-pop-track" type="button" class="ht-action">
          <span class="ht-glyph" style="background: linear-gradient(135deg, #3B82F6, #1E3A8A);">
            <!-- Crisper Track icon: filled bookmark/save mark, single closed
                 path at 18px so it reads at retina + non-retina. The previous
                 "paper plane" used two stroked paths that aliased. -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v17a1 1 0 0 0 1.55.83L12 18.2l5.45 3.63A1 1 0 0 0 19 21V4Z"/>
            </svg>
          </span>
          <span class="ht-text">
            <span class="ht-label">Track this job</span>
          </span>
          <svg class="ht-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
        <div class="ht-divider"></div>
        <button id="ht-pop-tailor" type="button" class="ht-action">
          <span class="ht-glyph" style="background: linear-gradient(135deg, #8b5cf6, #6366f1);">
            <!-- Crisp four-point sparkle, single closed path. The old SVG had
                 a broken second-path tail that caused the blurry look on
                 high-DPI screens. -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.05 3.4a1 1 0 0 1 1.9 0l1.39 4.16a3 3 0 0 0 1.9 1.9l4.16 1.39a1 1 0 0 1 0 1.9l-4.16 1.39a3 3 0 0 0-1.9 1.9l-1.39 4.16a1 1 0 0 1-1.9 0l-1.39-4.16a3 3 0 0 0-1.9-1.9l-4.16-1.39a1 1 0 0 1 0-1.9l4.16-1.39a3 3 0 0 0 1.9-1.9l1.39-4.16Z"/>
            </svg>
          </span>
          <span class="ht-text">
            <span class="ht-label">Tailor with AI</span>
          </span>
          <svg class="ht-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
        <div class="ht-divider"></div>
        <button id="ht-pop-copyjd" type="button" class="ht-action">
          <span class="ht-glyph" style="background: linear-gradient(135deg, #0ea5e9, #0369a1);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </span>
          <span class="ht-text">
            <span class="ht-label">Copy JD</span>
            <span class="ht-sub">Copy the job description to your clipboard</span>
          </span>
          <svg class="ht-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </div>
      <div class="ht-footer">
        <a href="https://hiretrail.manavkaneria.me" target="_blank" rel="noopener noreferrer">
          Open app
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
      </div>
    `;
    document.body.appendChild(popover);

    const handleTrack = () => { closeHireTrailPopover(); void onTrack(); };
    const handleTailor = () => { closeHireTrailPopover(); void onTailor(); };
    const handleCopyJd = () => { closeHireTrailPopover(); void onCopyJd(); };
    const handleTrackContact = () => { closeHireTrailPopover(); void onTrackContact(); };
    popover.querySelector("#ht-pop-track").addEventListener("click", handleTrack);
    popover.querySelector("#ht-pop-tailor").addEventListener("click", handleTailor);
    const copyJdBtn = popover.querySelector("#ht-pop-copyjd");
    if (copyJdBtn && typeof onCopyJd === "function") copyJdBtn.addEventListener("click", handleCopyJd);
    const contactBtn = popover.querySelector("#ht-pop-contact");
    if (contactBtn) contactBtn.addEventListener("click", handleTrackContact);

    const onDocClick = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorEl) closeHireTrailPopover();
    };
    const onKey = (e) => { if (e.key === "Escape") closeHireTrailPopover(); };
    // Defer so the click that opened the popover doesn't immediately close it.
    setTimeout(() => {
      document.addEventListener("mousedown", onDocClick, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);

    popover._cleanup = () => {
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }

  function closeHireTrailPopover() {
    const popover = document.getElementById("hiretrail-popover");
    if (!popover) return;
    if (typeof popover._cleanup === "function") popover._cleanup();
    popover.remove();
  }

  /** Shown when the user clicks Apply on a JD they previously started tailoring.
   *  We don't auto-flip the stage to Applied — Option 2 is "ask which resume they sent",
   *  which only makes sense in the HireTrail web app where the picker lives. */
  function showApplyDetectedBanner(sessionId, companyLabel) {
    const existing = document.getElementById("hiretrail-apply-banner");
    if (existing) existing.remove();
    const url = `https://hiretrail.manavkaneria.me/applications?tailorSession=${sessionId}`;
    const banner = document.createElement("div");
    banner.id = "hiretrail-apply-banner";
    banner.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 1000001;
      max-width: 320px; padding: 12px 14px;
      background: #ffffff; color: #0f172a;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-left: 4px solid #2563eb;
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      animation: ht-banner-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
    `;
    banner.innerHTML = `
      <style>
        @keyframes ht-banner-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        #hiretrail-apply-banner .ht-banner-title { font-weight: 600; margin-bottom: 4px; }
        #hiretrail-apply-banner .ht-banner-body { font-size: 12px; color: rgba(15, 23, 42, 0.65); line-height: 1.4; }
        #hiretrail-apply-banner .ht-banner-actions { display: flex; gap: 6px; margin-top: 10px; }
        #hiretrail-apply-banner .ht-btn-primary {
          flex: 1; padding: 6px 10px; background: #2563eb; color: #fff;
          border: none; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;
          text-decoration: none; text-align: center;
        }
        #hiretrail-apply-banner .ht-btn-primary:hover { background: #1d4ed8; }
        #hiretrail-apply-banner .ht-btn-secondary {
          padding: 6px 10px; background: transparent; color: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(15, 23, 42, 0.15); border-radius: 6px; font-size: 12px; cursor: pointer;
        }
        #hiretrail-apply-banner .ht-btn-secondary:hover { background: rgba(15, 23, 42, 0.04); }
        @media (prefers-color-scheme: dark) {
          #hiretrail-apply-banner { background: #0f172a; color: #f8fafc; border-color: rgba(248, 250, 252, 0.1); }
          #hiretrail-apply-banner .ht-banner-body { color: rgba(248, 250, 252, 0.65); }
          #hiretrail-apply-banner .ht-btn-secondary { color: rgba(248, 250, 252, 0.6); border-color: rgba(248, 250, 252, 0.15); }
          #hiretrail-apply-banner .ht-btn-secondary:hover { background: rgba(248, 250, 252, 0.06); }
        }
      </style>
      <div class="ht-banner-title">Applied to ${escapeHtml(companyLabel)}?</div>
      <div class="ht-banner-body">You started a tailor session for this role. Confirm in HireTrail which resume you sent.</div>
      <div class="ht-banner-actions">
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="ht-btn-primary" id="ht-banner-open">Open HireTrail</a>
        <button class="ht-btn-secondary" id="ht-banner-dismiss" type="button">Later</button>
      </div>
    `;
    document.body.appendChild(banner);
    banner.querySelector("#ht-banner-dismiss").addEventListener("click", () => banner.remove());
    banner.querySelector("#ht-banner-open").addEventListener("click", () => banner.remove());
    // Auto-dismiss after 30s so we don't clutter the page.
    setTimeout(() => { if (banner.isConnected) banner.remove(); }, 30000);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function showStatus(text, type) {
    const existing = document.getElementById("hiretrail-status");
    if (existing) existing.remove();

    const colors = {
      success: "#1e3a8a",
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

  // Inject animation keyframes
  const style = document.createElement("style");
  style.textContent = `
    @keyframes hiretrail-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes hiretrail-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  `;
  document.head.appendChild(style);

  // SPA-safe route observer: reset auto-track guard whenever URL changes.
  let observedUrl = window.location.href;
  const routeObserver = new MutationObserver(() => {
    if (window.location.href !== observedUrl) {
      observedUrl = window.location.href;
      lastTrackedUrl = "";
    }
  });
  routeObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
