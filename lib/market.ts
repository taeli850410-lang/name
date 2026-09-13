import { XMLParser } from "fast-xml-parser";
import { fmtManwon, fmtPct, monthLabel } from "./format";
import type { HistoryPoint, MarketDoc, MarketTile, MonthRow, Office, Segment } from "./types";

/** "우리 동네 숫자" — 설정한 지역의 실거래 집계와 기준금리 타일. 지역은 MarketDoc.areaCodes 가 정합니다. */

const RT_URL = "https://rt.molit.go.kr/";

function monthStart(month: string): number {
  return new Date(`${month}-01T00:00:00+09:00`).getTime();
}

function isProvisional(month: string, generatedAt: string): boolean {
  const gen = new Date(generatedAt).getTime();
  return gen - monthStart(month) < 62 * 24 * 3600 * 1000;
}

type Dir = "up" | "down" | "flat";

function pctDelta(cur: number | null, prev: number | null): { delta: string; dir: Dir } {
  if (cur == null || prev == null || prev === 0) return { delta: "", dir: "flat" };
  const d = ((cur - prev) / prev) * 100;
  if (Math.abs(d) < 0.05) return { delta: "보합", dir: "flat" };
  return { delta: `${fmtPct(d)} 전월 대비`, dir: d > 0 ? "up" : "down" };
}

/**
 * 설정의 법정동코드를 시장 문서에 적용합니다. 지역이 바뀌면 이전 지역의 월별 집계를 비웁니다.
 * 서로 다른 지역 수치가 한 표에 섞이지 않게 하기 위해서입니다.
 */
export function applyArea(doc: MarketDoc, office: Office): MarketDoc {
  const codes = (office.lawdCodes ?? []).filter(Boolean);
  // 지역을 비우면(전국구) 이전 지역 수치가 '우리 동네'로 남아 있으면 안 됩니다
  if (codes.length === 0) {
    if (doc.areaCodes.length === 0) return doc;
    return { ...doc, areaCodes: [], area: office.areaLabel?.trim() || "전국", monthly: [] };
  }
  const same = codes.length === doc.areaCodes.length && codes.every((c, i) => c === doc.areaCodes[i]);
  if (same) return doc;
  return { ...doc, areaCodes: codes, area: office.areaLabel?.trim() || codes.join("·"), monthly: [] };
}

function rateTile(market: MarketDoc): MarketTile {
  return {
    key: "rate",
    label: "한국은행 기준금리",
    value: `${market.rate.value.toFixed(2)}%`,
    delta: `기준일 ${market.rate.asOf}`,
    deltaDir: "flat",
    asOf: market.rate.asOf,
    source: "한국은행",
    sourceUrl: market.rate.sourceUrl,
    provisional: false,
  };
}

/** 시도 비교 표 한 줄 — 최신 값과 전월 대비. 값이 없으면 그 줄은 빼고 냅니다 */
export function regionRows(market: MarketDoc): { name: string; month: string; sale: string; saleDelta: string; saleDir: Dir; jeonse: string; jeonseDelta: string; jeonseDir: Dir }[] {
  return (market.regions ?? [])
    .filter((r) => r.sale != null || r.jeonse != null)
    .map((r) => {
      const s = pctDelta(r.sale, r.salePrev ?? null);
      const j = pctDelta(r.jeonse, r.jeonsePrev ?? null);
      // 단위를 값에 붙입니다. 줄만 따로 읽으면 1,614만원이 집값으로 보입니다
      const won = (v: number | null) => (v == null ? "산출 불가" : `${v.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만원/㎡`);
      return {
        name: r.name,
        month: monthLabel(r.month),
        sale: won(r.sale),
        saleDelta: s.delta,
        saleDir: s.dir,
        jeonse: won(r.jeonse),
        jeonseDelta: j.delta,
        jeonseDir: j.dir,
      };
    });
}

export function computeTiles(market: MarketDoc, segment: Segment): { tiles: MarketTile[]; history: HistoryPoint[]; historyLabel: string } {
  const rows = [...market.monthly].sort((a, b) => a.month.localeCompare(b.month));
  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  // 실거래 집계가 아직 없으면 기준금리 타일만 보여 줍니다
  if (!latest) return { tiles: [rateTile(market)], history: [], historyLabel: "" };
  const asOf = `${latest.month} 계약분`;
  const prov = isProvisional(latest.month, market.generatedAt);
  const src = "국토교통부 실거래가 공개시스템";

  const sale = pctDelta(latest.sale, prev?.sale ?? null);
  const jeonse = pctDelta(latest.jeonse, prev?.jeonse ?? null);
  const wolse = pctDelta(latest.wolse, prev?.wolse ?? null);
  const n = pctDelta(latest.saleN, prev?.saleN ?? null);

  const all: Record<string, MarketTile> = {
    sale: { key: "sale", label: "아파트 매매 중위가", value: fmtManwon(latest.sale), delta: sale.delta, deltaDir: sale.dir, asOf, source: src, sourceUrl: RT_URL, provisional: prov },
    jeonse: { key: "jeonse", label: "아파트 전세 중위가", value: fmtManwon(latest.jeonse), delta: jeonse.delta, deltaDir: jeonse.dir, asOf, source: src, sourceUrl: RT_URL, provisional: prov },
    wolse: { key: "wolse", label: "아파트 월세 평균", value: latest.wolse == null ? "산출 불가" : `${Math.round(latest.wolse)}만원`, delta: wolse.delta, deltaDir: wolse.dir, asOf, source: src, sourceUrl: RT_URL, provisional: prov },
    count: { key: "count", label: "매매 신고 건수", value: `${latest.saleN.toLocaleString("ko-KR")}건`, delta: n.delta, deltaDir: n.dir, asOf, source: src, sourceUrl: RT_URL, provisional: prov },
    rate: rateTile(market),
  };

  const order: Record<Segment, string[]> = {
    first: ["jeonse", "rate", "wolse", "sale"],
    move: ["sale", "count", "rate", "jeonse"],
    asset: ["jeonse", "wolse", "sale", "rate"],
  };
  const tiles = order[segment].map((k) => all[k]);
  const history = rows
    .slice(-6)
    .filter((r) => r.sale != null)
    .map((r) => ({ label: monthLabel(r.month), value: r.sale as number }));
  return { tiles, history, historyLabel: `${market.area} 매매 중위가 (만원)` };
}

/* ───────── 실거래가 API 갱신 (DATA_GO_KR_KEY 가 있을 때) ───────── */

interface RawTrade {
  price: number;
  y: number;
  mo: number;
}
interface RawRent {
  deposit: number;
  rent: number;
  y: number;
  mo: number;
}

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

function items(xml: string): Record<string, unknown>[] {
  const parsed = parser.parse(xml) as { response?: { body?: { items?: { item?: unknown } } } };
  const it = parsed?.response?.body?.items?.item;
  if (!it) return [];
  return (Array.isArray(it) ? it : [it]) as Record<string, unknown>[];
}

const num = (v: unknown) => parseInt(String(v ?? "0").replace(/,/g, ""), 10) || 0;

async function fetchXml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 landlanguage-brief" }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchTrades(key: string, lawd: string, ym: string): Promise<RawTrade[]> {
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=2000&pageNo=1`;
  return items(await fetchXml(url)).map((it) => ({ price: num(it.dealAmount), y: num(it.dealYear), mo: num(it.dealMonth) }));
}

async function fetchRents(key: string, lawd: string, ym: string): Promise<RawRent[]> {
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=2000&pageNo=1`;
  return items(await fetchXml(url)).map((it) => ({ deposit: num(it.deposit), rent: num(it.monthlyRent), y: num(it.dealYear), mo: num(it.dealMonth) }));
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export async function refreshMarket(current: MarketDoc): Promise<{ doc: MarketDoc; notes: string[] }> {
  const notes: string[] = [];
  const doc: MarketDoc = { ...current, monthly: [...current.monthly], rate: { ...current.rate } };
  const key = process.env.DATA_GO_KR_KEY;

  const areaCodes = (doc.areaCodes ?? []).filter(Boolean);
  if (key && areaCodes.length === 0) notes.push("설정에 법정동코드가 없어 실거래 집계를 건너뜁니다. 설정 → 지역에서 5자리 코드를 넣으세요.");
  if (key && areaCodes.length > 0) {
    const months = lastMonths(3);
    for (const ym of months) {
      const monthKey = `${ym.slice(0, 4)}-${ym.slice(4)}`;
      try {
        const trades: RawTrade[] = [];
        const rents: RawRent[] = [];
        for (const lawd of areaCodes) {
          trades.push(...(await fetchTrades(key, lawd, ym)));
          rents.push(...(await fetchRents(key, lawd, ym)));
        }
        const row: MonthRow = {
          month: monthKey,
          sale: median(trades.filter((t) => t.price > 0).map((t) => t.price)),
          saleN: trades.length,
          jeonse: median(rents.filter((r) => r.rent === 0 && r.deposit > 0).map((r) => r.deposit)),
          jeonseN: rents.filter((r) => r.rent === 0).length,
          wolse: mean(rents.filter((r) => r.rent > 0).map((r) => r.rent)),
          wolseN: rents.filter((r) => r.rent > 0).length,
        };
        if (row.saleN === 0 && row.jeonseN === 0 && row.wolseN === 0) {
          notes.push(`${monthKey}: 수집 결과 0건 (API 응답 확인 필요)`);
          continue;
        }
        const idx = doc.monthly.findIndex((r) => r.month === monthKey);
        if (idx >= 0) doc.monthly[idx] = row;
        else doc.monthly.push(row);
        notes.push(`${monthKey}: 매매 ${row.saleN}건, 전세 ${row.jeonseN}건, 월세 ${row.wolseN}건 갱신`);
      } catch (e) {
        notes.push(`${monthKey}: 실거래 API 실패 — ${(e as Error).message}`);
      }
    }
    doc.monthly.sort((a, b) => a.month.localeCompare(b.month));
    doc.generatedAt = new Date().toISOString();
  } else if (!key) {
    notes.push("DATA_GO_KR_KEY 가 없어 실거래 집계는 저장된 값을 유지합니다.");
  }

  const ecos = process.env.ECOS_API_KEY;
  if (ecos) {
    try {
      const now = new Date();
      const end = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const startD = new Date(now.getTime() - 120 * 24 * 3600 * 1000);
      const start = `${startD.getFullYear()}${String(startD.getMonth() + 1).padStart(2, "0")}${String(startD.getDate()).padStart(2, "0")}`;
      const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ecos}/json/kr/1/200/722Y001/D/${start}/${end}/0101000`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as { StatisticSearch?: { row?: { TIME: string; DATA_VALUE: string }[] } };
      const rows = json?.StatisticSearch?.row ?? [];
      const last = rows[rows.length - 1];
      if (last) {
        const v = parseFloat(last.DATA_VALUE);
        if (!Number.isNaN(v)) {
          doc.rate = { ...doc.rate, value: v, asOf: `${last.TIME.slice(0, 4)}-${last.TIME.slice(4, 6)}-${last.TIME.slice(6, 8)}`, note: "한국은행 ECOS API 자동 갱신" };
          notes.push(`기준금리 ${v}% (기준일 ${doc.rate.asOf}) 갱신`);
        }
      } else {
        notes.push("ECOS 응답에 기준금리 행이 없습니다.");
      }
    } catch (e) {
      notes.push(`ECOS API 실패 — ${(e as Error).message}`);
    }
  } else {
    notes.push("ECOS_API_KEY 가 없어 기준금리는 저장된 값을 유지합니다.");
  }
  return { doc, notes };
}
