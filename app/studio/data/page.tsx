import { BROKER_LINK_GROUPS, CUSTOMER_LINK_GROUPS, link } from "@/lib/links";
import { computeTiles } from "@/lib/market";
import { fmtDate, fmtManwon, monthLabel } from "@/lib/format";
import { getMarket, getMeta } from "@/lib/repo";
import RefreshMarketButton from "./RefreshMarketButton";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const [market, meta] = await Promise.all([getMarket(), getMeta()]);
  const { tiles, history } = computeTiles(market, "move");
  const rows = [...market.monthly].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
  const vals = history.map((h) => h.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, max);
  const span = max - min || 1;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>우리 동네 숫자</h1>
          <p>
            {market.area} 실거래 집계와 한국은행 기준금리입니다. EDM의 '우리 동네 숫자' 섹션이 이 값을 씁니다. 집계 기준 {fmtDate(market.generatedAt)}
            {meta.lastMarketAt ? ` · 마지막 갱신 ${fmtDate(meta.lastMarketAt)}` : ""}
          </p>
        </div>
        <RefreshMarketButton />
      </div>
      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.key}>
            <div className="lbl">
              {t.label}
              {t.provisional ? " (잠정)" : ""}
            </div>
            <div className="val">{t.value}</div>
            {t.delta && <div className={`delta ${t.deltaDir}`}>{t.delta}</div>}
            <div className="src">
              {t.asOf} ·{" "}
              <a href={t.sourceUrl} target="_blank" rel="noreferrer noopener">
                {t.source}
              </a>
            </div>
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>매매 중위가 추이</h3>
          <div className="bars">
            {history.map((h, i) => (
              <div className="col" key={h.label}>
                <span className="v">{fmtManwon(h.value)}</span>
                <div className={`bar${i === history.length - 1 ? " last" : ""}`} style={{ height: `${20 + Math.round(((h.value - min) / span) * 70)}px` }} />
                <span className="x">{h.label}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            {market.source}. 신고 기한 30일이라 최근 두 달은 잠정치입니다. 기준금리 출처: {market.rate.note ?? "한국은행"}.
          </p>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>계약월</th>
                <th>매매 중위가</th>
                <th>건수</th>
                <th>전세 중위가</th>
                <th>건수</th>
                <th>월세 평균</th>
                <th>건수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="mono">{monthLabel(r.month)}</td>
                  <td>{fmtManwon(r.sale)}</td>
                  <td>{r.saleN}</td>
                  <td>{fmtManwon(r.jeonse)}</td>
                  <td>{r.jeonseN}</td>
                  <td>{r.wolse == null ? "-" : `${Math.round(r.wolse)}만원`}</td>
                  <td>{r.wolseN}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 style={{ margin: "30px 0 10px" }}>
        <span className="chip chip-c">고객용</span> 바로가기 (필요한 순간별)
      </h2>
      <div className="link-groups">
        {CUSTOMER_LINK_GROUPS.map((g) => (
          <div className="card" key={g.title}>
            <h3>{g.title}</h3>
            <ul>
              {g.ids.map((id) => {
                const l = link(id);
                return (
                  <li key={id}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener">
                      {l.label}
                    </a>
                    <span className="desc">{l.desc}</span>
                    {!l.verified && <span className="verify">○ 접속 미검증</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <h2 style={{ margin: "30px 0 10px" }}>
        <span className="chip chip-b">중개사용</span> 바로가기 (업무별)
      </h2>
      <div className="link-groups">
        {BROKER_LINK_GROUPS.map((g) => (
          <div className="card" key={g.title}>
            <h3>{g.title}</h3>
            <ul>
              {g.ids.map((id) => {
                const l = link(id);
                return (
                  <li key={id}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener">
                      {l.label}
                    </a>
                    <span className="desc">{l.desc}</span>
                    {!l.verified && <span className="verify">○ 접속 미검증</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
