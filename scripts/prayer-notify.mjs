// Sends Bark push notifications for prayer (adhan/iqama) times.
// Run by .github/workflows/prayer-notifications.yml every 5 minutes.
//
// Reads public/prayer/config.json for location, calculation and notification
// settings. The Bark key comes from the BARK_KEY repo secret if set,
// otherwise from config.json's bark.key.
//
// Each run sends any notification whose moment fell inside the last
// LOOKBACK_MINUTES (cron runs can be delayed a few minutes), deduplicated via
// a state file (.bark-state.json) persisted between runs with actions/cache.
//
// Env:
//   BARK_KEY   - overrides config.json bark.key
//   FAKE_NOW   - ISO timestamp for testing (skips real sends unless SEND=1)
//   TEST_PUSH  - "1" to send a single test notification and exit

import { readFileSync, writeFileSync } from "node:fs";
import { computePrayerTimes, formatMinutes } from "../public/prayer/prayertimes.js";

const LOOKBACK_MINUTES = 14;
const STATE_FILE = new URL("../.bark-state.json", import.meta.url);
const CONFIG_FILE = new URL("../public/prayer/config.json", import.meta.url);

const NAMES = {
  fajr: { ar: "الفجر", en: "Fajr" },
  dhuhr: { ar: "الظهر", en: "Dhuhr" },
  asr: { ar: "العصر", en: "Asr" },
  maghrib: { ar: "المغرب", en: "Maghrib" },
  isha: { ar: "العشاء", en: "Isha" },
};

const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
const bark = config.bark;
const barkKey = (process.env.BARK_KEY || bark.key || "").trim();

if (!barkKey) {
  console.log(
    "No Bark key configured (set the BARK_KEY repo secret or bark.key in public/prayer/config.json). Nothing to do."
  );
  process.exit(0);
}

const dryRun = !!process.env.FAKE_NOW && process.env.SEND !== "1";
const nowMs = process.env.FAKE_NOW ? Date.parse(process.env.FAKE_NOW) : Date.now();

async function sendBark(title, body) {
  const url =
    `${bark.server.replace(/\/+$/, "")}/${encodeURIComponent(barkKey)}/` +
    `${encodeURIComponent(title)}/${encodeURIComponent(body)}` +
    `?group=prayer&sound=${encodeURIComponent(bark.sound || "minuet")}` +
    (bark.timeSensitive ? "&level=timeSensitive" : "");
  if (dryRun) {
    console.log(`[dry-run] ${title} — ${body}`);
    return;
  }
  const res = await fetch(url);
  const text = await res.text().catch(() => "");
  console.log(`sent: ${title} — ${body} → HTTP ${res.status} ${text.slice(0, 120)}`);
  if (!res.ok) process.exitCode = 1;
}

if (process.env.TEST_PUSH === "1") {
  await sendBark("🕌 مواقيت الصلاة", "Test notification from GitHub Actions ✓");
  process.exit();
}

// --- compute today's notification moments (in the configured UTC offset) ---

const offset = config.location.utcOffset;
const local = new Date(nowMs + offset * 3600e3);
const dateKey = local.toISOString().slice(0, 10);

const times = computePrayerTimes({
  year: local.getUTCFullYear(),
  month: local.getUTCMonth() + 1,
  day: local.getUTCDate(),
  latitude: config.location.latitude,
  longitude: config.location.longitude,
  utcOffset: offset,
  fajrAngle: config.calculation.fajrAngle,
  ishaAngle: config.calculation.ishaAngle,
  asrFactor: config.calculation.asrFactor,
  adjustments: config.calculation.adjustments,
});

const midnightMs =
  Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
  offset * 3600e3;
const epochOf = (minutes) => midnightMs + minutes * 60e3;
const minutesLeft = (targetMs) => Math.max(0, Math.round((targetMs - nowMs) / 60e3));

const n = bark.notifications;
const events = [];

for (const prayer of Object.keys(NAMES)) {
  if (!bark.prayers[prayer]) continue;
  const name = NAMES[prayer];
  const adhanMs = epochOf(times[prayer]);
  const iqamaMs = adhanMs + config.iqama[prayer] * 60e3;
  const adhanStr = formatMinutes(times[prayer]);
  const iqamaStr = formatMinutes(times[prayer] + config.iqama[prayer]);
  const title = `🕌 ${name.ar} · ${name.en}`;

  if (n.beforeAdhan.enabled) {
    events.push({
      id: `${prayer}-beforeAdhan`,
      at: adhanMs - n.beforeAdhan.minutes * 60e3,
      title,
      body: () =>
        `${name.en} adhan is in ${minutesLeft(adhanMs)} minutes (${adhanStr}) · ` +
        `${minutesLeft(iqamaMs)} minutes until the iqama (${iqamaStr})`,
    });
  }
  if (n.atAdhan.enabled) {
    events.push({
      id: `${prayer}-atAdhan`,
      at: adhanMs,
      title,
      body: () =>
        `It is time for ${name.en} — الله أكبر · iqama in ${minutesLeft(iqamaMs)} minutes (${iqamaStr})`,
    });
  }
  if (n.beforeIqama.enabled) {
    events.push({
      id: `${prayer}-beforeIqama`,
      at: iqamaMs - n.beforeIqama.minutes * 60e3,
      title,
      body: () => `Iqama for ${name.en} is in ${minutesLeft(iqamaMs)} minutes (${iqamaStr})`,
    });
  }
  if (n.atIqama.enabled) {
    events.push({
      id: `${prayer}-atIqama`,
      at: iqamaMs,
      title,
      body: () => `Iqama for ${name.en} — قد قامت الصلاة`,
    });
  }
}

// --- dedupe state ---

let state = { date: dateKey, sent: [] };
try {
  const prev = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  if (prev.date === dateKey) state = prev;
} catch {
  /* first run of the day / no cache */
}

const windowStart = nowMs - LOOKBACK_MINUTES * 60e3;
const due = events
  .filter((e) => e.at > windowStart && e.at <= nowMs && !state.sent.includes(e.id))
  .sort((a, b) => a.at - b.at);

console.log(
  `${dateKey} ${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")} local — ` +
    `${events.length} scheduled moments today, ${due.length} due now.`
);

for (const e of due) {
  await sendBark(e.title, e.body());
  state.sent.push(e.id);
}

writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
