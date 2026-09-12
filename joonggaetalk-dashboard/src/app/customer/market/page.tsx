"use client";

import { useState } from "react";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { Badge, Switch } from "@/components/ui/Bits";
import { LineChart } from "@/components/charts/Charts";
import { useToast } from "@/components/ui/Toast";
import { portal } from "@/data/portal";
import { formatManwon } from "@/lib/format";

export default function CustomerMarket() {
  const toast = useToast();
  const [weekly, setWeekly] = useState(portal.consent.marketInfo);
  const s = portal.market.series;
  const last = s[s.length - 1].v, prev = s[s.length - 2].v, yearAgo = s[0].v;
  return (
    <CustomerShell title="관심지역 시세">
      <div className="pcard">
        <div className="muted small">{portal.market.region}</div>
        <h2 style={{ marginBottom: 4 }}>{portal.market.complex}</h2>
        <div className="row" style={{ gap: 16 }}>
          <div><div className="muted small">이번 달 평균</div><div className="strong" style={{ fontSize: 22 }}>{formatManwon(last)}</div></div>
          <div><div className="muted small">전월 대비</div><div className="strong" style={{ color: "var(--good)" }}>+{formatManwon(last - prev)}</div></div>
          <div><div className="muted small">1년 전 대비</div><div className="strong" style={{ color: "var(--good)" }}>+{((last / yearAgo - 1) * 100).toFixed(1)}%</div></div>
        </div>
        <div className="mt-16">
          <LineChart data={s.map((p) => ({ label: `${Number(p.m.slice(5))}월`, value: p.v, sub: `${p.m.slice(0, 4)}년 ${Number(p.m.slice(5))}월` }))} height={190} format={(v) => (v / 10000).toFixed(1) + "억"} />
        </div>
        <p className="help">최근 12개월 전세 실거래 평균 · 출처: 국토교통부 실거래가 공개시스템 · 신고 기한(30일)에 따라 최근 달은 늦게 반영됩니다.</p>
      </div>

      <div className="pcard">
        <h2>최근 거래</h2>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="table table--dense">
            <thead><tr><th>계약일</th><th>동·층</th><th>면적</th><th className="th-right">금액</th></tr></thead>
            <tbody>
              {portal.market.recent.map((r, i) => (
                <tr key={i}>
                  <td className="num nowrap">{r.date.slice(5)}</td>
                  <td>{r.dong} {r.floor}</td>
                  <td className="num">{r.area}㎡</td>
                  <td className="td-num nowrap"><Badge tone={r.kind === "매매" ? "admin" : "info"}>{r.kind}</Badge> {formatManwon(r.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pcard row row--between">
        <div>
          <div className="strong">매주 시세 알림 받기</div>
          <div className="muted small">매주 월요일 오전 9시 · 이 지역 실거래 요약</div>
        </div>
        <Switch checked={weekly} onChange={(v) => { setWeekly(v); toast(v ? "매주 시세 알림을 받습니다." : "시세 알림을 껐습니다."); }} label={weekly ? "켜짐" : "꺼짐"} />
      </div>
    </CustomerShell>
  );
}
