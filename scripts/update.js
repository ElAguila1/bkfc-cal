import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import ical from "ical-generator";

const TAPOLOGY_URL =
  "https://www.tapology.com/fightcenter/promotions/2682-bare-knuckle-fighting-championship-bnfc";

async function run() {
  const calendar = ical({ name: "BKFC Events (Tapology)" });

  const { data: html } = await axios.get(TAPOLOGY_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const $ = cheerio.load(html);

  let count = 0;

  // Tapology lists upcoming events as links to /fightcenter/events/...
  $("a[href^='/fightcenter/events/']").each((_, el) => {
    const title = $(el).text().trim();
    const link = "https://www.tapology.com" + $(el).attr("href");

    if (!title) return;

    // The date is usually nearby (same list item)
    const container = $(el).closest("li, div");
    const dateText = container.text();

    // Example: "Sat, Feb 7, 2026"
    const dateMatch = dateText.match(
      /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/
    );

    if (!dateMatch) return;

    const start = new Date(dateMatch[0]);
    if (isNaN(start)) return;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    calendar.createEvent({
      summary: title,
      start,
      end,
      description: `Source: Tapology\n\n${link}`,
      url: link
    });

    count++;
  });

  console.log(`Tapology events added: ${count}`);

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
