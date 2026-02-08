import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import ical from "ical-generator";

const TAPOLOGY_URL =
  "https://www.tapology.com/fightcenter/promotions/2682-bare-knuckle-fighting-championship-bnfc";

async function run() {
  const calendar = ical({ name: "BKFC Events (Tapology)" });

  const response = await axios.get(TAPOLOGY_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const html = response.data;

  // 🔴 DEBUG: confirm what page we received
  console.log("HTML length:", html.length);
  console.log("HTML preview:", html.slice(0, 500));

  const $ = cheerio.load(html);

  let count = 0;

  $("table tr").each((_, row) => {
    const titleLink = $(row).find("a[href^='/fightcenter/events/']");
    const dateText = $(row).find("td").eq(0).text().trim();

    if (!titleLink.length || !dateText) return;

    const title = titleLink.text().trim();
    const link = "https://www.tapology.com" + titleLink.attr("href");

    const start = new Date(dateText);
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

  console.log("Parsed events:", count);

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
