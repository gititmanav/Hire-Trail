const test = require("node:test");
const assert = require("node:assert/strict");
const { buildExtractorRegistry } = require("../content/extractors.config.js");

test("buildExtractorRegistry returns entries with expected shape", () => {
  const scrapers = {
    "linkedin.com": () => ({}),
    "indeed.com": () => ({}),
    "greenhouse.io": () => ({}),
    "lever.co": () => ({}),
    "glassdoor.com": () => ({}),
    "myworkdayjobs.com": () => ({}),
  };

  const registry = buildExtractorRegistry(scrapers);
  assert.ok(Array.isArray(registry));
  assert.ok(registry.length >= 6);
  for (const entry of registry) {
    assert.equal(typeof entry.domain, "string");
    assert.equal(typeof entry.scrape, "function");
    assert.ok(Array.isArray(entry.applySelectors));
  }
});
