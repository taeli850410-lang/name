"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, StatTile } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { BarChart, Sparkline } from "@/components/charts/Charts";
import { adminInquiries, dailySends, dailySignups, expiringSoon, memberCounts, pendingMembers as seedPending, type Member } from "@/data/members";
import { systemStatus } from "@/data/system";
import { dday, formatKoDate, formatNumber, maskPhone, relativeDay, TODAY } from "@/lib/format";

/** 운영 대시보드 — 처리할 일(승인·만료·문의·장애)이 먼저, 현황은 그다음. */
export default function AdminDashboard() {
  const toast = useToast();
  const [pending, setPending] = useState<Member[]>(seedPending);
  const [reject, setReject] = useState<Member | null>(null);
  const [inquiries, setInquiries] = useState(adminInquiries);
  const waiting = inquiries.filter((i) => i.status === "답변대기");
  const total30 = dailySends.reduce((s, d) => s + d.count, 0);
  const peak = dailySends.reduce((m, d) => (d.count > m.count ? d : m), dailySends[0]);
  const vendorDown = systemStatus.balsongking.status !== "ok";
  const signups30 = dailySignups.reduce((s, d) => s + d.count, 0);

  return (
    <>
      {vendorDown && (
        <div className="mb-16">
          <Banner
            tone="danger"
            title={`발송 대행사(발송킹) 장애 · ${systemStatus.balsongking.since.slice(5)}부터 · 전체 회원 발송 보류`}
            body={`${systemStatus.balsongking.detail} — 회원 화면에는 사람이 읽는 문장으로 표시되고 있습니다. 대행사 복구 시 보류 건은 자동 재시도됩니다.`}
            actions={
              <>
                <Link href="/admin/monitor" className="btn btn--sm">상태 상세</Link>
                <Link href="/admin/notices" className="btn btn--sm">회원 공지 갱신</Link>
              </>
            }
          />
        </div>
      )}

      <div className="section-label">처리할 일 <span className="date">{formatKoDate(TODAY, true)}</span></div>
      <div className="tiles mb-24">
        <StatTile label="가입 승인 대기" icon="users" value={pending.length} unit="명" href="/admin/members?plan=미승인" tone={pending.length ? "warn" : "good"} sub={pending.length ? `가장 오래된 요청 ${relativeDay(pending[pending.length - 1].joinedAt)}` : "대기 없음"} />
        <StatTile label="만료 임박 (30일)" icon="clock" value={expiringSoon.length} unit="명" href="/admin/members?expiring=1" tone={expiringSoon.length ? "warn" : undefined} sub={expiringSoon[0] ? `가장 빠른 만료 ${expiringSoon[0].expiresAt!.slice(5)} · ${expiringSoon[0].name}` : "없음"} />
        <StatTile label="답변 대기 문의" icon="message" value={waiting.length} unit="건" href="/admin/inquiries" tone={waiting.length ? "danger" : "good"} sub={waiting[0] ? `${waiting[0].title.slice(0, 22)}…` : "모두 답변함"} />
        <StatTile label="등기 감시 실패" icon="shield" value={systemStatus.registry.failed} unit="건" href="/admin/monitor" tone={systemStatus.registry.failed ? "warn" : undefined} sub={`대기 ${formatNumber(systemStatus.registry.queued)} · 실행 PC ${systemStatus.registry.running}대`} />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <section className="card">
            <div className="card__head">
              <h2>발송 현황 <span className="sub">전체 회원 · 최근 30일</span></h2>
              <div className="row small muted">
                <span>합계 <b className="num" style={{ color: "var(--ink)" }}>{formatNumber(total30)}</b>건</span>
                <span>· 오늘 <b className="num" style={{ color: "var(--ink)" }}>{dailySends[dailySends.length - 1].count}</b>건</span>
                <span>· 최고 {peak.date.slice(5)} {formatNumber(peak.count)}건</span>
              </div>
            </div>
            <div className="card__body">
              <BarChart data={dailySends.map((d) => ({ label: d.date.slice(5), value: d.count, sub: formatKoDate(d.date) }))} highlight={TODAY.slice(5)} />
              <div className="help mt-8">오늘은 12:35 이후 대행사 장애로 발송이 멈춰 평소보다 적습니다. 막대에 마우스를 올리면 날짜별 건수가 보입니다.</div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>가입 승인 대기 <span className="sub">{pending.length}명</span></h2>
              <Link href="/admin/settings" className="link small">자동승인 설정 ›</Link>
            </div>
            {pending.length === 0 ? (
              <div className="card__body muted">대기 중인 가입 요청이 없습니다.</div>
            ) : (
              <div className="list">
                {pending.map((m) => (
                  <div key={m.id} className="list__item">
                    <span className="what">
                      <div className="t">{m.name} · {m.office}</div>
                      <div className="s">{maskPhone(m.phone)} · {m.region} · 신청 {relativeDay(m.joinedAt)}</div>
                    </span>
                    <button type="button" className="btn btn--sm" onClick={() => setReject(m)}>거절</button>
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => { setPending((xs) => xs.filter((x) => x.id !== m.id)); toast({ message: `${m.name} 님을 승인했습니다. 무료 7일이 부여되고 안내 알림이 나갑니다.`, action: { label: "실행 취소", onClick: () => setPending((xs) => [...xs, m]) } }); }}>승인</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <h2>답변 대기 문의 <span className="sub">{waiting.length}건</span></h2>
              <Link href="/admin/inquiries" className="btn btn--ghost btn--sm">전체 보기 <Icon name="chevronRight" size={14} /></Link>
            </div>
            <div className="list">
              {waiting.map((q) => (
                <Link key={q.id} href={`/admin/inquiries?focus=${q.id}`} className="list__item">
                  <Badge tone={q.kind === "오류" ? "danger" : q.kind === "제안" ? "admin" : "info"}>{q.kind}</Badge>
                  <span className="what">
                    <div className="t">{q.title}</div>
                    <div className="s">{q.member} · {q.office} · {relativeDay(q.createdAt)}</div>
                  </span>
                  <span className="go"><Icon name="chevronRight" size={16} /></span>
                </Link>
              ))}
              {waiting.length === 0 && <div className="list__item muted">답변 대기 문의가 없습니다.</div>}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>만료 임박 회원 <span className="sub">30일 이내 {expiringSoon.length}명</span></h2>
              <button type="button" className="btn btn--sm" onClick={() => toast(`${expiringSoon.length}명에게 이용기한 안내 알림톡을 예약했습니다. (대행사 복구 후 발송)`)}><Icon name="send" size={14} /> 연장 안내 보내기</button>
            </div>
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="table table--dense">
                <thead><tr><th>회원</th><th>구분</th><th>사용기한</th><th>고객</th><th>30일 발송</th></tr></thead>
                <tbody>
                  {expiringSoon.slice(0, 6).map((m) => (
                    <tr key={m.id}>
                      <td><div className="cell-title">{m.name}</div><div className="cell-sub">{m.office}</div></td>
                      <td><Badge tone={m.plan === "유료" ? "info" : "neutral"}>{m.plan}</Badge></td>
                      <td className="num nowrap">{m.expiresAt} <span className="dday dday--soon">{dday(m.expiresAt!)}</span></td>
                      <td className="num">{m.customers}</td>
                      <td className="num">{m.sends30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="dash-col">
          <section className="card">
            <div className="card__head"><h2>회원 현황</h2><Link href="/admin/members" className="link small">회원 관리 ›</Link></div>
            <div className="card__body stack" style={{ gap: 10 }}>
              {[
                ["전체", memberCounts.total, "neutral"],
                ["유료", memberCounts.paid, "info"],
                ["무료", memberCounts.free, "good"],
                ["만료", memberCounts.expired, "warn"],
                ["미승인", memberCounts.pending, "danger"],
                ["운영자", memberCounts.admin, "admin"],
              ].map(([l, n, t]) => (
                <Link key={String(l)} href={l === "전체" ? "/admin/members" : `/admin/members?plan=${l}`} className="row row--between">
                  <span className="row"><Badge tone={t as "neutral"}>{l}</Badge></span>
                  <span className="grow" style={{ margin: "0 12px" }}>
                    <span className="progress"><i className="ok" style={{ width: `${(Number(n) / memberCounts.total) * 100}%`, background: l === "전체" ? "var(--series-1)" : "var(--series-soft)" }} /></span>
                  </span>
                  <b className="num">{n}</b>
                </Link>
              ))}
              <div className="row row--between mt-8 small muted">
                <span>최근 30일 가입 <b className="num" style={{ color: "var(--ink)" }}>{signups30}</b>명</span>
                <Sparkline values={dailySignups.map((d) => d.count)} width={110} height={26} />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head"><h2>시스템 상태</h2><Link href="/admin/monitor" className="link small">상세 ›</Link></div>
            <div className="alerts">
              <div className="alert-i">
                <span className="ic ic--good"><Icon name="monitor" size={15} /></span>
                <span><div className="t">앱 서버 정상</div><div className="s">마지막 확인 {systemStatus.server.checkedAt.slice(11)}</div></span>
              </div>
              <div className="alert-i">
                <span className={`ic ${vendorDown ? "ic--danger" : "ic--good"}`}><Icon name="send" size={15} /></span>
                <span><div className="t">발송 대행사 {vendorDown ? "장애" : "정상"}</div><div className="s">{vendorDown ? `${systemStatus.balsongking.since.slice(5)}부터 · 보류 누적 중` : "정상 응답"}</div></span>
              </div>
              <div className="alert-i">
                <span className={`ic ${systemStatus.registry.failed ? "ic--warn" : "ic--good"}`}><Icon name="shield" size={15} /></span>
                <span><div className="t">등기 감시 프로그램 {systemStatus.registry.running}대 실행 중</div><div className="s">감시 {formatNumber(systemStatus.registry.watching)} · 대기 {formatNumber(systemStatus.registry.queued)} · 실패 {systemStatus.registry.failed} · 마지막 응답 {systemStatus.registry.lastPing.slice(11)}</div></span>
              </div>
              <div className="alert-i">
                <span className="ic ic--good"><Icon name="refresh" size={15} /></span>
                <span><div className="t">네이버 스마트스토어 동기화</div><div className="s">{systemStatus.naverSync.every}분마다 · 마지막 {systemStatus.naverSync.lastAt.slice(11)} · 미적용 주문 0건</div></span>
              </div>
              <div className="alert-i">
                <span className="ic ic--good"><Icon name="chat" size={15} /></span>
                <span><div className="t">텔레그램 알림 봇 정상</div><div className="s">운영자 알림 수신 중</div></span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head"><h2>운영자 라운지</h2><button type="button" className="btn btn--ghost btn--sm" onClick={() => toast({ tone: "info", message: "운영자 메모 (프로토타입)" })}>더보기</button></div>
            <div className="list">
              <div className="list__item"><Badge tone="admin">개발</Badge><span className="what"><div className="t">발송 실패 사유 매핑표 v2 배포</div><div className="s">박준서 · 09-12</div></span></div>
              <div className="list__item"><Badge tone="admin">개발</Badge><span className="what"><div className="t">품앗이 선팔·맞팔 전환 완료</div><div className="s">박준서 · 09-08</div></span></div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmModal open={!!reject} onClose={() => setReject(null)} danger title={`${reject?.name} 님의 가입을 거절할까요?`} description="거절 사유가 신청자에게 문자로 전달됩니다. 같은 번호로 다시 신청할 수 있습니다." confirmLabel="거절" onConfirm={() => { const m = reject; setReject(null); if (m) { setPending((xs) => xs.filter((x) => x.id !== m.id)); toast(`${m.name} 님의 가입을 거절했습니다.`); } }} />
    </>
  );
}
