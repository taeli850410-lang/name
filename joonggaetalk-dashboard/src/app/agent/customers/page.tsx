"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Kw, MoreMenu, PageHead, Pager, SearchBox } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { CONTRACT_TYPES, CUSTOMER_KEYWORDS, INTEREST_TYPES, REGIONS, customers as seed, type Customer, type ContractType, type InterestType, type Keyword } from "@/data/customers";
import { deals } from "@/data/deals";
import { properties } from "@/data/properties";
import { formatKoDate, formatPhone, relativeDay, TODAY } from "@/lib/format";

export default function CustomersPage() {
  return (
    <Suspense>
      <Customers />
    </Suspense>
  );
}

function Customers() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [list, setList] = useState<Customer[]>(seed);
  const [q, setQ] = useState("");
  const [type, setType] = useState<InterestType | "">("");
  const [ctype, setCtype] = useState<ContractType | "">("");
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Customer | null>(null);
  const [newOpen, setNewOpen] = useState(params.get("new") === "1");
  const [confirm, setConfirm] = useState<{ kind: "delete" | "resend" | "bulkDelete"; c?: Customer } | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().replace(/-/g, "");
    return list.filter((c) => {
      if (s && !(c.name.includes(s) || c.phone.includes(s) || c.memo.includes(s))) return false;
      if (type && !c.interestTypes.includes(type)) return false;
      if (ctype && !c.contractTypes.includes(ctype)) return false;
      if (kw && !c.keywords.some((k) => k.label === kw)) return false;
      return true;
    });
  }, [list, q, type, ctype, kw]);

  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allChecked = pageItems.length > 0 && pageItems.every((c) => selected.has(c.id));
  const activeFilters = [type, ctype, kw].filter(Boolean).length;

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) pageItems.forEach((c) => next.delete(c.id));
    else pageItems.forEach((c) => next.add(c.id));
    setSelected(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const remove = (ids: string[]) => {
    const removed = list.filter((c) => ids.includes(c.id));
    setList((xs) => xs.filter((c) => !ids.includes(c.id)));
    setSelected(new Set());
    setDetail(null);
    toast({
      message: `${ids.length === 1 ? removed[0].name + " 님을" : ids.length + "명을"} 삭제했습니다. 30일 안에 복구할 수 있습니다.`,
      action: { label: "실행 취소", onClick: () => setList((xs) => [...removed, ...xs]) },
    });
  };

  return (
    <>
      <PageHead
        title="고객"
        desc={
          <>
            {list.length}명 · 최근 30일 등록 {list.filter((c) => c.createdAt >= "2026-08-13").length}명 · 알림톡 수신 동의 {list.filter((c) => c.alimtalkConsent).length}명
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "고객 188명을 엑셀로 내려받습니다. (프로토타입에서는 파일이 생성되지 않습니다)" })}>
              <Icon name="download" size={15} /> 엑셀 다운로드
            </button>
            <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "엑셀 대량등록: 양식을 내려받아 채운 뒤 업로드하면 결과를 표로 보여 줍니다." })}>
              <Icon name="upload" size={15} /> 대량등록
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>
              <Icon name="plus" size={16} /> 고객 등록
            </button>
          </>
        }
      />

      <div className="toolbar">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="이름 · 전화번호 · 메모 검색" />
        <select className="select" style={{ width: 150 }} aria-label="관심유형" value={type} onChange={(e) => { setType(e.target.value as InterestType | ""); setPage(1); }}>
          <option value="">관심유형 전체</option>
          {INTEREST_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="chips" role="group" aria-label="계약형태">
          {CONTRACT_TYPES.map((t) => (
            <button key={t} type="button" className={`chip${ctype === t ? " is-on" : ""}`} aria-pressed={ctype === t} onClick={() => { setCtype(ctype === t ? "" : t); setPage(1); }}>
              {t}
            </button>
          ))}
        </div>
        <select className="select" style={{ width: 150 }} aria-label="키워드" value={kw} onChange={(e) => { setKw(e.target.value); setPage(1); }}>
          <option value="">키워드 전체</option>
          {CUSTOMER_KEYWORDS.map((k) => (
            <option key={k.label} value={k.label}>
              {k.label}
            </option>
          ))}
        </select>
        {activeFilters > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setType(""); setCtype(""); setKw(""); setPage(1); }}>
            <Icon name="x" size={14} /> 필터 초기화 ({activeFilters})
          </button>
        )}
        <span className="spacer" />
        <span className="count">
          <b>{filtered.length}</b>명
        </span>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title="조건에 맞는 고객이 없습니다"
            desc="검색어나 필터를 바꿔 보세요. 관심유형은 등록 화면과 같은 분류를 씁니다."
            actions={
              <button type="button" className="btn" onClick={() => { setQ(""); setType(""); setCtype(""); setKw(""); }}>
                필터 초기화
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="이 페이지 전체 선택" />
                </th>
                <th>고객</th>
                <th>전화번호</th>
                <th>관심</th>
                <th>키워드</th>
                <th>수신 동의</th>
                <th>최근 활동</th>
                <th>등록일</th>
                <th className="th-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => (
                <tr key={c.id} className={`is-clickable${selected.has(c.id) ? " is-selected" : ""}`} onClick={() => setDetail(c)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`${c.name} 선택`} />
                  </td>
                  <td>
                    <div className="cell-title">
                      {c.autoNamed ? (
                        <span className="muted">
                          {c.name} <span className="faint small">(이름 미입력)</span>
                        </span>
                      ) : (
                        c.name
                      )}
                    </div>
                    {c.memo && <div className="cell-sub">{c.memo}</div>}
                  </td>
                  <td className="num nowrap">{formatPhone(c.phone)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {c.interestTypes.map((t) => (
                        <Badge key={t} tone="outline">
                          {t}
                        </Badge>
                      ))}
                      {c.contractTypes.map((t) => (
                        <Badge key={t} tone="info">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    {c.regions[0] && <div className="cell-sub">{c.regions[0]}</div>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {c.keywords.map((k) => (
                        <Kw key={k.label} color={k.color}>
                          {k.label}
                        </Kw>
                      ))}
                    </div>
                  </td>
                  <td>
                    {c.alimtalkConsent ? (
                      <Badge tone="good" dot>
                        동의
                      </Badge>
                    ) : (
                      <Badge tone="neutral" dot>
                        미동의
                      </Badge>
                    )}
                  </td>
                  <td className="muted nowrap">{relativeDay(c.lastActivity)}</td>
                  <td className="muted num nowrap">{c.createdAt}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button type="button" className="btn btn--sm" onClick={() => setDetail(c)}>
                        수정
                      </button>
                      <MoreMenu
                        items={[
                          { label: "알림톡 보내기", icon: "send", onClick: () => router.push(`/agent/alimtalk/send?ids=${c.id}`) },
                          { label: "환영 알림톡 다시 보내기", icon: "refresh", onClick: () => setConfirm({ kind: "resend", c }) },
                          { label: "삭제", icon: "trash", danger: true, onClick: () => setConfirm({ kind: "delete", c }) },
                        ]}
                      />
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
          <span className="s">이 페이지 밖의 선택도 포함됩니다</span>
          <span className="spacer" />
          <Link href={`/agent/alimtalk/send?ids=${Array.from(selected).join(",")}`} className="btn btn--primary btn--sm">
            <Icon name="send" size={14} /> 알림톡 보내기
          </Link>
          <button type="button" className="btn btn--sm" onClick={() => toast(`${selected.size}명에게 키워드를 추가할 수 있습니다. (프로토타입)`)}>
            키워드 추가
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setConfirm({ kind: "bulkDelete" })}>
            삭제
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setSelected(new Set())}>
            선택 해제
          </button>
        </div>
      )}

      {/* 상세 패널 */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={
          detail && (
            <span className="row">
              {detail.name}
              {detail.alimtalkConsent ? <Badge tone="good" dot>알림톡 수신 동의</Badge> : <Badge tone="neutral" dot>미동의</Badge>}
            </span>
          )
        }
        footer={
          detail && (
            <>
              <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirm({ kind: "delete", c: detail })}>
                삭제
              </button>
              <span className="grow" />
              <Link href={`/agent/alimtalk/send?ids=${detail.id}`} className="btn">
                <Icon name="send" size={14} /> 알림톡 보내기
              </Link>
              <button type="button" className="btn btn--primary" onClick={() => { toast(`${detail.name} 님 정보를 저장했습니다.`); setDetail(null); }}>
                저장
              </button>
            </>
          )
        }
      >
        {detail && <CustomerDetail c={detail} />}
      </Drawer>

      {/* 등록 패널 */}
      <Drawer open={newOpen} onClose={() => setNewOpen(false)} title="고객 등록">
        <NewCustomerForm
          onCancel={() => setNewOpen(false)}
          onSave={(c) => {
            setList((xs) => [c, ...xs]);
            setNewOpen(false);
            setPage(1);
            toast({ message: `${c.name} 님을 등록했습니다.${c.alimtalkConsent ? " 환영 알림톡이 1분 뒤 발송됩니다." : ""}`, action: c.alimtalkConsent ? { label: "발송 취소", onClick: () => toast({ tone: "info", message: "환영 알림톡 발송을 취소했습니다." }) } : undefined });
          }}
        />
      </Drawer>

      <ConfirmModal
        open={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        danger
        title={`${confirm?.c?.name} 님을 삭제할까요?`}
        description="목록에서 사라지고 예약된 알림톡은 취소됩니다. 30일 안에는 '삭제된 고객 보기'에서 복구할 수 있습니다."
        summary={confirm?.c ? [{ k: "전화번호", v: formatPhone(confirm.c.phone) }, { k: "관련 계약", v: `${confirm.c.deals}건` }, { k: "예약 발송", v: "0건" }] : undefined}
        confirmLabel="삭제"
        onConfirm={() => { if (confirm?.c) remove([confirm.c.id]); setConfirm(null); }}
      />
      <ConfirmModal
        open={confirm?.kind === "bulkDelete"}
        onClose={() => setConfirm(null)}
        danger
        title={`선택한 ${selected.size}명을 삭제할까요?`}
        description="30일 안에는 복구할 수 있습니다."
        confirmLabel={`${selected.size}명 삭제`}
        onConfirm={() => { remove(Array.from(selected)); setConfirm(null); }}
      />
      <ConfirmModal
        open={confirm?.kind === "resend"}
        onClose={() => setConfirm(null)}
        title={`${confirm?.c?.name} 님에게 환영 알림톡을 다시 보냅니다`}
        description="이미 받은 고객에게 같은 내용이 한 번 더 갑니다."
        summary={[{ k: "템플릿", v: "[중개톡] 신규" }, { k: "예상 비용", v: "6.5원" }, { k: "발송 시점", v: "지금" }]}
        confirmLabel="다시 보내기"
        onConfirm={() => { setConfirm(null); toast(`${confirm?.c?.name} 님에게 환영 알림톡을 보냈습니다.`); }}
      />
    </>
  );
}

function CustomerDetail({ c }: { c: Customer }) {
  const myDeals = deals.filter((d) => d.buyerId === c.id || d.buyer === c.name || d.seller === c.name);
  const myProps = properties.filter((p) => p.ownerId === c.id);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <dl className="kv">
        <dt>전화번호</dt>
        <dd className="row">
          <span className="num">{formatPhone(c.phone)}</span>
          <a href={`tel:${c.phone}`} className="btn btn--sm">
            <Icon name="phone" size={13} /> 전화
          </a>
          {c.carrier && <Badge tone="outline">{c.carrier}</Badge>}
        </dd>
        <dt>관심</dt>
        <dd className="row" style={{ gap: 4 }}>
          {c.interestTypes.length === 0 && c.contractTypes.length === 0 && <span className="muted">—</span>}
          {c.interestTypes.map((t) => <Badge key={t} tone="outline">{t}</Badge>)}
          {c.contractTypes.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
        </dd>
        <dt>관심 지역</dt>
        <dd>{c.regions.length ? c.regions.join(", ") : <span className="muted">—</span>}</dd>
        <dt>키워드</dt>
        <dd className="row" style={{ gap: 4 }}>
          {c.keywords.length ? c.keywords.map((k) => <Kw key={k.label} color={k.color}>{k.label}</Kw>) : <span className="muted">—</span>}
        </dd>
        <dt>수신 동의</dt>
        <dd>{c.alimtalkConsent ? `동의 · ${c.consentedAt && formatKoDate(c.consentedAt, true)} 기록` : "미동의 — 정보성 알림톡만 발송됩니다"}</dd>
        <dt>등기부 알림</dt>
        <dd>{c.registryAlert ? "임차 계약 시 무료 알림 신청" : "신청 안 함"}</dd>
        <dt>등록일</dt>
        <dd className="num">{c.createdAt}</dd>
      </dl>
      <div>
        <div className="section-label">메모</div>
        <textarea className="textarea" defaultValue={c.memo} placeholder="상담 내용, 특이사항" aria-label="메모" />
      </div>
      <div>
        <div className="section-label">관련 계약 {myDeals.length}</div>
        {myDeals.length === 0 ? (
          <p className="muted small">연결된 계약이 없습니다.</p>
        ) : (
          myDeals.map((d) => (
            <Link key={d.id} href={`/agent/deals?focus=${d.id}`} className="list__item" style={{ padding: "8px 0" }}>
              <span className="what">
                <div className="t">{d.name}</div>
                <div className="s">{d.status} · {d.balanceDate ? `잔금일 ${d.balanceDate}` : "일정 미정"}</div>
              </span>
              <Icon name="chevronRight" size={16} className="faint" />
            </Link>
          ))
        )}
      </div>
      <div>
        <div className="section-label">소유 물건 {myProps.length}</div>
        {myProps.length === 0 ? <p className="muted small">등록된 소유 물건이 없습니다.</p> : myProps.map((p) => <div key={p.id} className="small">{p.name}</div>)}
      </div>
      <div>
        <div className="section-label">발송 이력 {c.sends}건</div>
        <p className="muted small">최근: 환영 알림톡 · {c.createdAt} · 성공</p>
      </div>
    </div>
  );
}

function NewCustomerForm({ onSave, onCancel }: { onSave: (c: Customer) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carrier, setCarrier] = useState("");
  const [types, setTypes] = useState<InterestType[]>([]);
  const [ctypes, setCtypes] = useState<ContractType[]>([]);
  const [region, setRegion] = useState("");
  const [memo, setMemo] = useState("");
  const [kws, setKws] = useState<Keyword[]>([]);
  const [consent, setConsent] = useState(false);
  const [registry, setRegistry] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const p = phone.replace(/\D/g, "");
    if (!/^01[016789]\d{7,8}$/.test(p)) return setErr("휴대폰번호를 확인해 주세요. 예) 010-1234-5678");
    setErr(null);
    onSave({
      id: `c${Date.now()}`,
      name: name.trim() || p.slice(-4),
      autoNamed: !name.trim(),
      phone: p,
      carrier: (carrier || undefined) as Customer["carrier"],
      interestTypes: types,
      contractTypes: ctypes,
      regions: region ? [region] : [],
      keywords: kws,
      memo,
      alimtalkConsent: consent,
      consentedAt: consent ? TODAY : undefined,
      registryAlert: registry,
      createdAt: TODAY,
      lastActivity: TODAY,
      sends: 0,
      deals: 0,
      properties: 0,
    });
  };
  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="form">
      <div className="field">
        <label className="label" htmlFor="nc-phone">
          휴대폰번호 <span className="req">*</span>
        </label>
        <input id="nc-phone" className={`input${err ? " is-invalid" : ""}`} type="tel" inputMode="numeric" placeholder="010-1234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
        {err && <div className="error">{err}</div>}
      </div>
      <div className="form-grid-2">
        <div className="field">
          <label className="label" htmlFor="nc-name">
            고객명 <span className="opt">선택</span>
          </label>
          <input id="nc-name" className="input" placeholder="비우면 번호 뒷자리로 표시" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="nc-carrier">
            통신사 <span className="opt">선택</span>
          </label>
          <select id="nc-carrier" className="select" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            <option value="">선택 안 함</option>
            {["SKT", "KT", "LGU+", "알뜰폰"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <span className="label">관심유형</span>
        <div className="chips">
          {INTEREST_TYPES.map((t) => (
            <button key={t} type="button" className={`chip${types.includes(t) ? " is-on" : ""}`} aria-pressed={types.includes(t)} onClick={() => setTypes(toggleIn(types, t))}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="form-grid-2">
        <div className="field">
          <span className="label">계약형태</span>
          <div className="chips">
            {CONTRACT_TYPES.map((t) => (
              <button key={t} type="button" className={`chip${ctypes.includes(t) ? " is-on" : ""}`} aria-pressed={ctypes.includes(t)} onClick={() => setCtypes(toggleIn(ctypes, t))}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="nc-region">
            관심 지역
          </label>
          <select id="nc-region" className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">선택</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="nc-memo">
          메모
        </label>
        <textarea id="nc-memo" className="textarea" placeholder="상담 내용, 특이사항" value={memo} onChange={(e) => setMemo(e.target.value)} />
        <div className="chips">
          {CUSTOMER_KEYWORDS.slice(0, 14).map((k) => (
            <button key={k.label} type="button" className={`chip${kws.some((x) => x.label === k.label) ? " is-on" : ""}`} onClick={() => setKws(kws.some((x) => x.label === k.label) ? kws.filter((x) => x.label !== k.label) : [...kws, k])}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div className="stack">
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> 알림톡 수신에 동의했습니다
          <span className="help">고객이 동의한 경우에만 체크 · 동의 일시가 기록됩니다</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={registry} onChange={(e) => setRegistry(e.target.checked)} /> 임차 계약 시 등기부 변동 무료 알림 신청
        </label>
        <p className="help">환영 알림톡은 계정 설정(자동발송 설정 › 고객 등록)에 따라 수신 동의 고객에게 1분 뒤 발송됩니다.</p>
      </div>
      <div className="row row--end">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="btn btn--primary" onClick={submit}>
          등록
        </button>
      </div>
    </div>
  );
}
