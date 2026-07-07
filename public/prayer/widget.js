// Scriptable home-screen widget for prayer times.
//
// You don't paste this whole file. In Scriptable you paste a tiny 3-line
// loader (see docs/prayer-app.md) that fetches and runs this script, so any
// later change here updates your widget automatically — no re-pasting.
//
// Shows the next adhan (or the iqama, once the adhan has passed) with a
// live-ish countdown, plus today's full timetable on the medium/large sizes.
// It reads the same public/prayer/config.json as the website, so location,
// calculation method, tuning and iqama offsets always match.

// Pulled from raw.githubusercontent (not GitHub Pages) so it's available the
// instant it's on main and never returns an HTML/404 page mid-deploy.
const CONFIG_URL =
  "https://raw.githubusercontent.com/mustafaalbaree-uky/therapy-notes/main/public/prayer/config.json";

// ---- prayer calculation (mirrors public/prayer/prayertimes.js) ----
const DEG = Math.PI / 180;
const dsin = (d) => Math.sin(d * DEG);
const dcos = (d) => Math.cos(d * DEG);
const dtan = (d) => Math.tan(d * DEG);
const darcsin = (x) => Math.asin(x) / DEG;
const darccos = (x) => Math.acos(Math.min(1, Math.max(-1, x))) / DEG;
const darctan2 = (y, x) => Math.atan2(y, x) / DEG;
const darccot = (x) => Math.atan(1 / x) / DEG;
const fixAngle = (a) => ((a % 360) + 360) % 360;
const fixHour = (h) => ((h % 24) + 24) % 24;

function julianDay(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    b -
    1524.5
  );
}

function sunPosition(jd) {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = darctan2(dcos(e) * dsin(l), dcos(l)) / 15;
  return {
    declination: darcsin(dsin(e) * dsin(l)),
    equation: q / 15 - fixHour(ra),
  };
}

const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

function computePrayerTimes(o) {
  const {
    year, month, day, latitude, longitude, utcOffset,
    fajrAngle = 18, ishaAngle = 18, asrFactor = 1, adjustments = {},
  } = o;
  const jd = julianDay(year, month, day) - longitude / (15 * 24);
  const midDay = (t) => fixHour(12 - sunPosition(jd + t).equation);
  const sunAngleTime = (angle, t, ccw = false) => {
    const decl = sunPosition(jd + t).declination;
    const ha =
      (1 / 15) *
      darccos(
        (-dsin(angle) - dsin(decl) * dsin(latitude)) /
          (dcos(decl) * dcos(latitude))
      );
    return midDay(t) + (ccw ? -ha : ha);
  };
  const asrTime = (t) => {
    const decl = sunPosition(jd + t).declination;
    const angle = -darccot(asrFactor + dtan(Math.abs(latitude - decl)));
    return sunAngleTime(angle, t);
  };
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    t = {
      fajr: sunAngleTime(fajrAngle, t.fajr / 24, true),
      sunrise: sunAngleTime(0.833, t.sunrise / 24, true),
      dhuhr: midDay(t.dhuhr / 24),
      asr: asrTime(t.asr / 24),
      maghrib: sunAngleTime(0.833, t.maghrib / 24),
      isha: sunAngleTime(ishaAngle, t.isha / 24),
    };
  }
  const tzShift = utcOffset - longitude / 15;
  const result = {};
  for (const name of PRAYERS) {
    result[name] =
      Math.round(fixHour(t[name] + tzShift) * 60) + (adjustments[name] || 0);
  }
  return result;
}

function formatMinutes(total) {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
}

const NAMES = {
  fajr: { ar: "الفجر", en: "Fajr" },
  sunrise: { ar: "الشروق", en: "Shuruq" },
  dhuhr: { ar: "الظهر", en: "Dhuhr" },
  asr: { ar: "العصر", en: "Asr" },
  maghrib: { ar: "المغرب", en: "Maghrib" },
  isha: { ar: "العشاء", en: "Isha" },
};
const ADHAN_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

// ---- fetch config (fall back to sensible Amman defaults if offline) ----
let cfg;
try {
  cfg = await new Request(CONFIG_URL).loadJSON();
} catch (e) {
  cfg = {
    location: { name: "Amman, Jordan", latitude: 31.95, longitude: 35.93, utcOffset: 3 },
    calculation: { fajrAngle: 18, ishaAngle: 18, asrFactor: 1,
      adjustments: { fajr: -1, sunrise: -6, dhuhr: 0, asr: 0, maghrib: 7, isha: 1 } },
    iqama: { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20 },
  };
}

const offset = cfg.location.utcOffset;
const nowMs = Date.now();
const local = new Date(nowMs + offset * 3600e3);

function timesFor(d) {
  return computePrayerTimes({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    latitude: cfg.location.latitude,
    longitude: cfg.location.longitude,
    utcOffset: offset,
    fajrAngle: cfg.calculation.fajrAngle,
    ishaAngle: cfg.calculation.ishaAngle,
    asrFactor: cfg.calculation.asrFactor,
    adjustments: cfg.calculation.adjustments,
  });
}
function epochAt(d, minutes) {
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    offset * 3600e3 +
    minutes * 60e3
  );
}

const today = local;
const tomorrow = new Date(local.getTime() + 864e5);
const tToday = timesFor(today);
const tTomorrow = timesFor(tomorrow);

// Ordered adhan + iqama events, today + tomorrow's fajr, to find "next".
const events = [];
for (const p of ADHAN_PRAYERS) {
  const adhan = epochAt(today, tToday[p]);
  events.push({ prayer: p, kind: "adhan", epoch: adhan, minutes: tToday[p] });
  events.push({ prayer: p, kind: "iqama", epoch: adhan + cfg.iqama[p] * 60e3, minutes: tToday[p] + cfg.iqama[p] });
}
const fajrTom = epochAt(tomorrow, tTomorrow.fajr);
events.push({ prayer: "fajr", kind: "adhan", epoch: fajrTom, minutes: tTomorrow.fajr, tomorrow: true });

const nextIdx = events.findIndex((e) => e.epoch > nowMs);
const next = nextIdx >= 0 ? events[nextIdx] : events[events.length - 1];

// How far we are between the previous event and the next one, for the bar.
const prevEpoch = nextIdx > 0 ? events[nextIdx - 1].epoch : nowMs - 1;
const span = Math.max(1, next.epoch - prevEpoch);
const pct = Math.min(1, Math.max(0, (nowMs - prevEpoch) / span));

// Short clock (no AM/PM) so the 5-column timetable never wraps.
function formatShort(total) {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")}`;
}

// Daily-rotating quote (verified sources only; edit them in config.json).
const quotes = cfg.quotes && cfg.quotes.length ? cfg.quotes : null;
const dayOfYear = Math.floor(
  (Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    Date.UTC(local.getUTCFullYear(), 0, 0)) /
    864e5
);
const quote = quotes ? quotes[dayOfYear % quotes.length] : null;

// ---- colors / fonts ----
const C = {
  bg: new Color("0b0d12"),
  panel: new Color("12151d"),
  gold: new Color("d4af37"),
  goldSoft: new Color("b9973a"),
  text: new Color("f2ede1"),
  muted: new Color("8d93a3"),
  dim: new Color("5a6070"),
};

const family = config.widgetFamily || "medium";
const w = new ListWidget();
const grad = new LinearGradient();
grad.colors = [new Color("171b25"), new Color("0b0d12")];
grad.locations = [0, 1];
w.backgroundGradient = grad;
w.setPadding(14, 16, 14, 16);
w.url = "https://mustafaalbaree-uky.github.io/therapy-notes/prayer/";

// header
const head = w.addStack();
const loc = head.addText("🕌 " + cfg.location.name.toUpperCase());
loc.font = Font.mediumSystemFont(9);
loc.textColor = C.muted;
head.addSpacer();
w.addSpacer(family === "small" ? 4 : 8);

// next prayer block
const name = NAMES[next.prayer];
const kicker = w.addText(
  (next.kind === "adhan" ? "NEXT ADHAN" : "IQAMA") +
    (next.tomorrow ? " · TOMORROW" : "")
);
kicker.font = Font.boldSystemFont(9);
kicker.textColor = C.muted;

const big = w.addStack();
big.centerAlignContent();
const ar = big.addText(name.ar);
ar.font = Font.boldSystemFont(family === "small" ? 24 : 30);
ar.textColor = C.gold;
big.addSpacer(8);
// Always a native live timer, so the countdown ticks every second on its own
// without iOS having to redraw the widget (static text would freeze between
// the system's infrequent refreshes). iOS shows H:MM:SS when over an hour
// away and MM:SS when under.
const cdFont = Font.boldSystemFont(family === "small" ? 22 : 28);
const cd = big.addDate(new Date(next.epoch));
cd.applyTimerStyle();
cd.font = cdFont;
cd.textColor = C.text;

const sub = w.addText(
  next.kind === "adhan"
    ? `${name.en} · Adhan ${formatMinutes(next.minutes)} · Iqama ${formatMinutes(next.minutes + cfg.iqama[next.prayer])}`
    : `${name.en} · Iqama at ${formatMinutes(next.minutes)}`
);
sub.font = Font.systemFont(family === "small" ? 9 : 11);
sub.textColor = C.muted;
sub.lineLimit = 1;
sub.minimumScaleFactor = 0.7;

// progress bar — fills as the time to the next event elapses. The trailing
// spacer stretches the track to the full card width so it sits snugly edge
// to edge; the gold fill is a fixed fraction of that width, left-aligned.
w.addSpacer(family === "small" ? 6 : 8);
const estFull = family === "small" ? 150 : family === "large" ? 330 : 310;
const track = w.addStack();
track.cornerRadius = 2.5;
track.backgroundColor = C.line;
const fill = track.addStack();
fill.size = new Size(Math.max(4, Math.round(estFull * pct)), 5);
fill.cornerRadius = 2.5;
fill.backgroundColor = C.gold;
track.addSpacer();

// today's timetable (medium / large only)
if (family !== "small") {
  w.addSpacer(9);
  const grid = w.addStack();
  grid.spacing = 6;
  const activePrayer = next.tomorrow ? null : next.prayer;
  for (const p of ADHAN_PRAYERS) {
    const col = grid.addStack();
    col.layoutVertically();
    col.centerAlignContent();
    const isPast = epochAt(today, tToday[p]) + cfg.iqama[p] * 60e3 < nowMs;
    const isActive = p === activePrayer;
    const cell = col.addStack();
    cell.addSpacer();
    const nm = cell.addText(NAMES[p].en);
    nm.font = Font.mediumSystemFont(10);
    nm.textColor = isActive ? C.gold : isPast ? C.dim : C.muted;
    nm.lineLimit = 1;
    nm.minimumScaleFactor = 0.6;
    cell.addSpacer();
    const tt = col.addStack();
    tt.addSpacer();
    const tm = tt.addText(formatShort(tToday[p]));
    tm.font = isActive ? Font.boldSystemFont(12) : Font.systemFont(12);
    tm.textColor = isActive ? C.gold : isPast ? C.dim : C.text;
    tm.lineLimit = 1;
    tm.minimumScaleFactor = 0.6;
    tt.addSpacer();
    grid.addSpacer(2);
  }
}

// quote (verified source) — one small line on medium/large
if (quote && family !== "small") {
  w.addSpacer(family === "large" ? 10 : 8);
  const qt = w.addText("“" + quote.translation + "”");
  qt.font = Font.lightSystemFont(family === "large" ? 11 : 9);
  qt.textColor = C.muted;
  qt.lineLimit = family === "large" ? 3 : 2;
  qt.minimumScaleFactor = 0.7;
  const qs = w.addText("— " + quote.source);
  qs.font = Font.mediumSystemFont(family === "large" ? 9 : 8);
  qs.textColor = C.goldSoft;
  qs.lineLimit = 1;
  qs.minimumScaleFactor = 0.6;
}

// The seconds tick on their own (native timer). We ask iOS to redraw at the
// event — to roll over to the next prayer — or within ~15 min to nudge the
// progress bar / pick up config changes, whichever comes first. iOS throttles
// these requests, so everything except the countdown updates on its schedule.
w.refreshAfterDate = new Date(Math.min(next.epoch + 2000, nowMs + 15 * 60e3));

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  if (family === "small") await w.presentSmall();
  else if (family === "large") await w.presentLarge();
  else await w.presentMedium();
}
Script.complete();
