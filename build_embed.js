const fs = require("fs");
const weekly = JSON.parse(fs.readFileSync("weekly.json", "utf8"));
const monthly = JSON.parse(fs.readFileSync("monthly.json", "utf8"));

// drop the partial first/last buckets that have very low N (edge weeks from month boundary fetch) - keep as is, just flag
function withIndex(rows, keyField) {
  let baseSale = null, baseJeonse = null, baseWolse = null;
  return rows.map((r) => {
    if (baseSale === null && r.sale != null) baseSale = r.sale;
    if (baseJeonse === null && r.jeonse != null) baseJeonse = r.jeonse;
    if (baseWolse === null && r.wolse != null) baseWolse = r.wolse;
    return {
      k: r[keyField],
      sale: r.sale, saleN: r.saleN, saleIdx: r.sale != null && baseSale ? +(r.sale / baseSale * 100).toFixed(1) : null,
      jeonse: r.jeonse, jeonseN: r.jeonseN, jeonseIdx: r.jeonse != null && baseJeonse ? +(r.jeonse / baseJeonse * 100).toFixed(1) : null,
      wolse: r.wolse != null ? +r.wolse.toFixed(1) : null, wolseN: r.wolseN, wolseIdx: r.wolse != null && baseWolse ? +(r.wolse / baseWolse * 100).toFixed(1) : null,
    };
  });
}

const weeklyOut = withIndex(weekly, "week");
const monthlyOut = withIndex(monthly, "month");

const out = "const WEEKLY_DATA = " + JSON.stringify(weeklyOut) + ";\nconst MONTHLY_DATA = " + JSON.stringify(monthlyOut) + ";\n";
fs.writeFileSync("embed_data.js", out);
console.error("weekly rows:", weeklyOut.length, "monthly rows:", monthlyOut.length);
console.error("weekly range:", weeklyOut[0].k, "-", weeklyOut[weeklyOut.length-1].k);
console.error("monthly range:", monthlyOut[0].k, "-", monthlyOut[monthlyOut.length-1].k);
