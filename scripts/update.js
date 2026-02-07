import axios from "axios";
import fs from "fs";
import ical from "ical-generator";
import * as cheerio from "cheerio";

const EVENTS_URL = "https://www.bkfc.com/events";

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const { data } = await axios.get(EVENTS_URL);
  const $ = cheerio.load(data);

  $("time[datetime]").each((_, timeEl) => {
    const datetime = $(timeEl).attr("datetime");
    if (!datetime) return;

    const card = $(timeEl).parents("a").first();
    const href = card.attr("href");
    if (!href || !href.startsWith("/events/")) return;

    const title = card.find("h1, h2, h3").first().text().trim();
    if (!title) return;

    const start = new Date(datetime);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    calendar.createEvent({
      summary: title,
      start,
      end,
      description: `Official BKFC Event\n\nhttps://www.bkfc.com${href}`,
      url: `https://www.bkfc.com${href}`
    });
  });

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
