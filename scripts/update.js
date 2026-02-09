import fs from "fs";
import ical from "ical-generator";
import { chromium } from "playwright";

const EVENTS_URL =
  "https://www.tapology.com/fightcenter/events?organization=2682";

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
  });

  await page.goto(EVENTS_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  // 🔑 THIS is the correct wait condition
  await page.waitForSelector("a[href^='/fightcenter/events/']", {
    timeout: 60000
  });

  const events = await page.evaluate(() => {
    const results = [];
    const links = document.querySelectorAll(
      "a[href^='/fightcenter/events/']"
    );

    links.forEach(link => {
      const container = link.closest("div, li");
      if (!container) return;

      const text = container.innerText;

      const dateMatch = text.match(
        /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/
      );
      if (!dateMatch) return;

      results.push({
        title: link.innerText.trim(),
        date: dateMatch[0],
        url: "https://www.tapology.com" + link.getAttribute("href")
      });
    });

    return results;
  });

  if (!events.length) {
    throw new Error("Tapology DOM loaded but no events found");
  }

  let added = 0;

  for (const event of events) {
    const start = new Date(event.date);
    if (isNaN(start)) continue;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    // Optional: extract main event from event page
    let mainEvent = "";
    try {
      const eventPage = await browser.newPage();
      await eventPage.goto(event.url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await eventPage.waitForTimeout(3000);

      mainEvent = await eventPage.evaluate(() => {
        const headers = Array.from(document.querySelectorAll("h2, h3"));
        const h = headers.find(h =>
          h.textContent.toLowerCase().includes(" vs ")
        );
        return h ? h.textContent.trim() : "";
      });

      await eventPage.close();
    } catch {
      // ignore enrichment failure
    }

    const summary = mainEvent
      ? `${event.title} — ${mainEvent}`
      : event.title;

    calendar.createEvent({
      summary,
      start,
      end,
      description: event.url,
      url: event.url
    });

    added++;
  }

  await browser.close();

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());

  console.log(`BKFC events added via Tapology (Playwright DOM): ${added}`);
}

run();
