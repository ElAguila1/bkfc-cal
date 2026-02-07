import fs from "fs";
import ical from "ical-generator";
import { chromium } from "playwright";

const EVENTS_URL = "https://www.bkfc.com/events";

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(EVENTS_URL, { waitUntil: "networkidle" });

  // Wait for event cards to appear
  await page.waitForSelector("time[datetime]", { timeout: 15000 });

  const events = await page.$$eval("a[href^='/events/']", links =>
    links.map(link => {
      const timeEl = link.querySelector("time[datetime]");
      const titleEl = link.querySelector("h1, h2, h3");

      if (!timeEl || !titleEl) return null;

      return {
        title: titleEl.textContent.trim(),
        datetime: timeEl.getAttribute("datetime"),
        url: "https://www.bkfc.com" + link.getAttribute("href")
      };
    }).filter(Boolean)
  );

  for (const event of events) {
    const start = new Date(event.datetime);
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
