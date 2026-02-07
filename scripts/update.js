import axios from "axios";
import fs from "fs";
import ical from "ical-generator";

const EVENTS_URL = "https://www.bkfc.com/events";

function extractJSON(html) {
  const match = html.match(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/s);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const { data: html } = await axios.get(EVENTS_URL);
  const json = extractJSON(html);

  if (!json || !json.events) {
    console.error("No events found in embedded JSON");
    return;
  }

  for (const event of json.events) {
    if (!event.startDate || !event.title) continue;

    const start = new Date(event.startDate);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    calendar.createEvent({
      summary: event.title,
      start,
      end,
      location: event.venue || "",
      description: `Official BKFC Event\n\nhttps://www.bkfc.com/events/${event.slug}`,
      url: `https://www.bkfc.com/events/${event.slug}`
    });
  }

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
