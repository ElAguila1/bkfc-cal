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

  let eventsData = [];

  // Intercept Tapology's internal JSON
  page.on("response", async (response) => {
    try {
      const url = response.url();

      if (
        response.request().method() === "GET" &&
        url.includes("events") &&
        response.headers()["content-type"]?.includes("application/json")
      ) {
        const json = await response.json();

        // Defensive: capture any array that looks like events
        if (Array.isArray(json?.events)) {
          eventsData = json.events;
        }
      }
    } catch {
      // ignore
    }
  });

  await page.goto(EVENTS_URL, { waitUntil: "networkidle" });

  if (!eventsData.length) {
    throw new Error("No Tapology events JSON captured");
  }

  let added = 0;

  for (const event of eventsData) {
    const title = event.name || event.title;
    const dateText = event.date || event.start_date;
    const location = event.location || "";
    const slug = event.slug || "";

    if (!title || !dateText) continue;

    const start = new Date(dateText);
    if (isNaN(start)) continue;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    let mainEvent = "";

    // Optional enrichment: visit event page
    if (slug) {
      try {
        const eventPage = await browser.newPage();
        await eventPage.goto(
          `https://www.tapology.com/fightcenter/events/${slug}`,
          { waitUntil: "networkidle" }
        );

        const bout = await eventPage.evaluate(() => {
          const headers = Array.from(document.querySelectorAll("h2, h3"));
          const found = headers.find(h =>
            h.textContent.toLowerCase().includes(" vs ")
          );
          return found ? found.textContent.trim() : "";
        });

        if (bout) mainEvent = bout;
        await eventPage.close();
      } catch {
        // enrichment failure is non-fatal
      }
    }

    const summary = mainEvent
      ? `${title} — ${mainEvent}`
      : title;

    calendar.createEvent({
      summary,
      start,
      end,
      location,
      description: slug
        ? `https://www.tapology.com/fightcenter/events/${slug}`
        : "",
      url: slug
        ? `https://www.tapology.com/fightcenter/events/${slug}`
        : ""
    });

    added++;
  }

  await browser.close();

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());

  console.log(`BKFC events added via Tapology (Playwright): ${added}`);
}

run();
