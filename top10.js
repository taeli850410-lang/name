const fs = require("fs");
const trades = JSON.parse(fs.readFileSync("raw_trades.json", "utf8"));
const rents = JSON.parse(fs.readFileSync("raw_rents.json", "utf8"));

const dongMap = {}; // just pass through dong as-is

function inH1(y, mo) { return y === 2026 && mo >= 1 && mo <= 6; }

const h1Trades = trades.filter((t) => inH1(t.y, t.mo) && t.price > 0 && t.area > 0);
const h1Rents = rents.filter((r) => inH1(r.y, r.mo));

function pyeong(area) { return area / 3.3058; }

function fmtDate(t) { return `${String(t.y).slice(2)}.${String(t.mo).padStart(2,"0")}.${String(t.d).padStart(2,"0")}`; }

// Top10 sale by price
const topSale = [...h1Trades].sort((a, b) => b.price - a.price).slice(0, 10);

// Top10 sale by psf (price per pyeong) — exclude micro units under 40㎡ for meaningful comparison
const MIN_AREA = 40;
const topSalePsf = [...h1Trades].filter(t => t.area >= MIN_AREA).map(t => ({...t, psf: t.price / pyeong(t.area)})).sort((a,b) => b.psf - a.psf).slice(0, 10);

// Jeonse (rent===0)
const h1Jeonse = h1Rents.filter(r => r.rent === 0 && r.deposit > 0 && r.area > 0);
const topJeonse = [...h1Jeonse].sort((a,b) => b.deposit - a.deposit).slice(0, 10);
const topJeonsePsf = [...h1Jeonse].filter(r => r.area >= MIN_AREA).map(r => ({...r, psf: r.deposit / pyeong(r.area)})).sort((a,b) => b.psf - a.psf).slice(0, 10);

// Wolse (rent>0)
const h1Wolse = h1Rents.filter(r => r.rent > 0 && r.area > 0);
const topWolse = [...h1Wolse].sort((a,b) => b.rent - a.rent).slice(0, 10);
const topWolsePsf = [...h1Wolse].filter(r => r.area >= MIN_AREA).map(r => ({...r, psf: r.rent / pyeong(r.area)})).sort((a,b) => b.psf - a.psf).slice(0, 10);

function printTrade(list, label) {
  console.log(`\n== ${label} ==`);
  list.forEach((t, i) => {
    console.log(`${i+1}. ${t.apt} (${t.dong}) ${t.area.toFixed(1)}㎡(${pyeong(t.area).toFixed(1)}평) ${t.price.toLocaleString()}만 ${fmtDate(t)}${t.psf ? " psf=" + t.psf.toFixed(0) : ""}`);
  });
}
function printRent(list, label, isWolse) {
  console.log(`\n== ${label} ==`);
  list.forEach((r, i) => {
    console.log(`${i+1}. ${r.apt} (${r.dong}) ${r.area.toFixed(1)}㎡(${pyeong(r.area).toFixed(1)}평) 보증금${r.deposit.toLocaleString()}/월${r.rent} ${fmtDate(r)}${r.psf ? " psf=" + r.psf.toFixed(1) : ""}`);
  });
}

printTrade(topSale, "TOP10 매매");
printTrade(topSalePsf, "TOP10 매매 평당가");
printRent(topJeonse, "TOP10 전세");
printRent(topJeonsePsf, "TOP10 전세 평당가");
printRent(topWolse, "TOP10 월세(월세액 기준)");
printRent(topWolsePsf, "TOP10 월세 평당월세");

console.log("\nH1 counts: trades", h1Trades.length, "jeonse", h1Jeonse.length, "wolse", h1Wolse.length);
