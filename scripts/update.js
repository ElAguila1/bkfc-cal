import fs from "fs";
import ical from "ical-generator";
import { chromium } from "playwright";

const EVENTS_URL =
  "https://www.tapology.com/fightcenter/events?organization=2682";

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  let eventsData = null;

  // 🔴 This is the key: listen for the JSON Tapology uses
  page.on("response", async (response) => {
    const url = response.url();

    if (
      url.includes("/api/") &&
      url.includes("events") &&
      response.request().method() === "GET"
    ) {
      try {
        const json = await response.json();
        if (json && Array.isArray(json.events)) {
          eventsData = json.events;
        }
      } catch {
        // ignore non-JSON responses
      }
    }
  });

  await page.goto(EVENTS_URL, { waitUntil: "networkidle" });

  if (!eventsData || eventsData.length === 0) {
    throw new Error("Failed to capture Tapology events JSON");
  }

  let added = 0;

  for (const event of eventsData) {
    const title = event.name;
    const dateText = event.date;
    const location = event.location;
    const eventURL = `https://www.tapology.com/fightcenter/events/${event.slug}`;

    if (!title || !dateText) continue;

    const start = new Date(dateText);
    if (isNaN(start)) continue;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    // Optional: fetch event page to extract main event
    let mainEvent = "";
    try {
      const eventPage = await browser.newPage();
      await eventPage.goto(eventURL, { waitUntil: "networkidle" });

      const bout = await eventPage.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h2, h3"));
        const vs = headings.find(h =>
          h.textContent.toLowerCase().includes(" vs ")
        );
        return vs ? vs.textContent.trim() : "";
      });

      if (bout) mainEvent = bout;

      await eventPage.close();
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
      location,
      description: eventURL,
      url: eventURL
    });

    added++;
  }

  await browser.close();

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());

  console.log(`BKFC events added via Tapology (Playwright): ${added}`);
}

run();
