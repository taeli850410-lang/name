"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, StatTile } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { MonthCalendar } from "@/components/dashboard/MonthCalendar";
import { NoticeAccordion } from "@/components/dashboard/NoticeAccordion";
import { Sparkline } from "@/components/charts/Charts";
import { customers } from "@/data/customers";
import { properties } from "@/data/properties";
import { notices } from "@/data/notices";
import { karma } from "@/data/notices";
import { systemStatus, usage } from "@/data/system";
import { subscription } from "@/data/billing";
import { monthlySends, FAIL_REASONS } from "@/data/sends";
import { registryProgram } from "@/data/registry";
import { activeDeals, calendarEvents, failedSummary, registrySummary, todaysAppointments, todaysSends, upcoming } from "@/lib/derive";
import { formatKoDate, formatShortDate, formatTimeKo, formatWon, relativeDay, TODAY } from "@/lib/format";

/**
 * 중개사 대시보드.
 * 첫 줄이 '오늘 할 일'로 시작한다: 약속 · 발송 예정 · 실패한 발송 · 등기 변동.
 * 배너는 이상이 있을 때만, 캘린더는 하나로, 유익한 사이트는 별도 메뉴로.
 */
export default function AgentDashboard() {
  const toast = useToast();
  const [retryOpen, setRetryOpen] = useState(false);
  const [retried, setRetried] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);

  const todayAppts = todaysAppointments();
  const sends = todaysSends();
  const failed = failedSummary();
  const reg = registrySummary();
  const events = useMemo(() => calendarEvents(), []);
  const next = useMemo(() => upcoming(14).filter((e) => !(e.kind === "appt" && e.date === TODAY)).slice(0, 7), []);
  const vendorDown = systemStatus.balsongking.status !== "ok";
  const active = activeDeals();
  const newCustomers30 = customers.filter((c) => c.createdAt >= "2026-08-13").length;

  const retryable = retried ? 0 : failed.retryable;

  return (
    <>
      {vendorDown && !bannerOff && (
        <div className="mb-16">
          <Banner
            tone="danger"
            title={`알림톡 발송이 ${systemStatus.balsongking.since.slice(11)}부터 보류되고 있습니다 · 보류 ${systemStatus.balsongking.affected}건`}
            body={`${systemStatus.balsongking.reason} ${systemStatus.balsongking.impact}`}
            actions={
              <>
                <Link href="/agent/alimtalk/history?status=failed" className="btn btn--sm">
                  발송 내역
                </Link>
                <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => setBannerOff(true)} aria-label="배너 닫기">
                  <Icon name="x" size={16} />
                </button>
              </>
            }
          />
        </div>
      )}

      <div className="section-label">
        오늘 할 일 <span className="date">{formatKoDate(TODAY, true)}</span>
      </div>
      <div className="tiles mb-24">
        <StatTile
          label="오늘 약속"
          icon="calendar"
          value={todayAppts.length}
          unit="건"
          href={`/agent/appointments?date=${TODAY}`}
          tone={todayAppts.length ? "brand" : undefined}
          sub={todayAppts.length ? todayAppts.map((a) => `${a.time} ${a.customerName} ${a.type}`).join(" · ") : "등록된 약속 없음"}
        />
        <StatTile label="오늘 발송 예정" icon="send" value={sends.pending} unit="건" href="/agent/alimtalk/history?status=scheduled" sub={sends.tomorrow ? `내일 ${sends.tomorrow}건 · 잔금일 안내` : "예정 없음"} />
        <StatTile
          label="실패한 발송 (7일)"
          icon="alertTriangle"
          value={failed.total}
          unit="건"
          href="/agent/alimtalk/history?status=failed"
          tone={failed.total ? "danger" : "good"}
          sub={failed.total ? `다시 보낼 수 있는 ${retryable}건` : "실패 없음"}
        />
        <StatTile
          label="등기부 변동"
          icon="shield"
          value={reg.changed}
          unit="건"
          href="/agent/registry"
          tone={reg.failed ? "warn" : undefined}
          sub={reg.failed ? `감시 ${reg.watching}건 · 오늘 조회 실패 ${reg.failed}건` : `감시 ${reg.watching}건 · 정상 작동`}
        />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          {/* 다가오는 일정 */}
          <section className="card">
            <div className="card__head">
              <h2>
                다가오는 일정 <span className="sub">앞으로 14일</span>
              </h2>
              <Link href="/agent/appointments" className="btn btn--ghost btn--sm">
                전체 보기 <Icon name="chevronRight" size={14} />
              </Link>
            </div>
            <div className="list">
              {next.map((e, i) => (
                <Link key={i} href={e.href} className="list__item">
                  <span className="when">
                    <b>{formatShortDate(e.date)}</b>
                    {e.time ? formatTimeKo(e.time) : relativeDay(e.date)}
                  </span>
                  <span className="what">
                    <div className="t">{e.title}</div>
                    <div className="s">{e.sub}</div>
                  </span>
                  <Badge tone={e.kind === "appt" ? "warn" : e.kind === "deal" ? "info" : "good"} dot>
                    {e.kind === "appt" ? "약속" : e.kind === "deal" ? "계약 일정" : "발송"}
                  </Badge>
                  <span className="go">
                    <Icon name="chevronRight" size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* 자주 쓰는 작업 */}
          <div>
            <div className="section-label">자주 쓰는 작업</div>
            <div className="quick">
              <Link href="/agent/customers?new=1" className="is-primary">
                <span className="ic">
                  <Icon name="plus" size={18} />
                </span>
                고객 등록
              </Link>
              <Link href="/agent/properties?new=1">
                <span className="ic">
                  <Icon name="building" size={18} />
                </span>
                물건 등록
              </Link>
              <Link href="/agent/deals?new=1">
                <span className="ic">
                  <Icon name="file" size={18} />
                </span>
                계약 등록
              </Link>
              <Link href="/agent/alimtalk/send">
                <span className="ic">
                  <Icon name="send" size={18} />
                </span>
                지금 발송
              </Link>
            </div>
          </div>

          {/* 실패한 발송 */}
          {failed.batches.length > 0 && (
            <section className="card">
              <div className="card__head">
                <h2>
                  실패한 발송 <span className="sub">최근 7일 · {failed.total}건</span>
                </h2>
                <button type="button" className="btn btn--primary btn--sm" disabled={retryable === 0} onClick={() => setRetryOpen(true)}>
                  <Icon name="refresh" size={14} /> 실패 건 다시 보내기 ({retryable})
                </button>
              </div>
              <div className="card__body--flush">
                {failed.batches.map((b) => {
                  const codes = Array.from(new Set(b.items.filter((i) => i.code).map((i) => i.code!)));
                  return (
                    <Link key={b.id} href={`/agent/alimtalk/history?focus=${b.id}`} className="list__item">
                      <span className="when">
                        <b>{formatShortDate(b.scheduledAt.slice(0, 10))}</b>
                        {formatTimeKo(b.scheduledAt.slice(11))}
                      </span>
                      <span className="what">
                        <div className="t">
                          {b.templateName} · {b.total}명 중 실패 {b.failed}
                        </div>
                        <div className="s">{codes.map((c) => FAIL_REASONS[c].title).join(" / ")}</div>
                      </span>
                      <Badge tone={codes.some((c) => FAIL_REASONS[c].retryable) ? "danger" : "neutral"}>{codes.some((c) => FAIL_REASONS[c].retryable) ? "재시도 가능" : "재시도 불가"}</Badge>
                    </Link>
                  );
                })}
              </div>
              <div className="card__foot">
                <span>실패 사유는 사람이 읽는 문장으로 표시하고, 기술 원문은 발송 내역의 '자세히'에서 볼 수 있습니다.</span>
              </div>
            </section>
          )}

          {/* 내 현황 */}
          <section className="card">
            <div className="card__head">
              <h2>내 현황</h2>
              <span className="muted small">이번 달 발송 {monthlySends.thisMonth}건 · 지난달 {monthlySends.lastMonth}건</span>
            </div>
            <div className="stats-inline">
              <Link href="/agent/customers">
                <div className="k">고객</div>
                <div className="v">
                  {customers.length}
                  <small>명</small>
                </div>
                <div className="small muted">최근 30일 +{newCustomers30}</div>
              </Link>
              <Link href="/agent/properties">
                <div className="k">물건</div>
                <div className="v">
                  {properties.length}
                  <small>건</small>
                </div>
                <div className="small muted">공실 {properties.filter((p) => p.tenantStatus === "공실").length}</div>
              </Link>
              <Link href="/agent/deals?status=active">
                <div className="k">진행 중 계약</div>
                <div className="v">
                  {active.length}
                  <small>건</small>
                </div>
                <div className="small muted">의뢰 {active.filter((d) => d.status === "의뢰").length} · 계약 {active.filter((d) => d.status === "계약").length}</div>
              </Link>
              <Link href="/agent/alimtalk/history">
                <div className="k">이번 달 발송</div>
                <div className="v">
                  {monthlySends.thisMonth}
                  <small>건</small>
                </div>
                <Sparkline values={[31, 44, 38, 52, 47, 61, 55, 73, 68, 84, 79, 96]} />
              </Link>
            </div>
          </section>

          {/* 공지 */}
          <section className="card">
            <div className="card__head">
              <h2>
                공지사항 <span className="sub">읽지 않음 {notices.filter((n) => n.unread).length}</span>
              </h2>
              <Link href="/agent/notices" className="btn btn--ghost btn--sm">
                전체 보기 <Icon name="chevronRight" size={14} />
              </Link>
            </div>
            <NoticeAccordion items={notices.slice(0, 3)} />
          </section>
        </div>

        <div className="dash-col">
          <section className="card">
            <MonthCalendar events={events} />
          </section>

          <section className="card">
            <div className="card__head">
              <h2>알림</h2>
            </div>
            <div className="alerts">
              {vendorDown && (
                <Link href="/agent/alimtalk/history?status=failed" className="alert-i">
                  <span className="ic ic--danger">
                    <Icon name="alertTriangle" size={15} />
                  </span>
                  <span>
                    <div className="t">발송 대행사 장애 · 보류 {systemStatus.balsongking.affected}건</div>
                    <div className="s">{systemStatus.balsongking.since.slice(5)}부터 · 복구 후 자동 재시도</div>
                  </span>
                </Link>
              )}
              {karma.needResponse > 0 && (
                <Link href="/agent/karma?tab=received" className="alert-i">
                  <span className="ic ic--warn">
                    <Icon name="heart" size={15} />
                  </span>
                  <span>
                    <div className="t">채널 품앗이 · 응대 필요 {karma.needResponse}건</div>
                    <div className="s">{karma.received[0].office}이(가) 내 채널을 추가했습니다</div>
                  </span>
                </Link>
              )}
              <Link href="/agent/registry" className="alert-i">
                <span className={`ic ${reg.failed ? "ic--warn" : "ic--good"}`}>
                  <Icon name="shield" size={15} />
                </span>
                <span>
                  <div className="t">등기부 감시 프로그램 작동 중</div>
                  <div className="s">
                    마지막 응답 {registryProgram.lastPing.slice(5)} · 다음 조회 내일 {registryProgram.schedule[0]}
                    {reg.failed ? ` · 오늘 실패 ${reg.failed}건` : ""}
                  </div>
                </span>
              </Link>
              <Link href="/agent/billing" className="alert-i">
                <span className={`ic ${usage.daysLeft <= 30 ? "ic--warn" : "ic--info"}`}>
                  <Icon name="card" size={15} />
                </span>
                <span>
                  <div className="t">
                    이용기한 {usage.expiresAt.slice(5)}까지 · D-{usage.daysLeft}
                  </div>
                  <div className="s">
                    {subscription.autoRenew && subscription.nextChargeAt
                      ? `${usage.plan} 이용 중 · ${subscription.nextChargeAt.slice(5)} 자동결제`
                      : `${usage.plan} 이용 중 · 자동결제 꺼짐 — 만료되면 자동발송이 멈춥니다`}
                  </div>
                </span>
              </Link>
              <div className="alert-i">
                <span className={`ic ${systemStatus.balsongking.balance === null ? "ic--warn" : "ic--info"}`}>
                  <Icon name="activity" size={15} />
                </span>
                <span>
                  <div className="t">
                    발송킹 예치금 {systemStatus.balsongking.balance === null ? "조회 실패" : formatWon(systemStatus.balsongking.balance)}
                  </div>
                  <div className="s">
                    마지막 확인 {systemStatus.balsongking.balanceCheckedAt.slice(5)} 기준 {formatWon(systemStatus.balsongking.lastBalance)}
                  </div>
                </span>
                <button type="button" className="btn btn--sm go" onClick={() => toast({ tone: "danger", message: "예치금 조회에 실패했습니다. 대행사 서버 문제로 지금은 확인할 수 없습니다." })}>
                  다시 조회
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmModal
        open={retryOpen}
        onClose={() => setRetryOpen(false)}
        title={`실패한 발송 ${retryable}건을 다시 보냅니다`}
        description="대행사 장애로 실패한 건은 복구 직후 자동으로 발송되고, 결과확인 시간초과 건은 지금 바로 다시 요청합니다. 수신 거부·번호 오류 건은 제외됩니다."
        summary={[
          { k: "대상", v: `${retryable}명` },
          { k: "템플릿", v: "전문가 칼럼 알림 외 1종" },
          { k: "예상 비용", v: formatWon(failed.cost) },
        ]}
        confirmLabel={`${retryable}건 다시 보내기`}
        onConfirm={() => {
          setRetryOpen(false);
          setRetried(true);
          toast({ message: `${retryable}건을 다시 보내도록 예약했습니다.`, action: { label: "실행 취소", onClick: () => setRetried(false) } });
        }}
      />
    </>
  );
}
