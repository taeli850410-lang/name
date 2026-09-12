"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, EmptyState, PageHead, Pager, SearchBox } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { KakaoPreview } from "@/components/ui/KakaoPreview";
import { useToast } from "@/components/ui/Toast";
import { CONTRACT_TYPES, INTEREST_TYPES, customers, type ContractType, type InterestType } from "@/data/customers";
import { templates } from "@/data/templates";
import { sendBatches } from "@/data/sends";
import { systemStatus } from "@/data/system";
import { addDays, formatDateTime, formatPhone, formatWon, TODAY } from "@/lib/format";

const COST = 6.5;

export default function SendPage() {
  return (
    <Suspense>
      <SendNow />
    </Suspense>
  );
}

/**
 * 지금 발송 — 안전한 선택이 주 버튼이다.
 * 5분뒤 발송(주요) · 바로 발송(보조+확인) · 시간 예약. 대상이 0명이면 버튼은 비활성.
 */
function SendNow() {
  const toast = useToast();
  const params = useSearchParams();
  const approved = templates.filter((t) => t.status === "승인");
  const [templateId, setTemplateId] = useState(params.get("template") ?? "");
  const [q, setQ] = useState("");
  const [type, setType] = useState<InterestType | "">("");
  const [ctype, setCtype] = useState<ContractType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [excludeOptOut, setExcludeOptOut] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set((params.get("ids") ?? "").split(",").filter(Boolean)));
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<"delay" | "now" | "schedule" | null>(null);
  const [scheduleAt, setScheduleAt] = useState(`${addDays(TODAY, 1)}T09:00`);
  const [queued, setQueued] = useState<{ id: string; label: string; count: number; at: string; cancelled?: boolean }[]>([]);

  const tpl = approved.find((t) => t.id === templateId);
  const vendorDown = systemStatus.balsongking.status !== "ok";

  const filtered = useMemo(() => {
    const s = q.trim().replace(/-/g, "");
    return customers.filter((c) => {
      if (excludeOptOut && !c.alimtalkConsent) return false;
      if (s && !(c.name.includes(s) || c.phone.includes(s) || c.memo.includes(s))) return false;
      if (type && !c.interestTypes.includes(type)) return false;
      if (ctype && !c.contractTypes.includes(ctype)) return false;
      if (from && c.createdAt < from) return false;
      if (to && c.createdAt > to) return false;
      return true;
    });
  }, [q, type, ctype, from, to, excludeOptOut]);

  const pageItems = filtered.slice((page - 1) * 20, page * 20);
  const selectedList = customers.filter((c) => selected.has(c.id));
  const optOutSelected = selectedList.filter((c) => !c.alimtalkConsent).length;
  const sendCount = selectedList.length - optOutSelected;
  const cost = Math.round(sendCount * COST * 10) / 10;
  const canSend = !!tpl && sendCount > 0;
  const filterChips = [type && `관심유형 ${type}`, ctype && `계약형태 ${ctype}`, from && `등록 ${from}~`, to && `~${to}`, q && `검색 "${q}"`].filter(Boolean) as string[];

  const toggleAllFiltered = (on: boolean) => {
    const next = new Set(selected);
    filtered.forEach((c) => (on ? next.add(c.id) : next.delete(c.id)));
    setSelected(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const queue = (kind: "delay" | "now" | "schedule") => {
    const at = kind === "delay" ? "5분 뒤" : kind === "now" ? "지금" : scheduleAt.replace("T", " ");
    const id = `q${Date.now()}`;
    setQueued((xs) => [{ id, label: tpl!.name, count: sendCount, at }, ...xs]);
    setConfirm(null);
    setSelected(new Set());
    if (kind === "now" && vendorDown) toast({ tone: "danger", message: `${sendCount}건을 요청했지만 대행사 장애로 실패할 수 있습니다. 결과는 발송 내역에서 확인하세요.` });
    else
      toast({
        message: `'${tpl!.name}' ${sendCount}명 · ${at} 발송${kind === "delay" ? " 예약 — 5분 안에 취소할 수 있습니다" : ""}`,
        action: kind !== "now" ? { label: "발송 취소", onClick: () => { setQueued((xs) => xs.map((x) => (x.id === id ? { ...x, cancelled: true } : x))); toast({ tone: "info", message: "예약을 취소했습니다." }); } } : undefined,
      });
  };

  const summary = [
    { k: "템플릿", v: tpl?.name },
    { k: "대상", v: `${sendCount}명${optOutSelected ? ` (수신 거부 ${optOutSelected}명 제외)` : ""}` },
    { k: "예상 비용", v: formatWon(cost) },
    { k: "발송 시점", v: confirm === "delay" ? "5분 뒤 (그 안에 취소 가능)" : confirm === "now" ? "지금 즉시 — 취소할 수 없습니다" : scheduleAt.replace("T", " ") },
  ];

  return (
    <>
      <PageHead title="지금 발송" desc="템플릿을 고르고 대상을 선별해 한 번 보냅니다. 정기 발송 등록 없이 1회성으로 보낼 때 씁니다." />
      {vendorDown && <div className="mb-16"><Banner tone="warn" title="발송 대행사 장애 중 — 지금 보내면 실패합니다" body="'5분뒤 발송'이나 '시간 예약'으로 예약하면 복구 후 자동으로 나갑니다." /></div>}

      <div className="split">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card__head">
              <h2>1. 템플릿</h2>
              <Link href="/agent/alimtalk/templates" className="link small">템플릿 관리 ›</Link>
            </div>
            <div className="card__body">
              <select className="select" aria-label="템플릿" value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ maxWidth: 420 }}>
                <option value="">승인된 템플릿 중 선택</option>
                {approved.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="help mt-8">승인된 템플릿 {approved.length}개만 표시됩니다. 검수 중·반려 템플릿은 보낼 수 없습니다.</div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>2. 대상 고객</h2>
              <span className="muted small">수신 동의 {customers.filter((c) => c.alimtalkConsent).length}명 / 전체 {customers.length}명</span>
            </div>
            <div className="card__body">
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="이름 · 전화 · 메모" />
                <select className="select" style={{ width: 150 }} aria-label="관심유형" value={type} onChange={(e) => { setType(e.target.value as InterestType | ""); setPage(1); }}>
                  <option value="">관심유형 전체</option>
                  {INTEREST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="chips">
                  {CONTRACT_TYPES.map((t) => (
                    <button key={t} type="button" className={`chip${ctype === t ? " is-on" : ""}`} aria-pressed={ctype === t} onClick={() => { setCtype(ctype === t ? "" : t); setPage(1); }}>{t}</button>
                  ))}
                </div>
                <input type="date" className="input" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="등록일 시작" />
                <span className="muted">~</span>
                <input type="date" className="input" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="등록일 끝" />
                <label className="check">
                  <input type="checkbox" checked={excludeOptOut} onChange={(e) => setExcludeOptOut(e.target.checked)} /> 수신 거부 제외
                </label>
              </div>
              <div className="row row--between mb-8">
                <div className="row">
                  {filterChips.length ? filterChips.map((f) => <Badge key={f} tone="info">{f}</Badge>) : <span className="muted small">필터 없음</span>}
                  <span className="count">· 조건에 맞는 <b>{filtered.length}</b>명</span>
                  {filterChips.length > 0 && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setQ(""); setType(""); setCtype(""); setFrom(""); setTo(""); setPage(1); }}>초기화</button>
                  )}
                </div>
                <div className="row">
                  <button type="button" className="btn btn--sm" onClick={() => toggleAllFiltered(true)}>조건 전체 선택 ({filtered.length})</button>
                  <button type="button" className="btn btn--sm" onClick={() => toggleAllFiltered(false)}>선택 해제</button>
                </div>
              </div>
              <div className="table-wrap">
                {filtered.length === 0 ? (
                  <EmptyState icon="users" title="조건에 맞는 고객이 없습니다" desc="관심유형은 고객 등록 화면과 같은 분류를 씁니다." />
                ) : (
                  <table className="table table--dense">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}></th>
                        <th>이름</th>
                        <th>전화번호</th>
                        <th>관심</th>
                        <th>동의</th>
                        <th>등록일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((c) => (
                        <tr key={c.id} className={`is-clickable${selected.has(c.id) ? " is-selected" : ""}`} onClick={() => toggle(c.id)}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`${c.name} 선택`} />
                          </td>
                          <td className="cell-title">{c.autoNamed ? <span className="muted">{c.name}</span> : c.name}</td>
                          <td className="num nowrap">{formatPhone(c.phone)}</td>
                          <td className="muted small">{[...c.interestTypes, ...c.contractTypes].join(" · ") || "—"}</td>
                          <td>{c.alimtalkConsent ? <Badge tone="good" dot>동의</Badge> : <Badge tone="neutral" dot>거부</Badge>}</td>
                          <td className="muted num nowrap">{c.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {filtered.length > 0 && <Pager total={filtered.length} page={page} pageSize={20} onPage={setPage} />}
              </div>
            </div>
          </section>

          {(queued.length > 0 || sendBatches.some((b) => b.kind === "지금 발송")) && (
            <section className="card">
              <div className="card__head">
                <h2>최근 지금 발송</h2>
                <Link href="/agent/alimtalk/history" className="btn btn--ghost btn--sm">발송 내역 <Icon name="chevronRight" size={14} /></Link>
              </div>
              <div className="list">
                {queued.map((qd) => (
                  <div key={qd.id} className="list__item">
                    <span className="when"><b>{qd.at}</b>예약</span>
                    <span className="what"><div className="t">{qd.label} · {qd.count}명</div><div className="s">이 화면을 닫아도 발송은 계속됩니다</div></span>
                    {qd.cancelled ? <Badge tone="neutral">취소됨</Badge> : <Badge tone="info" dot>대기 중</Badge>}
                  </div>
                ))}
                {sendBatches.filter((b) => b.kind === "지금 발송").slice(0, 4).map((b) => (
                  <div key={b.id} className="list__item">
                    <span className="when"><b>{formatDateTime(b.scheduledAt)}</b></span>
                    <span className="what">
                      <div className="t">{b.templateName} · {b.total}명</div>
                      <div className="progress mt-8" style={{ maxWidth: 220 }}>
                        <i className="ok" style={{ width: `${(b.success / b.total) * 100}%` }} />
                        <i className="ng" style={{ width: `${(b.failed / b.total) * 100}%` }} />
                      </div>
                    </span>
                    <span className="small muted nowrap">성공 {b.success} · 실패 {b.failed} · {formatWon(b.total * b.costPerMsg)}</span>
                    <Badge tone={b.failed === b.total ? "danger" : b.failed ? "warn" : "good"} dot>{b.failed === b.total ? "실패" : b.failed ? "일부 실패" : "성공"}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card__head"><h2>미리보기</h2></div>
            <div className="card__body">
              {tpl ? <KakaoPreview body={tpl.body} buttons={tpl.buttons} sample={{ 고객명: selectedList[0]?.name ?? "홍길동", 중개사상호: "서연공인중개사사무소" }} /> : <p className="muted small">템플릿을 고르면 카카오톡에서 보이는 모양이 여기 표시됩니다.</p>}
            </div>
          </section>
          <section className="card">
            <div className="card__head"><h2>발송 요약</h2></div>
            <div className="card__body">
              <dl className="kv">
                <dt>템플릿</dt><dd>{tpl?.name ?? <span className="muted">미선택</span>}</dd>
                <dt>선택</dt><dd>{selectedList.length}명{optOutSelected ? <span className="muted"> · 거부 {optOutSelected}명은 제외</span> : null}</dd>
                <dt>실제 발송</dt><dd className="strong">{sendCount}명</dd>
                <dt>예상 비용</dt><dd className="strong">{formatWon(cost)} <span className="muted small">(건당 {COST}원)</span></dd>
              </dl>
            </div>
          </section>
        </div>
      </div>

      <div className="selectbar" role="region" aria-label="발송">
        <span className="n">{sendCount}명</span>
        <span className="s">{tpl ? tpl.name : "템플릿을 먼저 고르세요"} · 예상 {formatWon(cost)}</span>
        <span className="spacer" />
        <button type="button" className="btn btn--sm" disabled={!canSend} onClick={() => setConfirm("schedule")}><Icon name="calendar" size={14} /> 시간 예약</button>
        <button type="button" className="btn btn--sm" disabled={!canSend} onClick={() => setConfirm("now")}>바로 발송</button>
        <button type="button" className="btn btn--primary btn--sm" disabled={!canSend} onClick={() => setConfirm("delay")}><Icon name="clock" size={14} /> 5분뒤 발송</button>
      </div>

      <ConfirmModal
        open={confirm === "delay" || confirm === "now"}
        onClose={() => setConfirm(null)}
        danger={confirm === "now"}
        title={confirm === "now" ? `${sendCount}명에게 지금 바로 보냅니다` : `${sendCount}명에게 5분 뒤 보냅니다`}
        description={confirm === "now" ? "즉시 발송은 취소할 수 없습니다. 실수를 되돌리려면 '5분뒤 발송'을 쓰세요." : "5분 안에 이 화면이나 발송 내역에서 취소할 수 있습니다."}
        summary={summary}
        confirmLabel={confirm === "now" ? `${sendCount}명에게 바로 발송` : `${sendCount}명에게 5분 뒤 발송`}
        onConfirm={() => queue(confirm === "now" ? "now" : "delay")}
      />
      <ConfirmModal
        open={confirm === "schedule"}
        onClose={() => setConfirm(null)}
        title="발송 시간 예약"
        description={
          <span className="field" style={{ display: "inline-flex" }}>
            <label className="label" htmlFor="sch-at">발송 일시</label>
            <input id="sch-at" type="datetime-local" className="input" value={scheduleAt} min={`${TODAY}T00:00`} onChange={(e) => setScheduleAt(e.target.value)} />
          </span>
        }
        summary={summary}
        confirmLabel="예약"
        onConfirm={() => queue("schedule")}
      />
    </>
  );
}
