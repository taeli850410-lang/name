"use client";

import { useState } from "react";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { portal } from "@/data/portal";
import { dday, formatKoDate, formatManwon, TODAY } from "@/lib/format";

export default function CustomerDeal() {
  const toast = useToast();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const nextKey = portal.deal.steps.find((s) => !s.done)?.key;
  return (
    <CustomerShell title="내 계약">
      <div className="pcard">
        <div className="muted small">{portal.deal.method} 계약</div>
        <div className="strong" style={{ fontSize: 17 }}>{portal.deal.property}</div>
        <div className="muted small">{portal.deal.address}</div>
        <dl className="kv mt-12" style={{ gridTemplateColumns: "90px 1fr" }}>
          <dt>보증금</dt><dd className="strong">{formatManwon(portal.deal.deposit)}</dd>
          <dt>중개사무소</dt><dd>{portal.agent.office}</dd>
        </dl>
      </div>

      <div className="pcard">
        <h2>일정</h2>
        <div className="timeline">
          {portal.deal.steps.map((s) => (
            <div key={s.key} className={`timeline__item${s.done ? " is-done" : ""}${s.key === nextKey ? " is-next" : ""}`}>
              <div className="t">
                {s.label}
                <span className={`dday${s.done ? " dday--done" : s.date < "2026-10-15" && s.date >= TODAY ? " dday--soon" : ""}`}>{s.done ? "완료" : dday(s.date)}</span>
              </div>
              <div className="s">{formatKoDate(s.date, true)} · {s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pcard">
        <h2>잔금일 준비물 <Badge tone="outline">{checked.size}/{portal.deal.documents.length}</Badge></h2>
        <div className="stack">
          {portal.deal.documents.map((d) => (
            <label key={d} className="check" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <input type="checkbox" checked={checked.has(d)} onChange={(e) => { const n = new Set(checked); if (e.target.checked) n.add(d); else n.delete(d); setChecked(n); }} />
              <span style={{ textDecoration: checked.has(d) ? "line-through" : undefined, color: checked.has(d) ? "var(--faint)" : undefined }}>{d}</span>
            </label>
          ))}
        </div>
        <p className="help mt-12">잔금 당일 확정일자·전입신고를 중개사가 함께 진행합니다. 궁금한 점은 카톡으로 문의해 주세요.</p>
      </div>

      <div className="pcard">
        <h2>서류</h2>
        <div className="stack">
          {["계약서 사본 (PDF)", "중개대상물 확인·설명서", "공제증서"].map((f) => (
            <button key={f} type="button" className="btn" style={{ justifyContent: "space-between" }} onClick={() => toast({ tone: "info", message: `${f} 열기 (프로토타입)` })}>
              {f} <Icon name="download" size={15} />
            </button>
          ))}
        </div>
      </div>
    </CustomerShell>
  );
}
