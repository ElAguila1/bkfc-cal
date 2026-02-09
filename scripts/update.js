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

  let added = 0;

  // Each BKFC event card
  $(".cc-matchup-event").each(async (_, el) => {
    const linkEl = $(el).find("a[href^='/fightcenter/events/']");
    if (!linkEl.length) return;

    const eventURL =
      "https://www.tapology.com" + linkEl.attr("href");

    const title =
      linkEl.find(".f-site-text--primary").text().trim();

    const dateText =
      linkEl.find(".f-site-text--secondary").first().text().trim();

    const location =
      linkEl.find(".f-site-text--secondary").eq(1).text().trim();

    if (!title || !dateText) return;

    const start = new Date(dateText);
    if (isNaN(start)) return;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    // 🔎 Fetch event page to get main event (best effort)
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
      // ignore enrichment failures
    }

    const summary = mainEvent
      ? `${title} — ${mainEvent}`
      : title;

    calendar.createEvent({
      summary,
      start,
      end,
      location,
      description: eventURL,
      url: eventURL
    });

    added++;
  });

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());

  console.log(`BKFC events added from Tapology: ${added}`);
}

run();
