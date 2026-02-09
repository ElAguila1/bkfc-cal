import fetch from "node-fetch";
import ical from "ical-generator";
import fs from "fs";

const API_KEY = process.env.TICKETMASTER_API_KEY;

if (!API_KEY) {
  throw new Error("Missing TICKETMASTER_API_KEY");
}

const TM_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json" +
  "?keyword=BKFC" +
  "&classificationName=sports" +
  "&countryCode=US" +
  "&size=200" +
  `&apikey=${API_KEY}`;

async function run() {
  const res = await fetch(TM_URL);
  const data = await res.json();

  if (!data._embedded?.events) {
    console.log("No Ticketmaster BKFC events found");
    return;
  }

  const cal = ical({
    name: "BKFC Events",
    timezone: "UTC"
  });

  const seen = new Map(); // key → event with preferred time
  let added = 0;

  for (const event of data._embedded.events) {
    const name = event.name;
    const dates = event.dates?.start;
    const venue = event._embedded?.venues?.[0];

    if (!name || !dates || !venue) continue;

    const city = venue.city?.name || "";
    const localDate = dates.localDate;
    const hasDateTime = Boolean(dates.dateTime);

    if (!localDate) continue;

    // Stable identity for deduplication
    const key = `${name}|${localDate}|${city}`;

    // If we've already seen this event:
    if (seen.has(key)) {
      const existing = seen.get(key);

      // Keep whichever one has dateTime (authoritative)
      if (!existing.hasDateTime && hasDateTime) {
        seen.set(key, { event, hasDateTime });
      }
      continue;
    }

    seen.set(key, { event, hasDateTime });
  }

  // Now create calendar events from deduped list
  for (const { event } of seen.values()) {
    const dates = event.dates.start;
    const venue = event._embedded.venues[0];

    let start;
    let end;

    if (dates.dateTime) {
      // Authoritative UTC timestamp
      start = new Date(dates.dateTime);
      end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4 hours
    } else if (dates.localDate && dates.localTime) {
      // Fallback (rare)
      start = new Date(`${dates.localDate}T${dates.localTime}`);
      end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    } else {
      continue;
    }

    cal.createEvent({
      start,
      end,
      summary: event.name,
      description: event.url,
      location: `${venue.name}, ${venue.city.name}, ${venue.state?.stateCode || ""}`
    });

    added++;
  }

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", cal.toString());

  console.log(`Ticketmaster BKFC events added: ${added}`);
}

run();
