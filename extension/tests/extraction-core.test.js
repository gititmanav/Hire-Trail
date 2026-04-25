const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const {
  canonicalizeUrl,
  computeConfidence,
  isLikelyJobPage,
  scrapeWithFallback,
} = require("../content/extraction-core.js");

test("canonicalizeUrl removes noisy tracking params", () => {
  const output = canonicalizeUrl(
    "https://jobs.example.com/opening?utm_source=li&ref=123&keep=yes#section",
    "https://jobs.example.com",
  );
  assert.equal(output, "https://jobs.example.com/opening?keep=yes");
});

test("computeConfidence scores higher with stronger fields", () => {
  const low = computeConfidence({ title: "SWE", company: "", jobDescription: "", location: "" });
  const high = computeConfidence({
    title: "Senior Software Engineer",
    company: "Acme",
    jobDescription: "A".repeat(250),
    location: "New York",
  });
  assert.ok(high > low);
  assert.ok(high >= 80);
});

test("isLikelyJobPage detects job pages from signals", () => {
  const data = {
    title: "Backend Engineer",
    company: "Acme",
    jobDescription: "Responsibilities include building APIs and distributed systems. ".repeat(5),
    location: "Remote",
  };
  const result = isLikelyJobPage(
    data,
    "careers.acme.com",
    "/jobs/backend-engineer",
    "Job description responsibilities qualifications",
  );
  assert.equal(result, true);
});

test("scrapeWithFallback fills title and description from generic DOM", () => {
  const html = `
    <html>
      <head><title>Platform Engineer - Acme</title></head>
      <body>
        <main>
          <h1>Platform Engineer</h1>
          <p>${"We are hiring engineers. ".repeat(20)}</p>
        </main>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: "https://example.com/jobs/platform?utm_source=x&utm_medium=y" });
  const doc = dom.window.document;
  const location = dom.window.location;

  const scraped = scrapeWithFallback(
    () => ({ title: "", company: "", jobDescription: "", location: "", salary: "", jobType: "" }),
    doc,
    location,
  );

  assert.equal(scraped.title, "Platform Engineer");
  assert.ok(scraped.jobDescription.length > 100);
  assert.equal(scraped.url, "https://example.com/jobs/platform");
});
