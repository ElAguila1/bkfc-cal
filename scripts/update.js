import axios from "axios";
import fs from "fs";
import ical from "ical-generator";

const EVENTS_URL = "https://www.bkfc.com/events";

// Recursively search any object/array for event-like objects
function findEvents(node, results = []) {
  if (!node) return results;

  if (Array.isArray(node)) {
    for (const item of node) findEvents(item, results);
  } else if (typeof node === "object") {
    const values = Object.values(node).join(" ");

    // Heuristic: looks like an event card
    if (
      typeof node === "object" &&
      values.match(/\b(AM|PM)\b/) &&
      values.match(/\b20\d{2}\b/)
    ) {
      results.push(node);
    }

    for (const key of Object.keys(node)) {
      findEvents(node[key], results);
    }
  }

  return results;
}

// Extract all application/json scripts
function extractJSONBlobs(html) {
  const blobs = [];
  const regex = /<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/gs;
  let match;
  while ((match = regex.exec(html))) {
    try {
      blobs.push(JSON.parse(match[1]));
    } catch {
      /* ignore */
    }
  }
  return blobs;
}

// Extract readable title + date text
function extractText(obj) {
  const text = Object.values(obj)
    .filter(v => typeof v === "string")
    .join(" ");
  return text;
}

async function run() {
  const calendar = ical({ name: "BKFC Events" });

  const { data: html } = await axios.get(EVENTS_URL);
  const blobs = extractJSONBlobs(html);

  const seen = new Set();

  for (const blob of blobs) {
    const candidates = findEvents(blob);

    for (const c of candidates) {
      const text = extractText(c);

      // Example date format: FEBRUARY 7, 2026 7:00 PM EST
      const dateMatch = text.match(
        /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{1,2},\s+20\d{2}\s+\d{1,2}:\d{2}\s+(AM|PM)\s+EST/i
      );

      if (!dateMatch) continue;

      const start = new Date(dateMatch[0]);
      if (isNaN(start)) continue;

      const title =
        c.title ||
        c.name ||
        text.split(dateMatch[0])[0].trim().slice(0, 80);

      if (!title || seen.has(title)) continue;
      seen.add(title);

      const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

      calendar.createEvent({
        summary: title,
        start,
        end,
        description: "Official BKFC Event",
      });
    }
  }

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/BKFC.ics", calendar.toString());
}

run();
