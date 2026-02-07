import axios from "axios";
import fs from "fs";
import ical from "ical-generator";

const EVENTS_API = "https://www.bkfc.com/api/events/upcoming";

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const { data } = await axios.get(EVENTS_API);

  if (!Array.isArray(data)) {
    console.error("Unexpected API response");
    return;
  }

  data.forEach(event => {
    if (!event.startDate || !event.name) return;

    const start = new Date(event.startDate);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

    calendar.createEvent({
      summary: event.name,
      start,
      end,
      location: [event.venue, event.city, event.state].filter(Boolean).join(", "),
      description: `Official BKFC event\n\nhttps://www.bkfc.com/events/${event.slug}`
    });
  });

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
