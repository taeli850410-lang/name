"use client";

import { useState } from "react";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { portal } from "@/data/portal";
import { attachmentsOf } from "@/data/files";
import { formatBytes } from "@/lib/storage";
import { dday, formatKoDate, formatManwon, TODAY } from "@/lib/format";

export default function CustomerDeal() {
  const toast = useToast();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const nextKey = portal.deal.steps.find((s) => !s.done)?.key;
  // 중개사가 "고객에게 보이기"를 켠 서류만 내려온다. 신분증 같은 건 여기 오지 않는다.
  const docs = attachmentsOf("deals", portal.deal.id).filter((f) => f.sharedWithCustomer);
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
        {docs.length === 0 ? (
          <p className="muted small">아직 공유된 서류가 없습니다. 계약이 끝나면 담당 중개사가 올려 드립니다.</p>
        ) : (
          <div className="stack">
            {docs.map((f) => (
              <button
                key={f.id}
                type="button"
                className="btn"
                style={{ justifyContent: "space-between" }}
                onClick={() => toast({ tone: "info", message: `${f.name} 열기 — 저장소가 설정되면 2분간만 유효한 주소로 내려받습니다. (프로토타입)` })}
              >
                <span className="stack" style={{ gap: 2, alignItems: "flex-start" }}>
                  <span>{f.name}</span>
                  <span className="muted small">{f.kind} · {formatBytes(f.bytes)}</span>
                </span>
                <Icon name="download" size={15} />
              </button>
            ))}
          </div>
        )}
        <p className="help mt-12">담당 중개사가 공유한 서류만 보입니다. 링크는 이 화면을 열 때마다 새로 만들어지고 2분 뒤 만료됩니다.</p>
      </div>
    </CustomerShell>
  );
}
