"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, PageHead, Switch } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { profile, termsHistory } from "@/data/misc";
import { CUSTOMER_KEYWORDS } from "@/data/customers";
import { systemStatus } from "@/data/system";
import { templates } from "@/data/templates";
import { SMS_COST } from "@/lib/sms";
import { formatPhone, formatWon } from "@/lib/format";

const TABS = [
  { key: "basic", label: "기본 정보" },
  { key: "sending", label: "발송 계정" },
  { key: "integrations", label: "연동" },
  { key: "keywords", label: "메모 키워드" },
  { key: "security", label: "보안" },
  { key: "terms", label: "이용약관" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

/** 나의 정보 — 탭으로 나누고, 수정 중인 섹션에만 저장 바가 뜬다. 비밀값은 기본 마스킹. */
function Settings() {
  const toast = useToast();
  const params = useSearchParams();
  // 다른 화면에서 ?tab=sending 처럼 특정 탭을 바로 열 수 있다
  const [tab, setTab] = useState<TabKey>(() => {
    const t = params.get("tab");
    return TABS.some((x) => x.key === t) ? (t as TabKey) : "basic";
  });
  const [dirty, setDirty] = useState(false);
  const [showBk, setShowBk] = useState(false);
  const [disconnect, setDisconnect] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", again: "" });
  const [phone, setPhone] = useState(formatPhone(profile.phone));
  const [fallback, setFallback] = useState(profile.smsFallback);
  const strength = pw.next.length >= 12 && /[^a-zA-Z0-9]/.test(pw.next) ? "강함" : pw.next.length >= 8 && /\d/.test(pw.next) && /[a-zA-Z]/.test(pw.next) ? "보통" : pw.next ? "약함" : "";

  const mark = () => setDirty(true);
  const save = () => { setDirty(false); toast("저장했습니다."); };

  return (
    <>
      <PageHead title="나의 정보" desc="중개사 기본 정보, 알림톡 발송 계정, 연동, 보안 설정을 관리합니다." />
      <div className="vtabs">
        <nav className="vtabs__nav" aria-label="설정 구분">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? "is-active" : ""} onClick={() => { if (dirty && !confirm("저장하지 않은 변경 사항이 있습니다. 이동할까요?")) return; setDirty(false); setTab(t.key); }} aria-current={tab === t.key ? "page" : undefined}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="stack" style={{ gap: 16 }}>
          {tab === "basic" && (
            <section className="card">
              <div className="card__head"><h2>기본 정보</h2></div>
              <div className="card__body form" style={{ maxWidth: 720 }}>
                <div className="form-grid-2">
                  <div className="field">
                    <label className="label" htmlFor="s-name">대표자명 <span className="req">*</span></label>
                    <input id="s-name" className="input" defaultValue={profile.name} onChange={mark} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="s-office">상호 <span className="req">*</span></label>
                    <input id="s-office" className="input" defaultValue={profile.office} onChange={mark} />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="field">
                    <label className="label" htmlFor="s-phone">휴대폰번호 <span className="req">*</span></label>
                    <input id="s-phone" className="input" type="tel" inputMode="numeric" value={phone} onChange={(e) => { setPhone(e.target.value); mark(); }} />
                    <div className="help">로그인 아이디로 쓰입니다. 바꾸면 다음 로그인부터 새 번호로 로그인합니다.</div>
                    <Switch checked onChange={() => toast({ tone: "info", message: "발신번호는 발송킹에 사전 등록된 번호만 쓸 수 있습니다." })} label="알림톡 발신번호로 사용" />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="s-email">이메일 <span className="req">*</span></label>
                    <input id="s-email" className="input" type="email" defaultValue={profile.email} onChange={mark} />
                  </div>
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-addr">사무실 주소 <span className="req">*</span></label>
                  <div className="input-group">
                    <input id="s-addr" className="input" defaultValue={profile.address} onChange={mark} />
                    <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "우편번호 검색 (프로토타입)" })}><Icon name="search" size={14} /> 검색</button>
                  </div>
                  <div className="help">회원 지도에 정확히 표시하려면 저장 후 '지도에서 위치 지정'을 눌러 주세요. 현재: 정확한 위치 지정됨</div>
                </div>
                <div className="grid-3" style={{ gap: 12 }}>
                  {[
                    ["오시는길 URL", profile.directionsUrl, "알림톡 [오시는길] 버튼"],
                    ["홈페이지 URL", profile.homepageUrl, "알림톡 [홈페이지] 버튼"],
                    ["네이버부동산 URL", profile.naverUrl, "알림톡 [네이버부동산] 버튼"],
                  ].map(([l, v, h]) => (
                    <div key={l} className="field">
                      <label className="label" htmlFor={`s-${l}`}>{l}</label>
                      <input id={`s-${l}`} className="input" defaultValue={v} onChange={mark} />
                      <div className="help">{h} · 저장할 때 자동으로 검증합니다</div>
                    </div>
                  ))}
                </div>
                <div className="field" style={{ maxWidth: 320 }}>
                  <label className="label" htmlFor="s-tel">사무실 전화 <span className="opt">선택</span></label>
                  <input id="s-tel" className="input" type="tel" placeholder="예: 032-000-1234" defaultValue={profile.officePhone} onChange={mark} />
                </div>
              </div>
            </section>
          )}

          {tab === "sending" && (
            <section className="card">
              <div className="card__head"><h2>알림톡 발송 계정 (발송킹)</h2><Badge tone="good" dot>연결됨</Badge></div>
              <div className="card__body form" style={{ maxWidth: 560 }}>
                <p className="muted small">카카오 알림톡 발송에 쓰는 발송킹 계정입니다. 이 정보가 있어야 알림톡을 보낼 수 있습니다.</p>
                <div className="field">
                  <label className="label" htmlFor="s-bkid">발송킹 아이디</label>
                  <input id="s-bkid" className="input" defaultValue={profile.balsongkingId} onChange={mark} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-bkpw">발송킹 비밀번호</label>
                  <div className="input-group">
                    <input id="s-bkpw" className="input" type={showBk ? "text" : "password"} defaultValue="••••••••••" onChange={mark} autoComplete="off" />
                    <button type="button" className="btn btn--icon" onClick={() => setShowBk((v) => !v)} aria-label={showBk ? "숨기기" : "보기"} aria-pressed={showBk}><Icon name={showBk ? "eyeOff" : "eye"} size={16} /></button>
                  </div>
                  <div className="help">비밀값은 항상 가려 두고 필요할 때만 잠깐 봅니다. 화면을 캡처해 공유할 때 유출되지 않습니다.</div>
                </div>
                <div className="row" style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                  <span className="muted">현재 발신번호</span> <b className="num">{formatPhone(profile.phone)}</b>
                </div>
                <div className="form-grid-2">
                  <div className="field">
                    <label className="label" htmlFor="s-kid">카카오채널 검색용 아이디</label>
                    <input id="s-kid" className="input" defaultValue={profile.kakaoChannelId} onChange={mark} />
                    <div className="help">채널 ID 앞에 @를 붙입니다.</div>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="s-kurl">채널 URL</label>
                    <input id="s-kurl" className="input" defaultValue={profile.kakaoChannelUrl} onChange={mark} />
                    <div className="help">채널 품앗이에서 다른 회원이 내 채널을 찾는 데 쓰입니다.</div>
                  </div>
                </div>
                <div className="row">
                  <button type="button" className="btn" onClick={() => toast({ tone: "danger", message: "연결 테스트 실패 — 대행사 서버 인증서 문제 (09-12 12:35부터). 계정 정보와는 무관합니다." })}><Icon name="activity" size={14} /> 연결 테스트</button>
                </div>
              </div>
            </section>
          )}

          {tab === "sending" && (
            <section className="card">
              <div className="card__head">
                <h2>알림톡 실패 시 문자 대체발송</h2>
                {fallback.enabled ? <Badge tone="good" dot>켜짐</Badge> : <Badge tone="neutral">꺼짐</Badge>}
              </div>
              <div className="card__body stack" style={{ gap: 14 }}>
                <p className="muted small">
                  카카오톡을 쓰지 않거나 채널을 차단한 고객에게는 알림톡이 꽂히지 않습니다. 그럴 때 같은 내용을 문자로 대신 내보냅니다.
                  대체 문자는 알림톡 요청에 함께 실려 나가므로, 템플릿마다 문구가 미리 준비돼 있어야 합니다.
                </p>

                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <span>
                    <b>대체발송 사용</b>
                    <div className="help">끄면 알림톡이 실패한 고객은 아무것도 받지 못합니다.</div>
                  </span>
                  <Switch checked={fallback.enabled} onChange={(v) => { setFallback((f) => ({ ...f, enabled: v })); mark(); }} label="대체발송" />
                </div>

                <div className="field" style={{ maxWidth: 320 }}>
                  <label className="label" htmlFor="s-cap">하루 상한</label>
                  <div className="input-group">
                    <input id="s-cap" className="input" type="number" min={0} value={fallback.dailyCap} onChange={(e) => { setFallback((f) => ({ ...f, dailyCap: Number(e.target.value) })); mark(); }} />
                    <span className="btn" aria-hidden>건</span>
                  </div>
                  <div className="help">
                    문자는 알림톡의 3~8배입니다. 상한을 넘으면 그날은 더 보내지 않고 발송 내역에 남깁니다.
                    오늘 {fallback.usedToday}건 사용 · 상한을 다 쓰면 최대 {formatWon(fallback.dailyCap * SMS_COST.LMS)}입니다.
                  </div>
                </div>

                <div className="row" style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, gap: 10, flexWrap: "wrap" }}>
                  <span className="muted">문자 발신번호</span>
                  <b className="num">{formatPhone(systemStatus.smsSender.number)}</b>
                  <Badge tone="good" dot>사전등록 완료</Badge>
                  <span className="muted small">{systemStatus.smsSender.registeredAt} · {systemStatus.smsSender.via}</span>
                </div>
                <div className="help">
                  문자 발신번호는 전기통신사업법에 따라 미리 등록해야 합니다. 알림톡과는 별개 절차라, 등록이 없으면 알림톡은 나가도 대체 문자는 한 건도 나가지 않습니다.
                </div>

                <div>
                  <div className="section-label">대체 문구가 준비된 템플릿</div>
                  <div className="list">
                    {templates.filter((t) => t.status === "승인").map((t) => (
                      <div key={t.id} className="list__item">
                        <span className="what">
                          <div className="t">{t.name}</div>
                          <div className="s">{t.usedBy ?? "수동 발송"}</div>
                        </span>
                        {t.sms?.enabled ? <Badge tone="good" dot>문자 대체</Badge> : t.sms ? <Badge tone="neutral">문구만 있음</Badge> : <Badge tone="outline">없음</Badge>}
                      </div>
                    ))}
                  </div>
                  <div className="help mt-8">
                    계약일·중도금·잔금·만료일처럼 놓치면 사고가 나는 안내만 켜 두는 것이 좋습니다.
                    시세·칼럼 같은 정보성 발송까지 켜면 비용만 늘고 고객에게는 문자 광고로 보입니다.
                    문구는 <a className="link" href="/agent/alimtalk/templates">템플릿 관리</a>에서 고칩니다.
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "integrations" && (
            <>
              <section className="card">
                <div className="card__head"><h2>텔레그램 알림</h2>{profile.telegram.connected ? <Badge tone="good" dot>연결됨</Badge> : <Badge tone="neutral">미연결</Badge>}</div>
                <div className="card__body">
                  {profile.telegram.connected ? (
                    <div className="row row--between">
                      <div>
                        <div className="strong">{profile.telegram.account}</div>
                        <div className="muted small">마지막 알림 {profile.telegram.lastAlert} · 발송 실패, 등기부 변동, 문의 답변을 받습니다.</div>
                      </div>
                      <div className="row">
                        <button type="button" className="btn btn--sm" onClick={() => toast("테스트 메시지를 보냈습니다.")}>전송 테스트</button>
                        <button type="button" className="btn btn--sm btn--danger-ghost" onClick={() => setDisconnect(true)}>연결 해제</button>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">휴대폰이면 [텔레그램 연결하기] 버튼, 컴퓨터면 QR 코드로 연결합니다.</p>
                  )}
                </div>
              </section>
              <section className="card">
                <div className="card__head"><h2>구글 캘린더</h2><Badge tone="neutral">미연결</Badge></div>
                <div className="card__body row row--between">
                  <div className="muted small" style={{ maxWidth: 520 }}>계약 시점 일정(계약일·중도금일·잔금일·입주일·만료일)과 약속을 '부동산TALK 일정' 전용 캘린더에 자동 반영합니다. 기존 일정과 섞이지 않습니다.</div>
                  <button type="button" className="btn btn--primary" onClick={() => toast({ tone: "info", message: "구글 로그인 창이 열립니다. (프로토타입)" })}><Icon name="calendar" size={15} /> 구글 캘린더 연동</button>
                </div>
              </section>
              <section className="card">
                <div className="card__head"><h2>등기부 감시 프로그램</h2><Badge tone="good" dot>작동 중</Badge></div>
                <div className="card__body row row--between">
                  <div className="muted small">사무실 PC (DESKTOP-SY) · v69 · 마지막 응답 09-12 21:11</div>
                  <a href="/agent/registry" className="btn btn--sm">등기부 감시로 이동</a>
                </div>
              </section>
            </>
          )}

          {tab === "keywords" && (
            <section className="card">
              <div className="card__head"><h2>메모 키워드</h2><span className="muted small">고객·물건·계약 메모에 버튼으로 뜨는 키워드</span></div>
              <div className="card__body">
                <div className="row mb-12">
                  <input className="input" style={{ maxWidth: 260 }} placeholder="예) 급매, 재계약 희망" aria-label="새 키워드" />
                  <div className="chips" role="group" aria-label="색">
                    {(["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "gray"] as const).map((c) => (
                      <button key={c} type="button" className={`kw kw--${c}`} style={{ height: 26, cursor: "pointer", border: 0 }} aria-label={`${c} 색`} onClick={() => toast({ tone: "info", message: `${c} 색을 골랐습니다.` })}>가</button>
                    ))}
                  </div>
                  <button type="button" className="btn btn--sm btn--primary" onClick={() => toast("키워드를 추가했습니다.")}><Icon name="plus" size={14} /> 추가</button>
                </div>
                <div className="table-wrap">
                  <table className="table table--dense">
                    <thead><tr><th style={{ width: 30 }}></th><th>키워드</th><th>노출</th><th className="th-right">관리</th></tr></thead>
                    <tbody>
                      {CUSTOMER_KEYWORDS.map((k) => (
                        <tr key={k.label}>
                          <td className="faint" aria-hidden>⋮⋮</td>
                          <td><span className={`kw kw--${k.color}`}>{k.label}</span></td>
                          <td><Switch checked onChange={(v) => toast(v ? `'${k.label}' 노출` : `'${k.label}' 숨김`)} /></td>
                          <td><div className="row-actions"><button type="button" className="btn btn--ghost btn--sm" onClick={() => toast({ tone: "info", message: "칩을 클릭해 이름을 바로 고칠 수 있습니다. (프로토타입)" })}>이름 변경</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="help mt-8">행 왼쪽 손잡이를 끌어 순서를 바꾸면 자동 저장됩니다.</p>
              </div>
            </section>
          )}

          {tab === "security" && (
            <section className="card">
              <div className="card__head"><h2>비밀번호 변경</h2></div>
              <div className="card__body form" style={{ maxWidth: 420 }}>
                <div className="field">
                  <label className="label" htmlFor="pw-cur">현재 비밀번호</label>
                  <input id="pw-cur" className="input" type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="pw-new">새 비밀번호</label>
                  <input id="pw-new" className="input" type="password" autoComplete="new-password" placeholder="8자 이상, 숫자·문자 조합" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  {strength && <div className={strength === "약함" ? "error" : "help"}>강도: {strength}{strength === "약함" ? " — 8자 이상, 숫자와 문자를 섞어 주세요" : ""}</div>}
                </div>
                <div className="field">
                  <label className="label" htmlFor="pw-again">새 비밀번호 확인</label>
                  <input id="pw-again" className={`input${pw.again && pw.again !== pw.next ? " is-invalid" : ""}`} type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
                  {pw.again && pw.again !== pw.next && <div className="error">새 비밀번호와 다릅니다.</div>}
                </div>
                <div>
                  <button type="button" className="btn btn--primary" disabled={!pw.cur || strength === "약함" || !strength || pw.again !== pw.next} onClick={() => { setPw({ cur: "", next: "", again: "" }); toast("비밀번호를 바꿨습니다. 다른 기기에서는 다시 로그인해야 합니다."); }}>비밀번호 변경</button>
                </div>
                <Banner tone="info" title="새 기기 로그인 인증" body="새 기기에서 로그인하면 휴대폰 인증번호를 요구합니다. 고객 정보 188건이 담긴 계정을 보호합니다." />
              </div>
            </section>
          )}

          {tab === "terms" && (
            <section className="card">
              <div className="card__head"><h2>이용약관</h2><a href="#" className="link small">현재 약관 전문 보기</a></div>
              <div className="card__body">
                <div className="table-wrap">
                  <table className="table table--dense">
                    <thead><tr><th>버전</th><th>제목</th><th>나의 동의 일시</th></tr></thead>
                    <tbody>
                      {termsHistory.map((t) => (
                        <tr key={t.version}><td>{t.version}</td><td>{t.title}</td><td className="num">{t.agreedAt}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {dirty && (
            <div className="savebar" role="region" aria-label="변경 사항 저장">
              <Icon name="alertCircle" size={16} />
              <span className="s">저장하지 않은 변경 사항이 있습니다</span>
              <span className="spacer" />
              <button type="button" className="btn btn--ghost" onClick={() => setDirty(false)}>되돌리기</button>
              <button type="button" className="btn btn--primary" onClick={save}>저장</button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal open={disconnect} onClose={() => setDisconnect(false)} danger title="텔레그램 연결을 해제할까요?" description="발송 실패·등기부 변동·문의 답변 알림을 더 이상 받지 못합니다." confirmLabel="연결 해제" onConfirm={() => { setDisconnect(false); toast("텔레그램 연결을 해제했습니다."); }} />
    </>
  );
}
