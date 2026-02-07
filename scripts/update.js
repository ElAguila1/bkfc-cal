import fs from "fs";
import ical from "ical-generator";

async function run() {
  const calendar = ical({ name: "BKFC Test Calendar" });

  const start = new Date();
  start.setMinutes(start.getMinutes() + 10);

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  calendar.createEvent({
    summary: "TEST EVENT – IF YOU SEE THIS, IT WORKS",
    start,
    end,
    description: "This is a test event to verify the calendar pipeline.",
    location: "Miami, FL"
  });

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
