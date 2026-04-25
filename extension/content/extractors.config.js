(function (globalScope) {
  function buildExtractorRegistry(scrapers) {
    return [
      { domain: "linkedin.com", scrape: scrapers["linkedin.com"], applySelectors: ['button[aria-label*="Apply"]', ".jobs-apply-button"] },
      { domain: "indeed.com", scrape: scrapers["indeed.com"], applySelectors: [".indeed-apply-button"] },
      { domain: "greenhouse.io", scrape: scrapers["greenhouse.io"], applySelectors: [".apply-button", "#apply_button"] },
      { domain: "lever.co", scrape: scrapers["lever.co"], applySelectors: [".postings-btn-submit"] },
      { domain: "glassdoor.com", scrape: scrapers["glassdoor.com"], applySelectors: ['button[data-test="apply-button"]'] },
      { domain: "myworkdayjobs.com", scrape: scrapers["myworkdayjobs.com"], applySelectors: ['button[data-automation-id="applyButton"]'] },
    ];
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { buildExtractorRegistry };
  } else {
    globalScope.HireTrailExtractorsConfig = { buildExtractorRegistry };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
