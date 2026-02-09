import fs from "fs";
import ical from "ical-generator";
import fetch from "node-fetch";

const API_KEY = process.env.TICKETMASTER_API_KEY;

// Search Ticketmaster for BKFC events
const SEARCH_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json" +
  "?keyword=Bare%20Knuckle" +
  "&classificationName=Sports" +
  "&size=50" +
  "&apikey=" + API_KEY;

async function run() {
  if (!API_KEY) {
    throw new Error("Missing TICKETMASTER_API_KEY");
  }

  const calendar = ical({ name: "BKFC Events" });

  const res = await fetch(SEARCH_URL);
  const data = await res.json();

  const events = data?._embedded?.events || [];

  let count = 0;

  for (const event of events) {
    const name = event.name;
    const url = event.url;

    const startDate = event.dates?.start?.dateTime;
    const timezone = event.dates?.timezone;

    if (!name || !startDate) continue;

    const start = new Date(startDate);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    const venue = event._embedded?.venues?.[0];
    const location = venue
      ? [venue.name, venue.city?.name, venue.state?.stateCode]
          .filter(Boolean)
          .join(", ")
      : "";

    calendar.createEvent({
      summary: name,
      start,
      end,
      location,
      description: url,
      url
    });

    count++;
  }

  console.log(`Ticketmaster BKFC events added: ${count}`);

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
