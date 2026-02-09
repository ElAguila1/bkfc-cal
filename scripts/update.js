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

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
  });

  let eventsData = [];

  // Capture Tapology's JSON responses
  page.on("response", async (response) => {
    try {
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("application/json")) return;

      const json = await response.json();

      if (Array.isArray(json?.events) && json.events.length) {
        eventsData = json.events;
      }
    } catch {
      // ignore
    }
  });

  // IMPORTANT: do NOT wait for networkidle
  await page.goto(EVENTS_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Give JS time to fire requests
  await page.waitForTimeout(5000);

  if (!eventsData.length) {
    throw new Error("No Tapology events JSON captured");
  }

  let added = 0;

  for (const event of eventsData) {
    const title = event.name || event.title;
    const dateText = event.date || event.start_date;
    const location = event.location || "";
    const slug = event.slug;

    if (!title || !dateText) continue;

    const start = new Date(dateText);
    if (isNaN(start)) continue;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    let mainEvent = "";

    if (slug) {
      try {
        const eventPage = await browser.newPage();
        await eventPage.goto(
          `https://www.tapology.com/fightcenter/events/${slug}`,
          { waitUntil: "domcontentloaded", timeout: 60000 }
        );

        await eventPage.waitForTimeout(3000);

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
        // enrichment optional
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
