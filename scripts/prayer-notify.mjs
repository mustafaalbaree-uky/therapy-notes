// Sends Bark push notifications for prayer (adhan/iqama) times.
//
// GitHub's scheduled cron is unreliable for minute accurate timing, since it fires
// only a handful of times a day, nowhere near every prayer. So instead of
// "send whatever is due right now", the default LOOP mode runs a long-lived
// job (public repos allow ~6h jobs, free) that sleeps precisely until each
// notification moment and sends it. The cron just needs to (re)start this job
// occasionally; `concurrency: cancel-in-progress` means the newest run always
// takes over. Already-sent moments are in the past on any restart, so a fresh
// job never re-sends them.
//
// Settings come from public/prayer/config.json. The Bark key comes from the
// BARK_KEY repo secret if set, otherwise config.json's bark.key.
//
// Env:
//   BARK_KEY      - overrides config.json bark.key
//   LOOP          - "1" to run the sleep-until-due loop (used in CI)
//   LOOP_MINUTES  - how long the loop should cover before exiting (default 350)
//   TEST_PUSH     - "1" to send one test notification and exit
//   FAKE_NOW      - ISO time for one-shot testing (dry-run unless SEND=1)

import { readFileSync } from "node:fs";
import { computePrayerTimes, formatMinutes } from "../public/prayer/prayertimes.js";

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
const offset = config.location.utcOffset;

if (!barkKey) {
  console.log(
    "No Bark key configured (set the BARK_KEY repo secret or bark.key in public/prayer/config.json). Nothing to do."
  );
  process.exit(0);
}

const dryRun = !!process.env.FAKE_NOW && process.env.SEND !== "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

async function sendBark(title, body) {
  const url =
    `${bark.server.replace(/\/+$/, "")}/${encodeURIComponent(barkKey)}/` +
    `${encodeURIComponent(title)}/${encodeURIComponent(body)}` +
    `?group=prayer&sound=${encodeURIComponent(bark.sound || "minuet")}` +
    (bark.timeSensitive ? "&level=timeSensitive" : "");
  if (dryRun) {
    console.log(`[dry-run] ${title}: ${body}`);
    return;
  }
  try {
    const res = await fetch(url);
    const text = await res.text().catch(() => "");
    console.log(`sent: ${title}: ${body} → HTTP ${res.status} ${text.slice(0, 100)}`);
  } catch (e) {
    console.log(`send failed: ${title}: ${e.message}`);
  }
}

// Minutes from `now` until targetMs, evaluated at call time (send time).
const minutesLeft = (targetMs, now = Date.now()) =>
  Math.max(0, Math.round((targetMs - now) / 60e3));

// All notification moments for one local calendar date.
function eventsForDate(dateLocal) {
  const times = computePrayerTimes({
    year: dateLocal.getUTCFullYear(),
    month: dateLocal.getUTCMonth() + 1,
    day: dateLocal.getUTCDate(),
    latitude: config.location.latitude,
    longitude: config.location.longitude,
    utcOffset: offset,
    fajrAngle: config.calculation.fajrAngle,
    ishaAngle: config.calculation.ishaAngle,
    asrFactor: config.calculation.asrFactor,
    adjustments: config.calculation.adjustments,
  });
  const midnightMs =
    Date.UTC(dateLocal.getUTCFullYear(), dateLocal.getUTCMonth(), dateLocal.getUTCDate()) -
    offset * 3600e3;
  const dateKey = dateLocal.toISOString().slice(0, 10);
  const n = bark.notifications;
  const events = [];

  for (const prayer of Object.keys(NAMES)) {
    if (!bark.prayers[prayer]) continue;
    const name = NAMES[prayer];
    const adhanMs = midnightMs + times[prayer] * 60e3;
    const iqamaMs = adhanMs + config.iqama[prayer] * 60e3;
    const adhanStr = formatMinutes(times[prayer]);
    const iqamaStr = formatMinutes(times[prayer] + config.iqama[prayer]);
    const title = `🕌 ${name.ar} · ${name.en}`;
    const add = (kind, at, body) =>
      events.push({ id: `${dateKey}-${prayer}-${kind}`, at, title, body });

    if (n.beforeAdhan.enabled)
      add("beforeAdhan", adhanMs - n.beforeAdhan.minutes * 60e3, () =>
        `${name.en} adhan is in ${minutesLeft(adhanMs)} minutes (${adhanStr}) · ` +
        `${minutesLeft(iqamaMs)} minutes until the iqama (${iqamaStr})`
      );
    if (n.atAdhan.enabled)
      add("atAdhan", adhanMs, () =>
        `It is time for ${name.en} · الله أكبر · iqama in ${minutesLeft(iqamaMs)} minutes (${iqamaStr})`
      );
    if (n.beforeIqama.enabled)
      add("beforeIqama", iqamaMs - n.beforeIqama.minutes * 60e3, () =>
        `Iqama for ${name.en} is in ${minutesLeft(iqamaMs)} minutes (${iqamaStr})`
      );
    if (n.atIqama.enabled)
      add("atIqama", iqamaMs, () => `Iqama for ${name.en} · قد قامت الصلاة`);
  }
  return events;
}

// Today + tomorrow, so overnight coverage (Fajr) works within one job.
function allEvents(nowMs) {
  const local = new Date(nowMs + offset * 3600e3);
  const tomorrow = new Date(local.getTime() + 864e5);
  return [...eventsForDate(local), ...eventsForDate(tomorrow)].sort((a, b) => a.at - b.at);
}

// ---- test hook ----
if (process.env.TEST_PUSH === "1") {
  await sendBark("🕌 مواقيت الصلاة", "Test notification from GitHub Actions ✓");
  process.exit();
}

// ---- one-shot mode (manual/dry-run testing) ----
if (process.env.LOOP !== "1") {
  const nowMs = process.env.FAKE_NOW ? Date.parse(process.env.FAKE_NOW) : Date.now();
  const LOOKBACK = 14 * 60e3;
  const due = allEvents(nowMs).filter((e) => e.at > nowMs - LOOKBACK && e.at <= nowMs);
  console.log(`One-shot: ${due.length} notification(s) due in the last 14 min.`);
  for (const e of due) await sendBark(e.title, e.body());
  process.exit(0);
}

// ---- loop mode (CI default): sleep until each moment and send ----
const startMs = Date.now();
const budgetMs = (parseInt(process.env.LOOP_MINUTES || "350", 10)) * 60e3;
const GRACE = 90 * 1000; // send moments up to 90s late (missed by a hair)
const MAX_NAP = 20 * 60e3; // wake at least this often to recompute
const sent = new Set();

console.log(
  `Loop mode: covering the next ${Math.round(budgetMs / 60e3)} min from ` +
    `${new Date(startMs).toISOString()} (offset UTC${offset >= 0 ? "+" : ""}${offset}).`
);

while (Date.now() - startMs < budgetMs) {
  const now = Date.now();
  const events = allEvents(now).filter((e) => !sent.has(e.id));

  // Fire anything due now (or just barely missed).
  const due = events.filter((e) => e.at <= now + 1000 && e.at > now - GRACE);
  for (const e of due) {
    await sendBark(e.title, e.body());
    sent.add(e.id);
  }

  // Sleep until the next future moment (bounded by budget + a periodic wake).
  const future = events.filter((e) => e.at > now + 1000 && !sent.has(e.id));
  if (!future.length) {
    await sleep(Math.min(MAX_NAP, budgetMs - (Date.now() - startMs)));
    continue;
  }
  const waitMs = future[0].at - Date.now();
  const remaining = budgetMs - (Date.now() - startMs);
  if (waitMs > MAX_NAP) {
    console.log(
      `Next: ${future[0].title} at ${new Date(future[0].at).toISOString()} ` +
        `(in ${Math.round(waitMs / 60e3)} min).`
    );
  }
  await sleep(Math.max(1000, Math.min(waitMs, remaining, MAX_NAP)));
}

console.log("Loop budget elapsed; exiting. The next scheduled run continues coverage.");
process.exit(0);
