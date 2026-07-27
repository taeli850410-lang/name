const fs = require("fs");

const trades = JSON.parse(fs.readFileSync("raw_trades.json", "utf8"));
const rents = JSON.parse(fs.readFileSync("raw_rents.json", "utf8"));

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function toDate(y, mo, d) { return new Date(Date.UTC(y, mo - 1, d)); }

// ISO week Monday date string (YYYY-MM-DD) as bucket key
function isoWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // 0=Mon
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function monthKey(y, mo) { return String(y) + "-" + String(mo).padStart(2, "0"); }

// ---- weekly buckets ----
const weekSale = {};
const weekJeonse = {};
const weekWolse = {};

trades.forEach((t) => {
  if (!t.y || !t.mo || !t.d || !t.price) return;
  const wk = isoWeekStart(toDate(t.y, t.mo, t.d));
  (weekSale[wk] = weekSale[wk] || []).push(t.price);
});

rents.forEach((r) => {
  if (!r.y || !r.mo || !r.d) return;
  const wk = isoWeekStart(toDate(r.y, r.mo, r.d));
  if (r.rent === 0) {
    (weekJeonse[wk] = weekJeonse[wk] || []).push(r.deposit);
  } else if (r.rent > 0) {
    (weekWolse[wk] = weekWolse[wk] || []).push(r.rent);
  }
});

// ---- monthly buckets ----
const monSale = {};
const monJeonse = {};
const monWolse = {};

trades.forEach((t) => {
  if (!t.y || !t.mo || !t.price) return;
  const mk = monthKey(t.y, t.mo);
  (monSale[mk] = monSale[mk] || []).push(t.price);
});
rents.forEach((r) => {
  if (!r.y || !r.mo) return;
  const mk = monthKey(r.y, r.mo);
  if (r.rent === 0) {
    (monJeonse[mk] = monJeonse[mk] || []).push(r.deposit);
  } else if (r.rent > 0) {
    (monWolse[mk] = monWolse[mk] || []).push(r.rent);
  }
});

function buildWeekly() {
  const keys = Array.from(new Set([...Object.keys(weekSale), ...Object.keys(weekJeonse), ...Object.keys(weekWolse)])).sort();
  return keys.map((wk) => ({
    week: wk,
    sale: median(weekSale[wk] || []),
    saleN: (weekSale[wk] || []).length,
    jeonse: median(weekJeonse[wk] || []),
    jeonseN: (weekJeonse[wk] || []).length,
    wolse: mean(weekWolse[wk] || []),
    wolseN: (weekWolse[wk] || []).length,
  }));
}

function buildMonthly() {
  const keys = Array.from(new Set([...Object.keys(monSale), ...Object.keys(monJeonse), ...Object.keys(monWolse)])).sort();
  return keys.map((mk) => ({
    month: mk,
    sale: median(monSale[mk] || []),
    saleN: (monSale[mk] || []).length,
    jeonse: median(monJeonse[mk] || []),
    jeonseN: (monJeonse[mk] || []).length,
    wolse: mean(monWolse[mk] || []),
    wolseN: (monWolse[mk] || []).length,
  }));
}

const weekly = buildWeekly();
const monthly = buildMonthly();

fs.writeFileSync("weekly.json", JSON.stringify(weekly));
fs.writeFileSync("monthly.json", JSON.stringify(monthly));

console.error("weekly buckets:", weekly.length, "monthly buckets:", monthly.length);
console.error("sample weekly[0..2]:", JSON.stringify(weekly.slice(0, 3)));
console.error("sample monthly:", JSON.stringify(monthly));
console.error("date range weekly:", weekly[0].week, "to", weekly[weekly.length - 1].week);
