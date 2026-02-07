import fs from "fs";
import ical from "ical-generator";
import { chromium } from "playwright";

const EVENTS_URL = "https://www.bkfc.com/events";

function parseBKFCDate(text) {
  // Example: "FEBRUARY 7, 2026 7:00 PM EST"
  return new Date(text);
}

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(EVENTS_URL, { waitUntil: "networkidle" });

  // Each event card has a "SEE EVENT" button
  const events = await page.$$eval("a:has-text('SEE EVENT')", buttons =>
    buttons.map(btn => {
      const card = btn.closest("div");

      const title =
        card.querySelector("h1, h2, h3")?.textContent.trim() || null;

      const dateText = Array.from(card.querySelectorAll("div, span"))
        .map(el => el.textContent.trim())
        .find(t => /AM|PM/.test(t));

      const url = btn.href;

      if (!title || !dateText || !url) return null;

      return { title, dateText, url };
    }).filter(Boolean)
  );

  for (const event of events) {
    const start = parseBKFCDate(event.dateText);
    if (isNaN(start)) continue;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    calendar.createEvent({
      summary: event.title,
      start,
      end,
      description: `Official BKFC Event\n\n${event.url}`,
      url: event.url
    });
  }

  await browser.close();

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
