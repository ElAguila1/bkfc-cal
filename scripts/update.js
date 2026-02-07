import axios from "axios";
import fs from "fs";
import ical from "ical-generator";
import * as cheerio from "cheerio";

const EVENTS_URL = "https://www.bkfc.com/events";

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const { data } = await axios.get(EVENTS_URL);
  const $ = cheerio.load(data);

  $("a[href^='/events/']").each((_, el) => {
    const link = "https://www.bkfc.com" + $(el).attr("href");

    const card = $(el).closest("article, div");
    const title = card.find("h2, h3").first().text().trim();
    const timeEl = card.find("time");

    const datetime = timeEl.attr("datetime");
    if (!datetime || !title) return;

    const start = new Date(datetime);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    calendar.createEvent({
      summary: title,
      start,
      end,
      description: `Official BKFC Event\n\n${link}`,
      url: link
    });
  });

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
