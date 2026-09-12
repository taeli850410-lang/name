"use client";

import { useState } from "react";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { Switch } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { portal } from "@/data/portal";
import { formatKoDate } from "@/lib/format";

export default function CustomerSettings() {
  const toast = useToast();
  const [c, setC] = useState(portal.consent);
  const set = (k: keyof typeof c, v: boolean, label: string) => { setC({ ...c, [k]: v }); toast(v ? `${label}을 받습니다.` : `${label}을 받지 않습니다.`); };
  return (
    <CustomerShell title="알림 설정">
      <div className="pcard">
        <h2>{portal.customer.name} 고객님 · {portal.customer.phoneMasked}</h2>
        <p className="muted small">{portal.agent.office}에서 보내는 카카오톡 알림톡을 종류별로 켜고 끌 수 있습니다. 동의 일시: {formatKoDate(c.consentedAt, true)}</p>
      </div>
      {[
        { k: "alimtalk" as const, t: "계약 일정 안내", d: "계약일·중도금일·잔금일·입주일·만료일 알림. 끄면 중요한 일정 안내를 받지 못합니다." },
        { k: "registryAlert" as const, t: "등기부 변동 알림", d: "내 임차 물건의 등기부가 바뀌면 바로 알려 드립니다. (무료)" },
        { k: "marketInfo" as const, t: "관심지역 시세 정보", d: "매주 월요일 실거래 요약. 정보성 안내이며 언제든 끌 수 있습니다." },
      ].map((it) => (
        <div key={it.k} className="pcard row row--between" style={{ alignItems: "flex-start" }}>
          <div style={{ maxWidth: "70%" }}>
            <div className="strong">{it.t}</div>
            <div className="muted small">{it.d}</div>
          </div>
          <Switch checked={c[it.k]} onChange={(v) => set(it.k, v, it.t)} label={c[it.k] ? "켜짐" : "꺼짐"} />
        </div>
      ))}
      <div className="pcard">
        <div className="strong">개인정보 안내</div>
        <p className="muted small mt-8">이름·연락처·계약 정보는 {portal.agent.office}가 중개 업무를 위해 보관하며, 계약 종료 후 관련 법령이 정한 기간이 지나면 삭제됩니다. 열람·정정·삭제를 원하시면 중개사무소로 연락해 주세요.</p>
        <button type="button" className="btn btn--danger-ghost btn--sm mt-12" onClick={() => toast({ tone: "info", message: "모든 알림 수신을 거부하려면 중개사무소에서 처리합니다. 요청이 전달되었습니다." })}>모든 알림 수신 거부 요청</button>
      </div>
    </CustomerShell>
  );
}
