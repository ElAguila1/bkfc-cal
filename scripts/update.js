import fs from "fs";
import ical from "ical-generator";
import { chromium } from "playwright";

const EVENTS_INDEX = "https://www.bkfc.com/events";

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Load events index
  await page.goto(EVENTS_INDEX, { waitUntil: "networkidle" });

  // Wait for event links (this IS reliable)
  await page.waitForSelector("a[href^='/events/']", { timeout: 20000 });

  // Get unique event URLs
  const eventLinks = await page.$$eval(
    "a[href^='/events/']",
    links =>
      [...new Set(
        links
          .map(a => a.getAttribute("href"))
          .filter(h => h && h.startsWith("/events/"))
      )]
  );

  for (const href of eventLinks) {
    const eventUrl = "https://www.bkfc.com" + href;

    try {
      await page.goto(eventUrl, { waitUntil: "networkidle" });

      // Event pages DO contain <time datetime>
      const datetime = await page.getAttribute("time", "datetime");
      const title = await page.textContent("h1");

      if (!datetime || !title) continue;

      const start = new Date(datetime);
      const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

      calendar.createEvent({
        summary: title.trim(),
        start,
        end,
        description: `Official BKFC Event\n\n${eventUrl}`,
        url: eventUrl
      });
    } catch {
      // Skip broken or placeholder pages
      continue;
    }
  }

  await browser.close();

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
