(function (globalScope) {
  function canonicalizeUrl(rawUrl, baseUrl) {
    try {
      const url = new URL(rawUrl, baseUrl || "https://example.com");
      const blockedParams = [
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "trk", "trkInfo", "ref", "refId", "gh_jid", "gh_src", "source", "src",
      ];
      blockedParams.forEach((key) => url.searchParams.delete(key));
      url.hash = "";
      return url.toString();
    } catch {
      return rawUrl;
    }
  }

  function computeConfidence(data) {
    let score = 0;
    if (data.title && data.title.length >= 3) score += 35;
    if (data.company && data.company.length >= 2) score += 30;
    if (data.jobDescription && data.jobDescription.length >= 120) score += 25;
    if (data.location) score += 10;
    return score;
  }

  function isLikelyJobPage(data, hostname, pathname, previewText) {
    const hostHints = /(jobs?|careers?|greenhouse|lever|workday|indeed|linkedin|glassdoor)/i.test(hostname || "");
    const pathHints = /(jobs?|careers?|positions?|vacanc(y|ies)|opening|apply)/i.test(pathname || "");
    const textHints = /(job description|responsibilities|qualifications|apply|position summary)/i.test(previewText || "");
    return computeConfidence(data) >= 45 || hostHints || (pathHints && textHints);
  }

  function scrapeWithFallback(scrapeFn, documentRef, locationRef) {
    const data = scrapeFn();
    if (!data.title || data.title.length < 3) {
      data.title = documentRef.querySelector("h1")?.textContent?.trim() || documentRef.title || "";
    }
    if (!data.jobDescription || data.jobDescription.length < 50) {
      const articleLike = documentRef.querySelector("main, article, [role='main']");
      data.jobDescription = (
        articleLike?.innerText?.trim()
        || articleLike?.textContent?.trim()
        || ""
      ).slice(0, 12000) || data.jobDescription || "";
    }
    data.url = canonicalizeUrl(locationRef.href, locationRef.origin);
    data.confidence = computeConfidence(data);
    return data;
  }

  const api = {
    canonicalizeUrl,
    computeConfidence,
    isLikelyJobPage,
    scrapeWithFallback,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.HireTrailExtractionCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
