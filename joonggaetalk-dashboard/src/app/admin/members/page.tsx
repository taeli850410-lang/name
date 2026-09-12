"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, MoreMenu, PageHead, Pager, SearchBox, type Tone } from "@/components/ui/Bits";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { members as seed, memberCounts, type Member, type Plan } from "@/data/members";
import { addDays, dday, formatPhone, TODAY } from "@/lib/format";

const PLAN_TONE: Record<Plan, Tone> = { 유료: "info", 무료: "good", 만료: "warn", 미승인: "danger", 운영자: "admin" };

export default function MembersPage() {
  return (
    <Suspense>
      <Members />
    </Suspense>
  );
}

/** 회원 관리 — 목록이 먼저. 도구는 선택 후 나타나는 액션 바로. 첫 열 고정. */
function Members() {
  const toast = useToast();
  const params = useSearchParams();
  const [list, setList] = useState<Member[]>(seed);
  const [plan, setPlan] = useState<Plan | "">((params.get("plan") as Plan) || "");
  const [expiring, setExpiring] = useState(params.get("expiring") === "1");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extend, setExtend] = useState(false);
  const [ext, setExt] = useState({ kind: "운영자 무료", days: "30", until: "", memo: "", share: false });

  const filtered = useMemo(() => {
    const s = q.trim();
    return list.filter((m) => {
      if (plan && m.plan !== plan) return false;
      if (expiring && !(m.expiresAt && m.expiresAt >= TODAY && m.expiresAt <= addDays(TODAY, 30))) return false;
      if (s && !(m.name.includes(s) || m.office.includes(s) || m.phone.includes(s.replace(/-/g, "")) || m.memo.includes(s))) return false;
      return true;
    });
  }, [list, plan, expiring, q]);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allChecked = pageItems.length > 0 && pageItems.every((m) => selected.has(m.id));

  const approve = (m: Member) => {
    setList((xs) => xs.map((x) => (x.id === m.id ? { ...x, plan: "무료", expiresAt: addDays(TODAY, 7) } : x)));
    toast(`${m.name} 님을 승인했습니다. 무료 7일 부여.`);
  };

  return (
    <>
      <PageHead
        title="회원 관리"
        desc={`전체 ${memberCounts.total}명 · 네이버 스마트스토어 구매 자료는 5분마다 자동 동기화됩니다 (마지막 21:20).`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "지금 동기화를 시작했습니다. 새 주문 0건." })}><Icon name="refresh" size={15} /> 구매 자료 동기화</button>
            <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "회원 목록을 엑셀로 내려받습니다. (프로토타입)" })}><Icon name="download" size={15} /> 엑셀</button>
          </>
        }
      />
      <div className="toolbar">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="이름 · 상호 · 휴대폰 · 메모" />
        <div className="chips" role="group" aria-label="구분">
          <button type="button" className={`chip${!plan && !expiring ? " is-on" : ""}`} onClick={() => { setPlan(""); setExpiring(false); setPage(1); }}>전체 <span className="n">{memberCounts.total}</span></button>
          {([["유료", memberCounts.paid], ["무료", memberCounts.free], ["만료", memberCounts.expired], ["미승인", memberCounts.pending], ["운영자", memberCounts.admin]] as [Plan, number][]).map(([p, n]) => (
            <button key={p} type="button" className={`chip${plan === p ? " is-on" : ""}`} aria-pressed={plan === p} onClick={() => { setPlan(plan === p ? "" : p); setExpiring(false); setPage(1); }}>{p} <span className="n">{n}</span></button>
          ))}
          <button type="button" className={`chip${expiring ? " is-on" : ""}`} aria-pressed={expiring} onClick={() => { setExpiring((v) => !v); setPlan(""); setPage(1); }}>만료 임박 30일</button>
        </div>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState icon="users" title="조건에 맞는 회원이 없습니다" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="sticky-col" style={{ width: 36 }}><input type="checkbox" checked={allChecked} onChange={() => { const n = new Set(selected); if (allChecked) pageItems.forEach((m) => n.delete(m.id)); else pageItems.forEach((m) => n.add(m.id)); setSelected(n); }} aria-label="이 페이지 전체 선택" /></th>
                <th className="sticky-col" style={{ left: 36, minWidth: 220 }}>회원</th>
                <th>구분</th>
                <th>휴대폰</th>
                <th>사용기한</th>
                <th>최근 구매</th>
                <th style={{ minWidth: 230 }}>연동</th>
                <th>지역</th>
                <th className="th-right">고객</th>
                <th className="th-right">30일 발송</th>
                <th>메모</th>
                <th className="th-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => (
                <tr key={m.id} className={selected.has(m.id) ? "is-selected" : ""}>
                  <td className="sticky-col"><input type="checkbox" checked={selected.has(m.id)} onChange={() => { const n = new Set(selected); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); setSelected(n); }} aria-label={`${m.name} 선택`} /></td>
                  <td className="sticky-col" style={{ left: 36 }}>
                    <div className="row" style={{ gap: 6 }}><span className="cell-title">{m.name}</span>{m.grade && <Badge tone="outline">{m.grade}</Badge>}</div>
                    <div className="cell-sub">{m.office}</div>
                  </td>
                  <td><Badge tone={PLAN_TONE[m.plan]} dot>{m.plan}</Badge></td>
                  <td className="num nowrap">{formatPhone(m.phone)}</td>
                  <td className="num nowrap">
                    {m.expiresAt ? (
                      <>
                        {m.expiresAt}
                        {m.plan !== "만료" && m.expiresAt <= addDays(TODAY, 30) && <span className="dday dday--soon" style={{ marginLeft: 6 }}>{dday(m.expiresAt)}</span>}
                      </>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td className="num nowrap muted">{m.lastPurchase ?? "—"}</td>
                  <td className="nowrap">
                    <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                      <Badge tone={m.integrations.balsongking ? "info" : "outline"}>발송킹</Badge>
                      <Badge tone={m.integrations.calendar ? "info" : "outline"}>캘린더</Badge>
                      <Badge tone={m.integrations.telegram ? "info" : "outline"}>텔레그램</Badge>
                    </div>
                  </td>
                  <td className="nowrap">{m.region}</td>
                  <td className="td-num">{m.customers}</td>
                  <td className="td-num">{m.sends30d}</td>
                  <td className="muted small">{m.memo || "—"}</td>
                  <td>
                    <div className="row-actions">
                      {m.plan === "미승인" ? (
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => approve(m)}>승인</button>
                      ) : (
                        <button type="button" className="btn btn--sm" onClick={() => { setSelected(new Set([m.id])); setExtend(true); }}>기간 추가</button>
                      )}
                      <MoreMenu items={[
                        { label: "회원 화면으로 미리보기", icon: "eye", onClick: () => (window.location.href = "/agent") },
                        { label: "메모 수정", icon: "edit", onClick: () => toast({ tone: "info", message: "메모 수정 (프로토타입)" }) },
                        { label: "등급 변경", icon: "star", onClick: () => toast({ tone: "info", message: "등급 변경 (프로토타입)" }) },
                        { label: "비활성 처리", icon: "xCircle", danger: true, onClick: () => toast({ tone: "danger", message: `${m.name} 님을 비활성 처리하려면 확인이 필요합니다. (프로토타입)` }) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && <Pager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}
      </div>

      {selected.size > 0 && (
        <div className="selectbar" role="region" aria-label="선택 작업">
          <span className="n">{selected.size}명 선택</span>
          <span className="spacer" />
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setExtend(true)}><Icon name="clock" size={14} /> 기간 일괄 추가</button>
          <button type="button" className="btn btn--sm" onClick={() => toast(`${selected.size}명에게 등급을 적용했습니다. (프로토타입)`)}>등급 적용</button>
          <button type="button" className="btn btn--sm" onClick={() => toast(`${selected.size}명에게 알림톡을 보내려면 공용 템플릿을 고르세요. (프로토타입)`)}>알림톡</button>
          <button type="button" className="btn btn--sm" onClick={() => setSelected(new Set())}>선택 해제</button>
        </div>
      )}

      <Modal
        open={extend}
        onClose={() => setExtend(false)}
        title={`${selected.size}명에게 사용기한 추가`}
        footer={<><button type="button" className="btn btn--ghost" onClick={() => setExtend(false)}>취소</button><button type="button" className="btn btn--primary" onClick={() => { setExtend(false); toast(`${selected.size}명의 사용기한을 ${ext.until ? ext.until + "까지" : "+" + ext.days + "일"} ${ext.kind}(으)로 적용했습니다.`); setSelected(new Set()); }}>적용</button></>}
      >
        <div className="form">
          <div className="form-grid-2">
            <div className="field">
              <label className="label" htmlFor="ex-kind">구분</label>
              <select id="ex-kind" className="select" value={ext.kind} onChange={(e) => setExt({ ...ext, kind: e.target.value })}>
                {["운영자 무료", "결제 (네이버 주문)", "보정"].map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="ex-days">추가 일수</label>
              <input id="ex-days" className="input" inputMode="numeric" value={ext.days} disabled={!!ext.until} onChange={(e) => setExt({ ...ext, days: e.target.value })} />
              <div className="help">보정은 음수 가능 (예: -7)</div>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="ex-until">또는 특정 날짜까지</label>
            <input id="ex-until" type="date" className="input" value={ext.until} onChange={(e) => setExt({ ...ext, until: e.target.value })} />
            <div className="help">날짜를 고르면 일수는 무시되고, 회원마다 남은 일수를 각각 계산해 적용합니다.</div>
          </div>
          <div className="field">
            <label className="label" htmlFor="ex-memo">메모 <span className="opt">선택</span></label>
            <input id="ex-memo" className="input" value={ext.memo} onChange={(e) => setExt({ ...ext, memo: e.target.value })} placeholder="예: 9월 교육 수강 회원" />
          </div>
          <label className="check"><input type="checkbox" checked={ext.share} onChange={(e) => setExt({ ...ext, share: e.target.checked })} /> 물건공유 권한도 함께 부여 (사용기한 만료 시 자동 해제)</label>
        </div>
      </Modal>
    </>
  );
}
