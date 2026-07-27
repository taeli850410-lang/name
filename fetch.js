const https = require("https");
const fs = require("fs");

const SERVICE_KEY = "b36834ac9c9b585bd38ba88fc61aded8ffb3584a75596d427b6cce130a07a3bf";
const DISTRICTS = ["41171", "41173"]; // 만안구, 동안구

function ymList(startY, startM, endY, endM) {
  const out = [];
  let y = startY, m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(String(y) + String(m).padStart(2, "0"));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

const MONTHS = ymList(2025, 1, 2026, 7);

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function parseItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml))) {
    const body = m[1];
    const obj = {};
    const fieldRe = /<(\w+)>([^<]*)<\/\1>/g;
    let f;
    while ((f = fieldRe.exec(body))) {
      obj[f[1]] = f[2].trim();
    }
    items.push(obj);
  }
  return items;
}

async function fetchTrade(lawd, ym) {
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${SERVICE_KEY}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=2000&pageNo=1`;
  const xml = await get(url);
  return parseItems(xml).map((it) => ({
    apt: it.aptNm,
    dong: it.umdNm,
    area: parseFloat(it.excluUseAr),
    price: parseInt((it.dealAmount || "0").replace(/,/g, ""), 10),
    y: parseInt(it.dealYear, 10),
    mo: parseInt(it.dealMonth, 10),
    d: parseInt(it.dealDay, 10),
    build: it.buildYear,
  }));
}

async function fetchRent(lawd, ym) {
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent?serviceKey=${SERVICE_KEY}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=2000&pageNo=1`;
  const xml = await get(url);
  return parseItems(xml).map((it) => ({
    apt: it.aptNm,
    dong: it.umdNm,
    area: parseFloat(it.excluUseAr),
    deposit: parseInt((it.deposit || "0").replace(/,/g, ""), 10),
    rent: parseInt((it.monthlyRent || "0").replace(/,/g, ""), 10),
    y: parseInt(it.dealYear, 10),
    mo: parseInt(it.dealMonth, 10),
    d: parseInt(it.dealDay, 10),
  }));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const trades = [];
  const rents = [];
  for (const ym of MONTHS) {
    for (const d of DISTRICTS) {
      try {
        const t = await fetchTrade(d, ym);
        trades.push(...t);
      } catch (e) { console.error("trade fail", ym, d, e.message); }
      await sleep(120);
      try {
        const r = await fetchRent(d, ym);
        rents.push(...r);
      } catch (e) { console.error("rent fail", ym, d, e.message); }
      await sleep(120);
    }
    console.error("done month", ym, "trades so far", trades.length, "rents so far", rents.length);
  }
  fs.writeFileSync("raw_trades.json", JSON.stringify(trades));
  fs.writeFileSync("raw_rents.json", JSON.stringify(rents));
  console.error("TOTAL trades:", trades.length, "rents:", rents.length);
}

main();
