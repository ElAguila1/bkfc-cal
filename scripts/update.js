import fs from "fs";
import fetch from "node-fetch";
import ical from "ical-generator";
import * as cheerio from "cheerio";

const EVENTS_INDEX =
  "https://www.tapology.com/fightcenter/events?organization=2682";

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  return res.text();
}

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const indexHTML = await fetchHTML(EVENTS_INDEX);
  const $ = cheerio.load(indexHTML);

  const links = $("a[href^='/fightcenter/events/']").toArray();

  let added = 0;
  const seen = new Set();

  for (const el of links) {
    const linkEl = $(el);
    const eventURL = "https://www.tapology.com" + linkEl.attr("href");

    // Avoid duplicates
    if (seen.has(eventURL)) continue;
    seen.add(eventURL);

    const container = linkEl.closest("div, li");
    const text = container.text();

    // Extract title
    const title = linkEl.text().trim();
    if (!title) continue;

    // Extract date like "Sat, Feb 7, 2026"
    const dateMatch = text.match(
      /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/
    );
    if (!dateMatch) continue;

    const start = new Date(dateMatch[0]);
    if (isNaN(start)) continue;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    // Try to get main event
    let mainEvent = "";
    try {
      const eventHTML = await fetchHTML(eventURL);
      const $$ = cheerio.load(eventHTML);

      const bout = $$("h2, h3")
        .filter((_, h) =>
          $$(h).text().toLowerCase().includes("vs")
        )
        .first()
        .text()
        .trim();

      if (bout) mainEvent = bout;
    } catch {
      // enrichment optional
    }

    const summary = mainEvent
      ? `${title} — ${mainEvent}`
      : title;

    calendar.createEvent({
      summary,
      start,
      end,
      description: eventURL,
      url: eventURL
    });

    added++;
  }

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());

  console.log(`BKFC events added from Tapology: ${added}`);
}

run();
