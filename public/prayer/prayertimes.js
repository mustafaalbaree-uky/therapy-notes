// Prayer time calculation, shared by the web app (public/prayer/app.js) and
// the Bark notification script (scripts/prayer-notify.mjs).
//
// Implements the well-known astronomical method used by praytimes.org:
// low-precision solar position (Meeus) + hour-angle formulas for the
// twilight/altitude-based times. Defaults are tuned to match the Jordanian
// mosque clock this app was built around (Fajr 18°, Isha 18°, standard Asr).

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

// Sun declination (deg) and equation of time (hours) for a given Julian day.
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

export const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

/**
 * Compute prayer times for one civil date.
 * Returns minutes-after-local-midnight for each prayer, already including the
 * per-prayer minute adjustments.
 */
export function computePrayerTimes({
  year,
  month, // 1-12
  day,
  latitude,
  longitude,
  utcOffset, // hours, e.g. 3 for Jordan
  fajrAngle = 18,
  ishaAngle = 18,
  asrFactor = 1, // 1 = Shafii/Maliki/Hanbali (standard), 2 = Hanafi
  adjustments = {}, // minutes per prayer, e.g. { maghrib: 6 }
}) {
  const jd = julianDay(year, month, day) - longitude / (15 * 24);

  const midDay = (t) => fixHour(12 - sunPosition(jd + t).equation);

  // Time (hours) the sun reaches `angle` below the horizon; ccw = morning side.
  const sunAngleTime = (angle, t, ccw = false) => {
    const decl = sunPosition(jd + t).declination;
    const hourAngle =
      (1 / 15) *
      darccos(
        (-dsin(angle) - dsin(decl) * dsin(latitude)) /
          (dcos(decl) * dcos(latitude))
      );
    return midDay(t) + (ccw ? -hourAngle : hourAngle);
  };

  const asrTime = (t) => {
    const decl = sunPosition(jd + t).declination;
    const angle = -darccot(asrFactor + dtan(Math.abs(latitude - decl)));
    return sunAngleTime(angle, t);
  };

  // Initial estimates (day fractions), refined over two passes.
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
    const minutes =
      Math.round(fixHour(t[name] + tzShift) * 60) + (adjustments[name] || 0);
    result[name] = minutes;
  }
  return result;
}

/** Format minutes-after-midnight as h:mm in 12-hour style ("4:21 PM"). */
export function formatMinutes(totalMinutes, { meridiem = true } = {}) {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return meridiem ? `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}` : `${h12}:${mm}`;
}
