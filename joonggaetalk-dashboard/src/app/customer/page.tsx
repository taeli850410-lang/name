"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Bits";
import { Sparkline } from "@/components/charts/Charts";
import { useToast } from "@/components/ui/Toast";
import { portal } from "@/data/portal";
import { dday, diffDays, formatKoDate, formatManwon, formatTimeKo, TODAY } from "@/lib/format";

/** 고객용 홈 — 다음 일정과 D-day가 먼저, 그다음 안심 알림·약속·시세·담당 중개사. */
export default function CustomerHome() {
  const toast = useToast();
  const [apptState, setApptState] = useState<"none" | "confirmed" | "change">("none");
  const next = portal.deal.steps.find((s) => !s.done)!;
  const days = diffDays(TODAY, next.date);
  const s = portal.market.series;

  return (
    <CustomerShell title={`${portal.customer.name} 고객님`}>
      <div className="pcard" style={{ borderColor: "#b9c9f5", background: "linear-gradient(180deg,#fff,#f3f6ff)" }}>
        <div className="muted small">다음 일정 · {portal.deal.name}</div>
        <div className="row row--between mt-8">
          <div>
            <div className="hero-num">{next.label}<small>{formatKoDate(next.date)}</small></div>
            <div className="muted small mt-8">{next.desc}</div>
          </div>
          <span className={`dday${days <= 7 ? " dday--soon" : ""}`} style={{ fontSize: 16, height: 32, padding: "0 12px" }}>{dday(next.date)}</span>
        </div>
        <Link href="/customer/deal" className="btn btn--primary btn--block mt-16">계약 일정 전체 보기</Link>
      </div>

      <div className="pcard">
        <h2>등기부 안심 알림 <Badge tone="good" dot>감시 중</Badge></h2>
        <div className="small muted">{portal.registry.address}</div>
        <dl className="kv mt-12" style={{ gridTemplateColumns: "90px 1fr" }}>
          <dt>시작</dt><dd>{formatKoDate(portal.registry.since, true)}</dd>
          <dt>마지막 확인</dt><dd>{portal.registry.lastChecked.slice(5)} · 변동 없음</dd>
          <dt>확인 주기</dt><dd>매일 오전 10시 · 오후 5시</dd>
        </dl>
        <p className="help mt-12">근저당 설정·소유권 이전 등 등기부 변동이 생기면 카카오톡 알림톡으로 바로 알려 드립니다. 중개사무소가 무료로 제공하는 서비스입니다.</p>
      </div>

      <div className="pcard">
        <h2>약속</h2>
        <div className="row row--between">
          <div>
            <div className="strong">{formatKoDate(portal.appointment.date)} {formatTimeKo(portal.appointment.time)} · {portal.appointment.type}</div>
            <div className="muted small">{portal.appointment.place} · {portal.appointment.memo}</div>
          </div>
          {apptState === "confirmed" && <Badge tone="good" dot>참석 확인</Badge>}
          {apptState === "change" && <Badge tone="warn" dot>변경 요청됨</Badge>}
        </div>
        {apptState === "none" && (
          <div className="row mt-12" style={{ gap: 8 }}>
            <button type="button" className="btn btn--primary grow" onClick={() => { setApptState("confirmed"); toast("참석을 확인했습니다. 중개사에게 전달됩니다."); }}><Icon name="check" size={15} /> 참석할게요</button>
            <button type="button" className="btn grow" onClick={() => { setApptState("change"); toast({ tone: "info", message: "변경 요청을 보냈습니다. 중개사가 연락드립니다." }); }}>일정 변경 요청</button>
          </div>
        )}
      </div>

      <Link href="/customer/market" className="pcard" style={{ display: "block" }}>
        <h2>관심지역 시세 <span className="link">자세히 ›</span></h2>
        <div className="row row--between">
          <div>
            <div className="muted small">{portal.market.complex}</div>
            <div className="strong" style={{ fontSize: 20 }}>{formatManwon(s[s.length - 1].v)}</div>
            <div className="small" style={{ color: "var(--good)" }}>전월 대비 +{formatManwon(s[s.length - 1].v - s[s.length - 2].v)}</div>
          </div>
          <Sparkline values={s.map((x) => x.v)} width={120} height={40} />
        </div>
      </Link>

      <div className="pcard">
        <h2>담당 중개사</h2>
        <div className="agent-card">
          <div className="ph" aria-hidden>{portal.agent.name[0]}</div>
          <div>
            <div className="n">{portal.agent.name} 대표</div>
            <div className="o">{portal.agent.office}</div>
            <div className="o">{portal.agent.hours}</div>
          </div>
        </div>
        <div className="pactions">
          <a href={`tel:${portal.agent.phone.replace(/-/g, "")}`}><Icon name="phone" size={18} /> 전화</a>
          <a href={portal.agent.mapUrl} target="_blank" rel="noreferrer"><Icon name="mapPin" size={18} /> 오시는길</a>
          <a href={portal.agent.kakaoUrl} target="_blank" rel="noreferrer"><Icon name="chat" size={18} /> 카톡 문의</a>
        </div>
        <div className="help mt-12">{portal.agent.address}</div>
      </div>

      <p className="help center">이 화면은 {portal.agent.office}가 보낸 알림톡 링크로 열립니다. 알림 수신은 <Link href="/customer/settings" className="link">알림 설정</Link>에서 바꿀 수 있습니다.</p>
    </CustomerShell>
  );
}
