"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, EmptyState, PageHead, Switch, type Tone } from "@/components/ui/Bits";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { billing as legacy } from "@/data/misc";
import { charges as seedCharges, DEMO_CARD, DEMO_CHARGES, DEMO_SUB, subscription as seedSub, type Charge, type PayStatus, type Subscription } from "@/data/billing";
import {
  anchorDayOf,
  failPolicy,
  GRACE_DAYS,
  graceEndsAt,
  maskCard,
  nextChargeDate,
  NOTICE_DAYS_BEFORE,
  orderId,
  PAY_FAIL_REASONS,
  planOf,
  PLANS,
  priceOf,
  proratedCharge,
  refundOnCancel,
  retrySchedule,
  vatBreakdown,
  yearlyFreeMonths,
  type Cycle,
  type PlanId,
} from "@/lib/billing";
import { diffDays, euro, formatKoDate, formatWon, TODAY } from "@/lib/format";

const STATUS_TONE: Record<PayStatus, Tone> = { 결제완료: "good", 결제실패: "danger", "재시도 예정": "warn", 결제예정: "info", 환불: "neutral" };

/**
 * 이용권 — 정기결제.
 *
 * 카드번호는 이 화면에도 서버에도 없다. PG 결제창이 카드를 받아 가고
 * 우리는 빌링키와 마스킹된 표시값만 받는다.
 */
export default function BillingPage() {
  const toast = useToast();
  const [sub, setSub] = useState<Subscription>(seedSub);
  const [list, setList] = useState<Charge[]>(seedCharges);
  const [cycle, setCycle] = useState<Cycle>("월");
  const [pick, setPick] = useState<PlanId | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [demo, setDemo] = useState(false);

  // 예시를 켜면 상태 카드까지 함께 바꾼다. 실패 배너만 띄우고 "무료 · 카드 없음"을
  // 그대로 두면 앞뒤가 맞지 않는 화면이 된다.
  const view = demo ? DEMO_SUB : sub;
  const plan = planOf(view.planId);
  const daysLeft = diffDays(TODAY, view.expiresAt);
  const failed = list.find((c) => c.status === "결제실패");
  const retries = failed?.code ? retrySchedule(failed.at.slice(0, 10), failed.code) : [];
  const graceEnd = failed ? graceEndsAt(failed.at.slice(0, 10)) : null;
  const graceLeft = graceEnd ? diffDays(TODAY, graceEnd) : 0;
  const noticeDue = sub.nextChargeAt ? diffDays(TODAY, sub.nextChargeAt) <= NOTICE_DAYS_BEFORE : false;

  const cycleDays = sub.cycle === "년" ? 365 : 30;
  const remainingDays = Math.max(0, diffDays(TODAY, sub.expiresAt));
  /**
   * 환불 계산은 정가가 아니라 실제로 낸 마지막 결제를 근거로 한다.
   * 플랜을 올리며 차액만 낸 회원에게 정가를 돌려주면 안 된다.
   * 쓴 날짜도 구독 시작일이 아니라 그 결제일부터 센다.
   */
  const lastPaid = list.find((c) => c.status === "결제완료");
  const usedDays = lastPaid ? Math.max(0, diffDays(lastPaid.at.slice(0, 10), TODAY)) : 0;
  const refundable = lastPaid ? refundOnCancel(lastPaid.amount, usedDays, cycleDays) : 0;

  /**
   * 플랜을 바꿀 때 지금 받을 금액.
   * 올릴 때만 남은 기간 차액을 받고, 내릴 때는 받지 않는다 — 이미 낸 돈으로
   * 기한까지 쓰고 다음 결제일부터 싼 플랜이 적용된다.
   */
  const changeCharge = (to: PlanId) =>
    sub.planId === "free"
      ? priceOf(to, cycle)
      : proratedCharge(priceOf(to, sub.cycle), priceOf(sub.planId, sub.cycle), remainingDays, cycleDays);

  /** 결제수단 등록 → 그 자리에서 첫 결제 → 구독 시작 */
  const subscribe = (planId: PlanId) => {
    const p = planOf(planId);
    const changing = sub.planId !== "free";
    const amount = changing ? changeCharge(planId) : priceOf(planId, cycle);
    const start = sub.startedAt ?? TODAY;
    // 쓰던 중이면 결제 주기를 흔들지 않는다. 기한과 다음 결제일은 그대로 두고 플랜만 바꾼다.
    const next = changing ? sub.nextChargeAt : nextChargeDate(TODAY, anchorDayOf(TODAY), cycle === "년" ? 12 : 1);
    setSub({
      planId,
      cycle: changing ? sub.cycle : cycle,
      autoRenew: true,
      startedAt: start,
      expiresAt: changing ? sub.expiresAt : next!,
      nextChargeAt: next,
      card: sub.card ?? DEMO_CARD,
      cancelAt: null,
    });
    if (amount > 0) {
      setList((xs) => [
        {
          id: `c${Date.now()}`,
          orderId: orderId("m001", planId, changing ? sub.cycle : cycle, TODAY),
          at: `${TODAY} 09:00`,
          planId,
          planName: changing ? `${p.name} (남은 ${remainingDays}일 차액)` : p.name,
          cycle: changing ? sub.cycle : cycle,
          amount,
          status: "결제완료",
          method: maskCard(sub.card ?? DEMO_CARD),
          receiptUrl: "#",
        },
        ...xs,
      ]);
    }
    setPick(null);
    toast({
      message: changing
        ? amount > 0
          ? `${p.name}로 올렸습니다. 남은 ${remainingDays}일 차액 ${formatWon(amount)}을 결제했습니다.`
          : `${p.name}로 바꿨습니다. 지금 청구되는 금액은 없고 ${next ? formatKoDate(next) : "다음 결제일"}부터 적용됩니다.`
        : `${p.name} ${cycle} 이용권을 시작했습니다. 다음 결제는 ${next ? formatKoDate(next) : "-"}입니다.`,
    });
  };

  const shownCharges = demo ? DEMO_CHARGES : list;

  return (
    <>
      <PageHead
        title="이용권"
        desc="플랜과 자동결제를 관리합니다. 카드 정보는 결제 대행사에 저장되고 이 서비스는 보관하지 않습니다."
        actions={
          <Switch checked={demo} onChange={setDemo} label="결제 실패 예시 보기" />
        }
      />

      {/* 결제 실패 — 무엇이 언제 멈추는지부터 말한다 */}
      {demo && (
        <div className="mb-16">
          <Banner
            tone="danger"
            title="7월 31일 결제가 실패했습니다 — 카드 잔액이나 한도가 부족합니다"
            body={
              <>
                {`${GRACE_DAYS}일 동안은 이미 예약된 자동발송이 그대로 나갑니다. `}
                <b>8월 7일</b>까지 해결되지 않으면 자동발송이 멈춥니다.
                <div className="mt-8 small">
                  다시 시도할 날: {retrySchedule("2026-07-31", "insufficient").map((d) => formatKoDate(d)).join(" · ")}
                </div>
              </>
            }
            actions={
              <button type="button" className="btn btn--sm" onClick={() => setCardOpen(true)}>
                <Icon name="card" size={14} /> 카드 바꾸기
              </button>
            }
          />
        </div>
      )}

      {/* 현재 상태 */}
      <section className="card mb-16" style={{ borderColor: view.planId === "free" && daysLeft <= 30 ? "#f1d49a" : undefined }}>
        <div className="card__body">
          <div className="row row--between" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="muted small">현재 플랜</div>
              <div className="row" style={{ gap: 10 }}>
                <span className="hero-num" style={{ fontSize: 28 }}>{plan.name}</span>
                {view.planId !== "free" && <Badge tone="good" dot>{view.cycle} 결제</Badge>}
                {view.cancelAt && <Badge tone="warn">해지 예약</Badge>}
              </div>
              <div className="small mt-8">
                이용기한 <b>{formatKoDate(view.expiresAt, true)}</b>
                <span className={`dday${daysLeft <= 30 ? " dday--soon" : ""}`} style={{ marginLeft: 8 }}>D-{daysLeft}</span>
              </div>
            </div>

            <div style={{ minWidth: 240 }}>
              {view.planId === "free" ? (
                <div className="small" style={{ color: "var(--warn)" }}>
                  만료되면 <b>자동발송이 멈춥니다.</b> 계약일·잔금일 안내가 고객에게 나가지 않습니다. 로그인과 조회는 계속됩니다.
                </div>
              ) : view.autoRenew ? (
                <dl className="kv">
                  <dt>다음 결제</dt>
                  <dd>
                    <b>{view.nextChargeAt ? formatKoDate(view.nextChargeAt, true) : "—"}</b> · {formatWon(priceOf(view.planId, view.cycle))}
                  </dd>
                  <dt>결제수단</dt>
                  <dd>{view.card ? maskCard(view.card) : <span className="muted">없음</span>}</dd>
                </dl>
              ) : (
                <div className="small muted">자동결제가 꺼져 있습니다. 기한이 지나면 무료로 내려갑니다.</div>
              )}
            </div>
          </div>

          {view.planId !== "free" && noticeDue && view.autoRenew && (
            <div className="mt-12">
              <Banner
                tone="info"
                title={`${formatKoDate(view.nextChargeAt!)}에 ${formatWon(priceOf(view.planId, view.cycle))}이 결제됩니다`}
                body={`정기결제는 결제 ${NOTICE_DAYS_BEFORE}일 전에 미리 알려 드립니다. 원치 않으면 그전에 해지하면 청구되지 않습니다.`}
              />
            </div>
          )}
        </div>
      </section>

      {/* 플랜 고르기 */}
      {!demo && (
        <section className="card mb-16">
          <div className="card__head">
            <h2>플랜</h2>
            <div className="chips" role="group" aria-label="결제 주기">
              {(["월", "년"] as Cycle[]).map((c) => (
                <button key={c} type="button" className={`chip${cycle === c ? " is-on" : ""}`} aria-pressed={cycle === c} onClick={() => setCycle(c)}>
                  {c} 결제{c === "년" && yearlyFreeMonths("basic") > 0 ? ` · ${yearlyFreeMonths("basic")}개월 무료` : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="card__body">
            <div className="plan-grid">
              {PLANS.map((p) => {
                const price = priceOf(p.id, cycle);
                const current = p.id === sub.planId;
                const up = priceOf(p.id, sub.cycle) > priceOf(sub.planId, sub.cycle);
                return (
                  <div key={p.id} className={`plan${current ? " is-current" : ""}`}>
                    <div className="plan__head">
                      <b>{p.name}</b>
                      {current && <Badge tone="outline">이용 중</Badge>}
                    </div>
                    <div className="plan__price">
                      {price === 0 ? "0원" : formatWon(price)}
                      <span className="muted small"> / {cycle}</span>
                    </div>
                    <div className="muted small">{p.desc}</div>
                    <ul className="plan__limits">
                      {p.limits.map((l) => (
                        <li key={l}>
                          <Icon name="check" size={13} /> {l}
                        </li>
                      ))}
                    </ul>
                    {p.id !== "free" && !current && (
                      <button type="button" className={`btn btn--sm${up ? " btn--primary" : ""}`} onClick={() => setPick(p.id)}>
                        {sub.planId === "free" ? (sub.card ? `${p.name} 시작` : "카드 등록하고 시작") : up ? `${p.name}${euro(p.name)} 올리기` : `${p.name}${euro(p.name)} 내리기`}
                      </button>
                    )}
                    {p.id === "free" && sub.planId !== "free" && sub.autoRenew && (
                      <button type="button" className="btn btn--sm" onClick={() => setCancelOpen(true)}>무료로 내리기</button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="help mt-12">
              표시 금액은 부가세 포함입니다. 카드 결제는 매출전표가 세금계산서를 대신하므로 따로 발행하지 않습니다.
              {sub.planId !== "free" && " 플랜을 올리면 남은 기간만큼만 더 받고, 내리는 것은 다음 결제일부터 적용됩니다."}
            </p>
          </div>
        </section>
      )}

      {/* 결제수단 */}
      {!demo && (
      <section className="card mb-16">
        <div className="card__head">
          <h2>결제수단</h2>
          {sub.card ? <Badge tone="good" dot>등록됨</Badge> : <Badge tone="neutral">없음</Badge>}
        </div>
        <div className="card__body">
          {sub.card ? (
            <div className="row row--between" style={{ gap: 12, flexWrap: "wrap" }}>
              <span className="row" style={{ gap: 10 }}>
                <Icon name="card" size={18} />
                <span>
                  <b>{maskCard(sub.card)}</b>
                  <div className="muted small">{sub.card.billingKeyAt} 등록</div>
                </span>
              </span>
              <span className="row">
                <button type="button" className="btn btn--sm" onClick={() => setCardOpen(true)}>카드 바꾸기</button>
                {!sub.autoRenew && (
                  <button type="button" className="btn btn--sm" onClick={() => { setSub((s) => ({ ...s, card: null })); toast("결제수단을 삭제했습니다."); }}>
                    삭제
                  </button>
                )}
              </span>
            </div>
          ) : (
            <div className="row row--between" style={{ gap: 12, flexWrap: "wrap" }}>
              <span className="muted">등록된 카드가 없습니다.</span>
              <button type="button" className="btn btn--sm" onClick={() => setCardOpen(true)}>
                <Icon name="plus" size={14} /> 카드 등록
              </button>
            </div>
          )}
          <p className="help mt-12">
            <Icon name="lock" size={12} /> 카드번호·유효기간·CVC 는 결제 대행사 화면에서 직접 입력하고, 부동산TALK 서버는 대행사가 돌려준 결제키만 보관합니다.
            법으로 가맹점이 카드 정보를 저장할 수 없게 되어 있습니다.
          </p>
        </div>
      </section>
      )}

      {/* 결제 내역 */}
      <section className="card mb-16">
        <div className="card__head">
          <h2>결제 내역</h2>
          {demo && <Badge tone="warn">예시</Badge>}
        </div>
        {shownCharges.length === 0 ? (
          <div className="card__body">
            <EmptyState icon="card" title="아직 결제한 내역이 없습니다" desc="무료 체험 중입니다. 플랜을 시작하면 여기에 영수증이 쌓입니다." />
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>상태</th>
                  <th>내용</th>
                  <th className="th-right">금액</th>
                  <th>결제수단 · 사유</th>
                  <th className="th-right">영수증</th>
                </tr>
              </thead>
              <tbody>
                {shownCharges.map((c) => {
                  const vat = vatBreakdown(c.amount);
                  const reason = c.code ? PAY_FAIL_REASONS[c.code] : null;
                  return (
                    <tr key={c.id}>
                      <td className="num nowrap">{c.at}</td>
                      <td><Badge tone={STATUS_TONE[c.status]} dot>{c.status}</Badge></td>
                      <td>
                        <div className="cell-title">{c.planName} {c.cycle} 이용권</div>
                        <div className="cell-sub mono">{c.orderId}{c.attempt ? ` · ${c.attempt}번째 재시도` : ""}</div>
                      </td>
                      <td className="td-num nowrap">
                        {formatWon(c.amount)}
                        <div className="cell-sub">공급가 {formatWon(vat.supply)} · 부가세 {formatWon(vat.vat)}</div>
                      </td>
                      <td>
                        {reason ? (
                          <span>
                            <span className="danger">{reason.title}</span>
                            <div className="muted small">{reason.detail}</div>
                            {failPolicy(c.code!) === "card" && <div className="small">같은 카드로는 다시 시도하지 않습니다.</div>}
                          </span>
                        ) : (
                          <span className="muted small">{c.method ?? "—"}</span>
                        )}
                      </td>
                      <td className="td-num">
                        {c.receiptUrl ? (
                          <a className="link small" href={c.receiptUrl} onClick={(e) => { e.preventDefault(); toast({ tone: "info", message: "결제 대행사의 영수증 페이지로 이동합니다. (프로토타입)" }); }}>
                            보기 <Icon name="external" size={11} />
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {retries.length > 0 && !demo && (
          <div className="card__body" style={{ paddingTop: 0 }}>
            <p className="help">다시 시도할 날: {retries.map((d) => formatKoDate(d)).join(" · ")}</p>
          </div>
        )}
      </section>

      {/* 사용기한 부여 내역 (운영자 보정 포함) */}
      <section className="card mb-16">
        <div className="card__head">
          <h2>사용기한 내역</h2>
          <span className="muted small">무료 부여와 운영자 보정을 포함합니다</span>
        </div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>처리일</th>
                <th>구분</th>
                <th>내용</th>
                <th className="th-right">변동 일수</th>
                <th>이전</th>
                <th>적용 후</th>
              </tr>
            </thead>
            <tbody>
              {legacy.history.map((h, i) => (
                <tr key={i}>
                  <td className="num nowrap">{h.date}</td>
                  <td><Badge tone={h.kind.includes("보정") ? "warn" : "good"}>{h.kind}</Badge></td>
                  <td>{h.desc}</td>
                  <td className="td-num" style={{ color: h.delta < 0 ? "var(--danger)" : "var(--good)", fontWeight: 600 }}>
                    {h.delta > 0 ? "+" : ""}{h.delta}일
                  </td>
                  <td className="num muted">{h.before}</td>
                  <td className="num">{h.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card__body" style={{ paddingTop: 0 }}>
          <p className="help">'보정'은 운영자의 오류를 바로잡거나 회원과 합의한 내용을 반영하기 위한 처리입니다.</p>
        </div>
      </section>

      {/* 해지 — 감추지 않는다 */}
      {!demo && sub.planId !== "free" && sub.autoRenew && (
        <section className="card">
          <div className="card__body row row--between" style={{ gap: 12, flexWrap: "wrap" }}>
            <span>
              <b>자동결제 해지</b>
              <div className="muted small">
                {formatKoDate(sub.expiresAt, true)}까지 그대로 쓰고 그 뒤로 무료로 내려갑니다. 다음 결제부터 청구되지 않습니다.
              </div>
            </span>
            <button type="button" className="btn btn--sm" onClick={() => setCancelOpen(true)}>해지</button>
          </div>
        </section>
      )}

      {/* 카드 등록 */}
      <Modal open={cardOpen} onClose={() => setCardOpen(false)} title="결제수단 등록">
        <div className="stack" style={{ gap: 14 }}>
          <Banner
            tone="info"
            icon="lock"
            title="카드 정보는 부동산TALK을 거치지 않습니다"
            body="다음 화면은 결제 대행사(포트원·토스페이먼츠)가 띄우는 창입니다. 카드번호는 그쪽에 바로 들어가고, 부동산TALK은 결제에 쓸 키와 카드사·뒤 4자리만 돌려받습니다."
          />
          <dl className="kv">
            <dt>정기결제 방식</dt>
            <dd>등록한 카드로 {cycle === "년" ? "해마다" : "달마다"} 같은 날 자동 결제</dd>
            <dt>해지</dt>
            <dd>언제든 이 화면에서. 해지하면 다음 결제부터 청구되지 않습니다</dd>
            <dt>결제 전 고지</dt>
            <dd>결제 {NOTICE_DAYS_BEFORE}일 전에 알림톡과 화면으로 알려 드립니다</dd>
          </dl>
          <div className="row row--end">
            <button type="button" className="btn" onClick={() => setCardOpen(false)}>취소</button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setSub((s) => ({ ...s, card: { ...DEMO_CARD, billingKeyAt: TODAY } }));
                setCardOpen(false);
                toast({ message: `${maskCard(DEMO_CARD)} 를 등록했습니다.` });
              }}
            >
              <Icon name="external" size={14} /> 결제창 열기
            </button>
          </div>
        </div>
      </Modal>

      {/* 결제 확인 */}
      <ConfirmModal
        open={!!pick}
        onClose={() => setPick(null)}
        title={pick ? (sub.planId === "free" ? `${planOf(pick).name} ${cycle} 이용권을 시작합니다` : `${planOf(sub.planId).name} → ${planOf(pick).name}`) : ""}
        description={
          !sub.card
            ? "먼저 카드를 등록해야 합니다. 결제 대행사 창이 열립니다."
            : sub.planId === "free"
              ? "등록된 카드로 지금 결제되고, 이후 같은 날 자동으로 갱신됩니다."
              : changeCharge(pick ?? sub.planId) > 0
                ? `이용기한(${formatKoDate(sub.expiresAt)})은 그대로 두고 남은 기간 차액만 지금 받습니다.`
                : "지금 청구되는 금액은 없습니다. 이미 낸 기간은 그대로 쓰고 다음 결제일부터 새 플랜이 적용됩니다."
        }
        summary={
          pick
            ? (() => {
                const amount = changeCharge(pick);
                const v = vatBreakdown(amount);
                const next = sub.planId === "free" ? nextChargeDate(TODAY, anchorDayOf(TODAY), cycle === "년" ? 12 : 1) : sub.nextChargeAt;
                const rows = [{ k: "플랜", v: `${planOf(pick).name} · ${sub.planId === "free" ? cycle : sub.cycle} 결제` }];
                if (sub.planId !== "free") rows.push({ k: "남은 기간", v: `${remainingDays}일 / ${cycleDays}일` });
                if (amount > 0) rows.push({ k: "공급가액", v: formatWon(v.supply) }, { k: "부가세", v: formatWon(v.vat) });
                rows.push(
                  { k: "지금 결제", v: amount > 0 ? formatWon(amount) : "없음" },
                  { k: "다음 결제일", v: next ? `${formatKoDate(next, true)} · ${formatWon(priceOf(pick, sub.planId === "free" ? cycle : sub.cycle))}` : "—" },
                  { k: "결제수단", v: sub.card ? maskCard(sub.card) : "등록 필요" },
                );
                return rows;
              })()
            : undefined
        }
        confirmLabel={
          !sub.card ? "카드 등록하러 가기" : pick && changeCharge(pick) > 0 ? `${formatWon(changeCharge(pick))} 결제` : "플랜 바꾸기"
        }
        onConfirm={() => {
          if (!pick) return;
          if (!sub.card) {
            setPick(null);
            setCardOpen(true);
            return;
          }
          subscribe(pick);
        }}
      />

      {/* 해지 확인 */}
      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        danger
        title="자동결제를 해지할까요?"
        description={
          <>
            이미 결제한 기간은 <b>{formatKoDate(sub.expiresAt)}까지 그대로</b> 쓸 수 있고, 환불은 없습니다. 그 뒤로 무료 플랜이 되어 자동발송이 멈춥니다.
            {refundable > 0 && (
              <div className="mt-8 small muted">
                지금 바로 끊고 남은 기간을 돌려받고 싶으면 문의/제안으로 알려 주세요. 마지막 결제 {formatWon(lastPaid!.amount)} 중 오늘 기준 {formatWon(refundable)}이 환불 대상입니다.
              </div>
            )}
          </>
        }
        summary={[
          { k: "쓸 수 있는 기한", v: formatKoDate(sub.expiresAt, true) },
          { k: "앞으로 청구", v: "없음" },
          { k: "기한 이후", v: "무료 플랜 · 자동발송 중단" },
        ]}
        confirmLabel="자동결제 해지"
        onConfirm={() => {
          setCancelOpen(false);
          setSub((s) => ({ ...s, autoRenew: false, nextChargeAt: null, cancelAt: s.expiresAt }));
          toast({
            message: `자동결제를 해지했습니다. ${formatKoDate(sub.expiresAt)}까지 그대로 쓸 수 있습니다.`,
            action: { label: "실행 취소", onClick: () => { setSub(seedSub); toast({ tone: "info", message: "해지를 취소했습니다." }); } },
          });
        }}
      />
    </>
  );
}
