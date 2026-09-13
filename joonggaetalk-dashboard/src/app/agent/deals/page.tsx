"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Kw, MoreMenu, PageHead, Pager, SearchBox, type Tone } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Attachments } from "@/components/files/Attachments";
import { attachmentsOf } from "@/data/files";
import { useToast } from "@/components/ui/Toast";
import { deals as seed, type Deal, type DealStatus } from "@/data/deals";
import { properties } from "@/data/properties";
import { customers } from "@/data/customers";
import { sendBatches } from "@/data/sends";
import { dday, formatKoDate, formatManwon, TODAY } from "@/lib/format";

const STATUS_TONE: Record<DealStatus, Tone> = { 의뢰: "neutral", 계약: "info", 잔금완료: "good", 입주: "good", 만료: "warn" };
const TABS: { key: string; label: string; match: (d: Deal) => boolean }[] = [
  { key: "all", label: "전체", match: () => true },
  { key: "active", label: "진행 중", match: (d) => d.status === "의뢰" || d.status === "계약" },
  { key: "의뢰", label: "의뢰", match: (d) => d.status === "의뢰" },
  { key: "계약", label: "계약", match: (d) => d.status === "계약" },
  { key: "done", label: "잔금·입주 완료", match: (d) => d.status === "잔금완료" || d.status === "입주" },
  { key: "만료", label: "만료", match: (d) => d.status === "만료" },
];

const DATE_FIELDS: { key: keyof Deal; label: string }[] = [
  { key: "contractDate", label: "계약일" },
  { key: "interimDate", label: "중도금일" },
  { key: "balanceDate", label: "잔금일" },
  { key: "moveInDate", label: "입주일" },
  { key: "expiryDate", label: "계약 만료일" },
];

export default function DealsPage() {
  return (
    <Suspense>
      <Deals />
    </Suspense>
  );
}

function nextDate(d: Deal): { label: string; date: string } | null {
  const cands = DATE_FIELDS.map((f) => ({ label: f.label, date: d[f.key] as string | undefined })).filter((x): x is { label: string; date: string } => !!x.date && x.date >= TODAY);
  cands.sort((a, b) => (a.date < b.date ? -1 : 1));
  return cands[0] ?? null;
}

function Deals() {
  const toast = useToast();
  const params = useSearchParams();
  const [list, setList] = useState<Deal[]>(seed);
  const [tab, setTab] = useState(params.get("status") === "active" ? "active" : "all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Deal | null>(() => (params.get("focus") ? seed.find((d) => d.id === params.get("focus")) ?? null : null));
  const [newOpen, setNewOpen] = useState(params.get("new") === "1");
  const [del, setDel] = useState<Deal | null>(null);

  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) ?? TABS[0];
    return list.filter((d) => t.match(d) && (!q || d.name.includes(q) || d.propertyName.includes(q) || d.seller.includes(q) || d.buyer.includes(q)));
  }, [list, tab, q]);
  const pageItems = filtered.slice((page - 1) * 20, page * 20);

  return (
    <>
      <PageHead
        title="계약"
        desc={`진행 중 ${list.filter((d) => d.status === "의뢰" || d.status === "계약").length}건 · 이번 달 잔금 예정 ${list.filter((d) => d.balanceDate?.startsWith("2026-09") && d.status === "계약").length}건`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "계약 목록을 엑셀로 내려받습니다. (프로토타입)" })}>
              <Icon name="download" size={15} /> 엑셀 다운로드
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>
              <Icon name="plus" size={16} /> 계약 등록
            </button>
          </>
        }
      />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? " is-active" : ""}`} onClick={() => { setTab(t.key); setPage(1); }}>
            {t.label} <span className="n">{list.filter(t.match).length}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="계약명 · 물건 · 매도/임대인 · 매수/임차인" />
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState icon="file" title="해당 상태의 계약이 없습니다" desc="계약을 등록하면 계약일·중도금일·잔금일에 맞춰 알림톡이 자동으로 예약됩니다." actions={<button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>계약 등록</button>} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>계약</th>
                <th>당사자</th>
                <th>금액</th>
                <th>다음 일정</th>
                <th>다음 발송</th>
                <th>등록일</th>
                <th className="th-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => {
                const nd = nextDate(d);
                const send = sendBatches.find((b) => b.dealName === d.name && b.pending > 0);
                return (
                  <tr key={d.id} className="is-clickable" onClick={() => setDetail(d)}>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Badge tone={STATUS_TONE[d.status]} dot>
                          {d.status}
                        </Badge>
                        <span className="cell-title">{d.name}</span>
                        {d.kind === "재계약" && <Badge tone="outline">재계약</Badge>}
                      </div>
                      <div className="cell-sub">
                        {d.propertyName} · {d.method}
                        {d.keywords.length > 0 && (
                          <span style={{ marginLeft: 6 }}>
                            {d.keywords.map((k) => (
                              <Kw key={k.label} color={k.color}>
                                {k.label}
                              </Kw>
                            ))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="nowrap">
                      <div>
                        <span className="muted small">{d.method === "매매" ? "매도" : "임대"}</span> {d.seller}
                        {d.coSeller && <span className="muted small"> +공동</span>}
                      </div>
                      <div>
                        <span className="muted small">{d.method === "매매" ? "매수" : "임차"}</span> {d.buyer === "-" ? <span className="muted">미정</span> : d.buyer}
                      </div>
                    </td>
                    <td className="nowrap">
                      {d.method === "월세" ? `보증금 ${formatManwon(d.down ?? 0)} / 월 ${formatManwon(d.monthly ?? 0)}` : formatManwon((d.down ?? 0) + (d.interim ?? 0) + (d.balance ?? 0))}
                      {d.fee ? <div className="cell-sub">중개보수 {formatManwon(d.fee)}</div> : null}
                    </td>
                    <td className="nowrap">
                      {nd ? (
                        <>
                          <div>
                            {nd.label} <span className="dday" style={{ marginLeft: 4 }}>{dday(nd.date)}</span>
                          </div>
                          <div className="cell-sub num">{nd.date}</div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="nowrap">
                      {send ? (
                        <>
                          <div>{send.templateName}</div>
                          <div className="cell-sub num">{send.scheduledAt}</div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted num nowrap">{d.createdAt}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button type="button" className="btn btn--sm" onClick={() => setDetail(d)}>
                          수정
                        </button>
                        <MoreMenu
                          items={[
                            { label: "발송 예정 보기", icon: "send", onClick: () => toast({ tone: "info", message: "이 계약의 예약 발송은 발송 내역에서 확인할 수 있습니다." }) },
                            { label: "복사해서 새 계약", icon: "copy", onClick: () => toast({ tone: "info", message: "계약을 복사했습니다. (프로토타입)" }) },
                            { label: "삭제", icon: "trash", danger: true, onClick: () => setDel(d) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && <Pager total={filtered.length} page={page} pageSize={20} onPage={setPage} />}
      </div>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={
          detail && (
            <span className="row">
              <Badge tone={STATUS_TONE[detail.status]} dot>
                {detail.status}
              </Badge>
              {detail.name}
            </span>
          )
        }
        footer={
          detail && (
            <>
              <button type="button" className="btn btn--danger-ghost" onClick={() => setDel(detail)}>
                삭제
              </button>
              <span className="grow" />
              <select className="select" style={{ width: 150 }} aria-label="상태 변경" value={detail.status} onChange={(e) => { const s = e.target.value as DealStatus; setList((xs) => xs.map((d) => (d.id === detail.id ? { ...d, status: s } : d))); setDetail({ ...detail, status: s }); toast(`상태를 '${s}'(으)로 바꿨습니다.`); }}>
                {(["의뢰", "계약", "잔금완료", "입주", "만료"] as DealStatus[]).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button type="button" className="btn btn--primary" onClick={() => { toast("계약 정보를 저장했습니다."); setDetail(null); }}>
                저장
              </button>
            </>
          )
        }
      >
        {detail && <DealDetail d={detail} />}
      </Drawer>

      <Drawer open={newOpen} onClose={() => setNewOpen(false)} title="계약 등록">
        <NewDealForm onCancel={() => setNewOpen(false)} onSave={(d) => { setList((xs) => [d, ...xs]); setNewOpen(false); toast(`${d.name}을(를) 등록했습니다. 시점별 알림톡이 자동 예약됩니다.`); }} />
      </Drawer>

      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title={`${del?.name}을(를) 삭제할까요?`}
        description="이 계약으로 예약된 알림톡이 모두 취소됩니다. 30일 안에 복구할 수 있습니다."
        summary={del ? [{ k: "예약 발송", v: `${sendBatches.filter((b) => b.dealName === del.name && b.pending > 0).length}건` }, { k: "상태", v: del.status }] : undefined}
        confirmLabel="삭제"
        onConfirm={() => {
          if (del) {
            const d = del;
            setList((xs) => xs.filter((x) => x.id !== d.id));
            setDetail(null);
            toast({ message: `${d.name}을(를) 삭제했습니다.`, action: { label: "실행 취소", onClick: () => setList((xs) => [d, ...xs]) } });
          }
          setDel(null);
        }}
      />
    </>
  );
}

function DealDetail({ d }: { d: Deal }) {
  const total = (d.down ?? 0) + (d.interim ?? 0) + (d.balance ?? 0);
  const sends = sendBatches.filter((b) => b.dealName === d.name);
  const [files, setFiles] = useState(() => attachmentsOf("deals", d.id));
  return (
    <div className="stack" style={{ gap: 20 }}>
      <dl className="kv">
        <dt>물건</dt>
        <dd>{d.propertyName}</dd>
        <dt>{d.method === "매매" ? "매도인" : "임대인"}</dt>
        <dd>{d.seller}</dd>
        <dt>{d.method === "매매" ? "매수인" : "임차인"}</dt>
        <dd>{d.buyer === "-" ? <span className="muted">미정</span> : d.buyer}</dd>
        <dt>계약방식</dt>
        <dd>
          {d.method} · {d.kind}
        </dd>
      </dl>
      <div>
        <div className="section-label">금액</div>
        <dl className="kv">
          {d.method === "월세" ? (
            <>
              <dt>보증금</dt>
              <dd>{formatManwon(d.down ?? 0)}</dd>
              <dt>월세</dt>
              <dd>{formatManwon(d.monthly ?? 0)}</dd>
            </>
          ) : (
            <>
              <dt>계약금</dt>
              <dd>{formatManwon(d.down ?? 0)}</dd>
              <dt>중도금</dt>
              <dd>{formatManwon(d.interim ?? 0)}</dd>
              <dt>잔금</dt>
              <dd>{formatManwon(d.balance ?? 0)}</dd>
              <dt className="strong">{d.method === "매매" ? "매매가" : "보증금"}</dt>
              <dd className="strong">{formatManwon(total)}</dd>
            </>
          )}
          <dt>중개보수</dt>
          <dd>{d.fee ? formatManwon(d.fee) : "—"}</dd>
        </dl>
      </div>
      <div>
        <div className="section-label">일정</div>
        <div className="timeline">
          {DATE_FIELDS.map((f) => {
            const v = d[f.key] as string | undefined;
            if (!v) return null;
            const done = v < TODAY;
            const isNext = !done && nextDate(d)?.date === v;
            return (
              <div key={f.key} className={`timeline__item${done ? " is-done" : ""}${isNext ? " is-next" : ""}`}>
                <div className="t">
                  {f.label}
                  <span className={`dday${done ? " dday--done" : ""}`}>{dday(v)}</span>
                </div>
                <div className="s">{formatKoDate(v, true)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="section-label">이 계약의 알림톡</div>
        {sends.length === 0 ? (
          <p className="muted small">예약된 발송이 없습니다. 자동발송 설정의 시점에 따라 일정이 잡히면 자동으로 예약됩니다.</p>
        ) : (
          sends.map((b) => (
            <div key={b.id} className="list__item" style={{ padding: "8px 0" }}>
              <span className="what">
                <div className="t">{b.templateName}</div>
                <div className="s">{b.trigger} · {b.scheduledAt}</div>
              </span>
              <Badge tone={b.pending ? "info" : b.failed ? "danger" : "good"} dot>
                {b.pending ? "예정" : b.failed ? "실패" : "발송 완료"}
              </Badge>
            </div>
          ))
        )}
      </div>
      <div>
        <div className="section-label">서류</div>
        <Attachments scope="deals" ownerId={d.id} items={files} onChange={setFiles} />
      </div>
      <div>
        <div className="section-label">메모</div>
        <textarea className="textarea" defaultValue={d.memo} aria-label="메모" />
      </div>
    </div>
  );
}

function NewDealForm({ onSave, onCancel }: { onSave: (d: Deal) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [method, setMethod] = useState<Deal["method"]>("전세");
  const [kind, setKind] = useState<Deal["kind"]>("신규");
  const [propertyId, setPropertyId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [down, setDown] = useState("");
  const [interim, setInterim] = useState("");
  const [balance, setBalance] = useState("");
  const [monthly, setMonthly] = useState("");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const total = Number(down || 0) + Number(interim || 0) + Number(balance || 0);
  const prop = properties.find((p) => p.id === propertyId);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "계약명을 입력해 주세요.";
    if (!propertyId) e.property = "물건을 선택해 주세요.";
    if (dates.balanceDate && dates.contractDate && dates.balanceDate < dates.contractDate) e.dates = "잔금일이 계약일보다 앞설 수 없습니다.";
    setErr(e);
    if (Object.keys(e).length) return;
    const buyer = customers.find((c) => c.id === buyerId);
    onSave({
      id: `d${Date.now()}`,
      name: name.trim(),
      kind,
      method,
      status: dates.contractDate ? "계약" : "의뢰",
      propertyId,
      propertyName: prop?.name ?? "",
      seller: prop?.ownerName ?? "-",
      buyer: buyer?.name ?? "-",
      buyerId: buyer?.id,
      down: Number(down || 0),
      interim: Number(interim || 0),
      balance: Number(balance || 0),
      monthly: Number(monthly || 0),
      contractDate: dates.contractDate || undefined,
      interimDate: dates.interimDate || undefined,
      balanceDate: dates.balanceDate || undefined,
      moveInDate: dates.moveInDate || undefined,
      expiryDate: dates.expiryDate || undefined,
      registryAlert: method !== "매매",
      verified: prop?.verified ?? false,
      keywords: [],
      memo: "",
      createdAt: TODAY,
    });
  };

  return (
    <div className="form">
      <div className="field">
        <label className="label" htmlFor="nd-name">
          계약명 <span className="req">*</span>
        </label>
        <input id="nd-name" className={`input${err.name ? " is-invalid" : ""}`} placeholder="예: 행복아파트 502호 매매" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {err.name && <div className="error">{err.name}</div>}
      </div>
      <div className="form-grid-2">
        <div className="field">
          <span className="label">계약방식</span>
          <div className="seg">
            {(["매매", "전세", "월세"] as const).map((m) => (
              <button key={m} type="button" className={method === m ? "is-active" : ""} onClick={() => setMethod(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">유형</span>
          <div className="seg">
            {(["신규", "재계약"] as const).map((k) => (
              <button key={k} type="button" className={kind === k ? "is-active" : ""} onClick={() => setKind(k)}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="form-grid-2">
        <div className="field">
          <label className="label" htmlFor="nd-prop">
            물건 <span className="req">*</span>
          </label>
          <select id="nd-prop" className={`select${err.property ? " is-invalid" : ""}`} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">선택</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {err.property && <div className="error">{err.property}</div>}
          {prop && <div className="help">{method === "매매" ? "매도인" : "임대인"}: {prop.ownerName ?? "소유자 미지정"}</div>}
        </div>
        <div className="field">
          <label className="label" htmlFor="nd-buyer">
            {method === "매매" ? "매수인" : "임차인"}
          </label>
          <select id="nd-buyer" className="select" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            <option value="">나중에 지정</option>
            {customers.slice(0, 40).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="section-label">금액 (만원)</div>
        {method === "월세" ? (
          <div className="form-grid-2">
            <div className="field">
              <label className="label" htmlFor="nd-dep">보증금</label>
              <input id="nd-dep" className="input" inputMode="numeric" value={down} onChange={(e) => setDown(e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label className="label" htmlFor="nd-mon">월세</label>
              <input id="nd-mon" className="input" inputMode="numeric" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="0" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor="nd-down">계약금</label>
                <input id="nd-down" className="input" inputMode="numeric" value={down} onChange={(e) => setDown(e.target.value)} placeholder="0" />
              </div>
              <div className="field">
                <label className="label" htmlFor="nd-int">중도금</label>
                <input id="nd-int" className="input" inputMode="numeric" value={interim} onChange={(e) => setInterim(e.target.value)} placeholder="0" />
              </div>
              <div className="field">
                <label className="label" htmlFor="nd-bal">잔금</label>
                <input id="nd-bal" className="input" inputMode="numeric" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="row row--between mt-8" style={{ padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
              <span className="muted">{method === "매매" ? "매매가" : "보증금"} 합계</span>
              <b>{formatManwon(total)}</b>
            </div>
          </>
        )}
      </div>

      <div>
        <div className="section-label">일정</div>
        <div className="form-grid-2">
          {DATE_FIELDS.filter((f) => method !== "매매" || f.key !== "expiryDate").map((f) => (
            <div key={f.key} className="field">
              <label className="label" htmlFor={`nd-${f.key}`}>{f.label}</label>
              <input id={`nd-${f.key}`} type="date" className="input" value={dates[f.key] ?? ""} onChange={(e) => setDates({ ...dates, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>
        {err.dates && <div className="error">{err.dates}</div>}
        <p className="help">일정이 있는 시점에는 자동발송 설정에 따라 알림톡이 예약됩니다 (계약일 1일 전, 잔금일 3일 전 등).</p>
      </div>

      <div className="row row--end">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>취소</button>
        <button type="button" className="btn btn--primary" onClick={submit}>등록</button>
      </div>
    </div>
  );
}
