"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, MoreMenu, PageHead, type Tone } from "@/components/ui/Bits";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { MonthCalendar, type CalEvent } from "@/components/dashboard/MonthCalendar";
import { appointments as seed, type Appointment, type AppointmentStatus, type AppointmentType } from "@/data/appointments";
import { customers } from "@/data/customers";
import { properties } from "@/data/properties";
import { formatKoDate, formatTimeKo, relativeDay, TODAY } from "@/lib/format";

const TONE: Record<AppointmentStatus, Tone> = { 예정: "info", 완료: "good", 노쇼: "danger", 취소: "neutral" };

export default function AppointmentsPage() {
  return (
    <Suspense>
      <Appointments />
    </Suspense>
  );
}

function Appointments() {
  const toast = useToast();
  const params = useSearchParams();
  const [list, setList] = useState<Appointment[]>(seed);
  const [view, setView] = useState<"list" | "cal">("list");
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [type, setType] = useState<AppointmentType | "">("");
  const [date, setDate] = useState<string>(params.get("date") ?? "");
  const [newOpen, setNewOpen] = useState(false);
  const [result, setResult] = useState<Appointment | null>(null);

  const filtered = useMemo(() => list.filter((a) => (!status || a.status === status) && (!type || a.type === type) && (!date || a.date === date)).sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)), [list, status, type, date]);
  const upcoming = filtered.filter((a) => a.date >= TODAY && a.status === "예정").sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const past = filtered.filter((a) => !(a.date >= TODAY && a.status === "예정"));
  const events: CalEvent[] = list.map((a) => ({ date: a.date, kind: "appt", title: `${a.customerName} ${a.type}`, sub: formatTimeKo(a.time), href: `/agent/appointments?date=${a.date}` }));
  const hasFilter = status || type || date;

  const setStatusOf = (a: Appointment, s: AppointmentStatus, memo?: string) => {
    setList((xs) => xs.map((x) => (x.id === a.id ? { ...x, status: s, resultMemo: memo ?? x.resultMemo } : x)));
    toast(`${a.customerName} ${a.type} · '${s}' 처리했습니다.`);
  };

  const rows = (items: Appointment[]) =>
    items.map((a) => (
      <tr key={a.id}>
        <td className="nowrap">
          <div className="cell-title num">
            {formatKoDate(a.date)} {formatTimeKo(a.time)}
          </div>
          <div className="cell-sub">{relativeDay(a.date)}</div>
        </td>
        <td>
          <div className="cell-title">{a.customerName}</div>
          {a.customerId && (
            <Link href={`/agent/customers?q=${a.customerName}`} className="cell-sub link">
              고객 보기
            </Link>
          )}
        </td>
        <td>
          <Badge tone="outline">{a.type}</Badge>
        </td>
        <td>
          {a.propertyName && <div>{a.propertyName}</div>}
          <div className={a.propertyName ? "cell-sub" : ""}>{a.place}</div>
        </td>
        <td className="muted">{a.memo || "—"}</td>
        <td>
          <Badge tone={TONE[a.status]} dot>
            {a.status}
          </Badge>
          {a.resultMemo && <div className="cell-sub">{a.resultMemo}</div>}
        </td>
        <td>
          <div className="row-actions">
            {a.status === "예정" && (
              <button type="button" className="btn btn--sm" onClick={() => setResult(a)}>
                결과 처리
              </button>
            )}
            <MoreMenu
              items={[
                { label: "약속 알림톡 보내기", icon: "send", onClick: () => toast({ tone: "info", message: "약속 알림 템플릿이 검수 중입니다. 승인되면 보낼 수 있습니다." }) },
                { label: "일정 변경", icon: "calendar", onClick: () => toast({ tone: "info", message: "일정 변경 (프로토타입)" }) },
                { label: "취소", icon: "x", danger: true, onClick: () => setStatusOf(a, "취소") },
              ]}
            />
          </div>
        </td>
      </tr>
    ));

  return (
    <>
      <PageHead
        title="약속"
        desc="상담·방문·임장 약속을 등록하면 대시보드 캘린더와 구글 캘린더(연동 시)에 반영됩니다. 약속 알림톡 시점은 자동발송 설정에서 정합니다."
        help="약속 알림 = 자동발송 설정 › 약속 알림"
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={16} /> 새 약속
          </button>
        }
      />
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="보기 방식">
          <button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>
            목록
          </button>
          <button type="button" className={view === "cal" ? "is-active" : ""} onClick={() => setView("cal")}>
            캘린더
          </button>
        </div>
        <select className="select" style={{ width: 130 }} aria-label="상태" value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus | "")}>
          <option value="">상태 전체</option>
          {(["예정", "완료", "노쇼", "취소"] as const).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="select" style={{ width: 130 }} aria-label="유형" value={type} onChange={(e) => setType(e.target.value as AppointmentType | "")}>
          <option value="">유형 전체</option>
          {(["상담", "방문", "임장", "기타"] as const).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input type="date" className="input" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
        {hasFilter && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setStatus(""); setType(""); setDate(""); }}>
            <Icon name="x" size={14} /> 필터 초기화
          </button>
        )}
        <span className="spacer" />
        <span className="count">
          예정 <b>{upcoming.length}</b> · 지난 {past.length}
        </span>
      </div>

      {view === "cal" ? (
        <div className="split">
          <div className="card">
            <MonthCalendar events={events} initialSelected={date || TODAY} />
          </div>
          <div className="card">
            <div className="card__head">
              <h2>다가오는 약속</h2>
            </div>
            <div className="list">
              {upcoming.slice(0, 8).map((a) => (
                <div key={a.id} className="list__item">
                  <span className="when">
                    <b>{a.date.slice(5)}</b>
                    {formatTimeKo(a.time)}
                  </span>
                  <span className="what">
                    <div className="t">
                      {a.customerName} {a.type}
                    </div>
                    <div className="s">{a.propertyName ?? a.place}</div>
                  </span>
                </div>
              ))}
              {upcoming.length === 0 && <div className="list__item muted">예정된 약속이 없습니다.</div>}
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="calendar"
            title={hasFilter ? "조건에 맞는 약속이 없습니다" : "등록된 약속이 없습니다"}
            desc={hasFilter ? "필터를 바꾸거나 새 약속을 등록해 보세요." : "고객 상담·방문·임장을 등록하면 캘린더에 표시되고, 설정한 시점에 약속 알림톡이 나갑니다."}
            actions={
              <>
                <button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>
                  첫 약속 등록
                </button>
                <Link href="/agent/alimtalk/auto" className="btn">
                  약속 알림 시점 설정 ›
                </Link>
              </>
            }
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>고객</th>
                  <th>유형</th>
                  <th>물건 · 장소</th>
                  <th>사전 메모</th>
                  <th>상태</th>
                  <th className="th-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length > 0 && (
                  <tr>
                    <td colSpan={7} className="section-label" style={{ padding: "8px 12px", margin: 0 }}>
                      예정 {upcoming.length}
                    </td>
                  </tr>
                )}
                {rows(upcoming)}
                {past.length > 0 && (
                  <tr>
                    <td colSpan={7} className="section-label" style={{ padding: "8px 12px", margin: 0 }}>
                      지난 약속 {past.length}
                    </td>
                  </tr>
                )}
                {rows(past)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewAppointmentModal open={newOpen} onClose={() => setNewOpen(false)} onSave={(a) => { setList((xs) => [a, ...xs]); setNewOpen(false); toast(`${a.customerName} ${a.type} 약속을 등록했습니다.`); }} />

      <Modal
        open={!!result}
        onClose={() => setResult(null)}
        title={result ? `${result.customerName} ${result.type} · 결과 처리` : ""}
        footer={
          result && (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setResult(null)}>닫기</button>
              <button type="button" className="btn" onClick={() => { setStatusOf(result, "노쇼", "연락 없이 불참"); setResult(null); }}>노쇼(불참)</button>
              <button type="button" className="btn btn--primary" onClick={() => { setStatusOf(result, "완료"); setResult(null); }}>완료</button>
            </>
          )
        }
      >
        {result && (
          <>
            <p>
              {formatKoDate(result.date, true)} {formatTimeKo(result.time)} · {result.propertyName ?? result.place}
            </p>
            <div className="field mt-12">
              <label className="label" htmlFor="res-memo">결과 메모</label>
              <textarea id="res-memo" className="textarea" placeholder="상담 내용, 다음 행동" />
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function NewAppointmentModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (a: Appointment) => void }) {
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState<AppointmentType>("상담");
  const [date, setDate] = useState(TODAY);
  const [time, setTime] = useState("10:00");
  const [propertyId, setPropertyId] = useState("");
  const [place, setPlace] = useState("사무실");
  const [memo, setMemo] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return setErr("고객을 선택해 주세요.");
    setErr("");
    onSave({ id: `a${Date.now()}`, date, time, customerId, customerName: c.name, type, propertyName: properties.find((p) => p.id === propertyId)?.name, place, memo, status: "예정" });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 약속"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn btn--primary" onClick={submit}>등록</button>
        </>
      }
    >
      <div className="form">
        <div className="field">
          <label className="label" htmlFor="na-cust">고객 <span className="req">*</span></label>
          <select id="na-cust" className={`select${err ? " is-invalid" : ""}`} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">선택</option>
            {customers.slice(0, 40).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {err && <div className="error">{err}</div>}
        </div>
        <div className="field">
          <span className="label">유형</span>
          <div className="seg">
            {(["상담", "방문", "임장", "기타"] as const).map((t) => (
              <button key={t} type="button" className={type === t ? "is-active" : ""} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="form-grid-2">
          <div className="field">
            <label className="label" htmlFor="na-date">날짜</label>
            <input id="na-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="na-time">시간</label>
            <input id="na-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        {type === "임장" && (
          <div className="field">
            <label className="label" htmlFor="na-prop">물건 <span className="opt">선택</span></label>
            <select id="na-prop" className="select" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); const p = properties.find((x) => x.id === e.target.value); if (p) setPlace(`현장 (${p.address.split(" ").slice(0, 3).join(" ")})`); }}>
              <option value="">선택</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="na-place">장소</label>
          <input id="na-place" className="input" value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="na-memo">사전 메모</label>
          <textarea id="na-memo" className="textarea" style={{ minHeight: 72 }} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="준비물, 상담 주제" />
        </div>
      </div>
    </Modal>
  );
}
