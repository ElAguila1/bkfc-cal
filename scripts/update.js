import axios from "axios";
import cheerio from "cheerio";
import fs from "fs";
import ical from "ical-generator";
import moment from "moment-timezone";

const EVENTS_URL = "https://www.bkfc.com/events";

function getTimezone(text = "") {
  const t = text.toLowerCase();
  if (t.includes("las vegas") || t.includes("nevada")) return "America/Los_Angeles";
  if (t.includes("california")) return "America/Los_Angeles";
  if (t.includes("arizona")) return "America/Phoenix";
  if (t.includes("texas")) return "America/Chicago";
  if (t.includes("london")) return "Europe/London";
  return "America/New_York"; // default (Miami / Philly / NYC)
}

async function run() {
  const cal = ical({ name: "BKFC Fight Cards" });

  const { data } = await axios.get(EVENTS_URL);
  const $ = cheerio.load(data);

  const links = new Set();
  $("a[href^='/events/']").each((_, el) => {
    links.add("https://www.bkfc.com" + $(el).attr("href"));
  });

  for (const link of links) {
    try {
      const { data } = await axios.get(link);
      const $e = cheerio.load(data);

      const title = $e("h1").first().text().trim();
      const timeISO = $e("time").attr("datetime");
      if (!timeISO) continue;

      const locationText = $e("body").text();
      const tz = getTimezone(locationText);

      const start = moment.tz(timeISO, tz);
      const end = start.clone().add(4, "hours");

      const venue = $e("[class*=arena], [class*=venue]").first().text().trim();

      const fights = [];
      $e("body").find("vs").each((_, el) => {
        const text = $e(el).parent().text().replace(/\s+/g, " ").trim();
        if (text.includes(" vs ")) fights.push(text);
      });

      let desc = "";
      if (fights[0]) desc += `Main Event:\n• ${fights[0]}\n\n`;
      if (fights[1]) desc += `Co-Main Event:\n• ${fights[1]}\n\n`;
      if (fights.length > 2) {
        desc += "Fight Card:\n";
        fights.slice(2).forEach(f => desc += `• ${f}\n`);
        desc += "\n";
      }
      desc += `Official event page:\n${link}`;

      cal.createEvent({
        summary: title,
        start: start.toDate(),
        end: end.toDate(),
        timezone: tz,
        location: venue,
        description: desc
      });

    } catch {}
  }

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", cal.toString());
}

run();
