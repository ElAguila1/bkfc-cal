import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import ical from "ical-generator";

const TAPOLOGY_URL =
  "https://www.tapology.com/fightcenter/promotions/2682-bare-knuckle-fighting-championship-bnfc";

async function run() {
  const calendar = ical({ name: "BKFC Events (Tapology)" });

  const { data: html } = await axios.get(TAPOLOGY_URL);
  const $ = cheerio.load(html);

  $(".fcListing").each((_, el) => {
    const title = $(el).find(".fcListing__title a").text().trim();
    const dateText = $(el).find(".fcListing__date").text().trim();
    const location = $(el).find(".fcListing__location").text().trim();
    const link = $(el).find(".fcListing__title a").attr("href");

    if (!title || !dateText) return;

    // Example: "Sat, Feb 7, 2026"
    const start = new Date(dateText);
    if (isNaN(start)) return;

    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    calendar.createEvent({
      summary: title,
      start,
      end,
      location,
      description: `Source: Tapology\n\nhttps://www.tapology.com${link}`,
      url: `https://www.tapology.com${link}`
    });
  });

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
