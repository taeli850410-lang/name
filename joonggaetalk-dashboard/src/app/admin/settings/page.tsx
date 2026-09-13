"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHead, Switch } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const TABS = [
  { key: "signup", label: "신규 가입" },
  { key: "sending", label: "알림톡 발송 제어" },
  { key: "registry", label: "등기 감시" },
  { key: "keys", label: "연동 키" },
  { key: "program", label: "프로그램 배포" },
  { key: "general", label: "일반" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** 비밀값 입력 — 기본 마스킹, '보기'는 잠깐만, 재발급은 확인을 거친다. */
function SecretField({ id, label, hint, value, onDirty }: { id: string; label: string; hint?: string; value: string; onDirty: () => void }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="input-group">
        <input id={id} className="input" type={show ? "text" : "password"} defaultValue={value} autoComplete="off" onChange={onDirty} />
        <button type="button" className="btn btn--icon" aria-label={show ? "숨기기" : "보기"} aria-pressed={show} onClick={() => setShow((v) => !v)}><Icon name={show ? "eyeOff" : "eye"} size={16} /></button>
        <button type="button" className="btn" onClick={() => setConfirm(true)}>재발급</button>
      </div>
      {hint && <div className="help">{hint}</div>}
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} danger title={`${label}을(를) 재발급할까요?`} description="기존 키는 즉시 무효가 되고, 새 키를 여기에 저장해야 연동이 계속됩니다." confirmLabel="재발급 안내 열기" onConfirm={() => { setConfirm(false); toast({ tone: "info", message: "발급 기관 콘솔이 새 탭에서 열립니다. 새 키를 붙여 넣고 저장하세요." }); }} />
    </div>
  );
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("signup");
  const [dirty, setDirty] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [registryOn, setRegistryOn] = useState(true);
  const [download, setDownload] = useState(true);
  const [offConfirm, setOffConfirm] = useState<"registry" | "download" | null>(null);
  const mark = () => setDirty(true);

  return (
    <>
      <PageHead title="시스템 설정" desc="운영 전체에 적용되는 설정입니다. 수정 중인 탭에만 저장 바가 나타나고, 위험한 변경은 확인을 거칩니다." />
      <div className="vtabs">
        <nav className="vtabs__nav" aria-label="설정 구분">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? "is-active" : ""} onClick={() => { setDirty(false); setTab(t.key); }} aria-current={tab === t.key ? "page" : undefined}>{t.label}</button>
          ))}
        </nav>
        <div className="stack" style={{ gap: 16 }}>
          {tab === "signup" && (
            <section className="card">
              <div className="card__head"><h2>신규 가입</h2></div>
              <div className="card__body form" style={{ maxWidth: 560 }}>
                <div className="row row--between"><div><div className="strong">자동승인</div><div className="muted small">켜면 새 가입자가 즉시 활성화되고 무료 기간을 받습니다. 끄면 승인 대기 목록에 쌓입니다.</div></div><Switch checked={autoApprove} onChange={(v) => { setAutoApprove(v); mark(); }} label={autoApprove ? "켜짐" : "꺼짐"} /></div>
                <div className="form-grid-2">
                  <div className="field"><label className="label" htmlFor="su-days">자동승인 무료 일수</label><div className="input-group"><input id="su-days" className="input" inputMode="numeric" defaultValue="7" onChange={mark} /><span className="unit">일</span></div></div>
                  <div className="field"><label className="label" htmlFor="su-admin">알림 받을 운영자</label><select id="su-admin" className="select" defaultValue="이서연" onChange={mark}><option>이서연 (서연공인중개사사무소)</option><option>박준서 (중개톡 운영팀)</option></select><div className="help">텔레그램을 연결한 운영자만 고를 수 있습니다.</div></div>
                </div>
                <div className="field"><label className="label" htmlFor="su-sms">가입 인증 SMS 본문</label><input id="su-sms" className="input" defaultValue="[중개톡] 인증번호 {code}를 입력해 주세요." onChange={mark} /><div className="help">{"{code}"} 자리에 4자리 인증번호가 들어갑니다. 발신번호는 발송킹에 등록된 번호를 씁니다.</div></div>
              </div>
            </section>
          )}

          {tab === "sending" && (
            <section className="card">
              <div className="card__head"><h2>알림톡 발송 제어</h2></div>
              <div className="card__body form" style={{ maxWidth: 640 }}>
                <p className="muted small">발송킹은 계정마다 초당 보낼 수 있는 건수 제한이 있습니다. 아래 간격은 같은 중개사가 여러 건을 연달아 보낼 때 지키는 최소 대기시간이며, 서로 다른 중개사는 동시에 병렬로 발송됩니다.</p>
                <div className="form-grid-2">
                  <div className="field"><label className="label" htmlFor="sc-gap">발송 간격</label><div className="input-group"><input id="sc-gap" className="input" inputMode="numeric" defaultValue="370" onChange={mark} /><span className="unit">ms → 초당 약 2.7건</span></div></div>
                  <div className="field"><label className="label" htmlFor="sc-cost">건당 요금</label><div className="input-group"><input id="sc-cost" className="input" inputMode="decimal" defaultValue="6.5" onChange={mark} /><span className="unit">원</span></div></div>
                  <div className="field"><label className="label" htmlFor="sc-par">최대 동시 발송 중개사 수</label><input id="sc-par" className="input" inputMode="numeric" defaultValue="20" onChange={mark} /><div className="help">DB 커넥션 여유에 맞춰 조정. 실제 최고 기록 9명.</div></div>
                  <div className="field"><label className="label" htmlFor="sc-stop">연속 실패 자동정지</label><div className="input-group"><input id="sc-stop" className="input" inputMode="numeric" defaultValue="20" onChange={mark} /><span className="unit">회</span></div><div className="help">발송 요청 자체가 연달아 실패하면 자동 일시정지 (계정·템플릿 설정 문제 감지용). 수신자 사정 실패는 세지 않습니다.</div></div>
                  <div className="field"><label className="label" htmlFor="sc-batch">일괄 발송 1회 최대 인원</label><div className="input-group"><input id="sc-batch" className="input" inputMode="numeric" defaultValue="50" onChange={mark} /><span className="unit">명 (API 한도 100)</span></div></div>
                  <div className="field"><label className="label" htmlFor="sc-wait">결과확인 대기시간</label><div className="input-group"><input id="sc-wait" className="input" inputMode="numeric" defaultValue="30" onChange={mark} /><span className="unit">분</span></div><div className="help">이 시간 안에 결과가 안 오면 '결과확인 시간초과'로 실패 처리하고 재시도 대상에 넣습니다.</div></div>
                </div>
              </div>
            </section>
          )}

          {tab === "registry" && (
            <section className="card">
              <div className="card__head"><h2>등기 감시</h2><Badge tone={registryOn ? "good" : "danger"} dot>{registryOn ? "활성" : "중지"}</Badge></div>
              <div className="card__body form" style={{ maxWidth: 560 }}>
                <div className="row row--between"><div><div className="strong">기능 활성화</div><div className="muted small">끄면 모든 회원의 등기부 조회가 중단됩니다.</div></div><Switch checked={registryOn} onChange={(v) => (v ? setRegistryOn(true) : setOffConfirm("registry"))} label={registryOn ? "켜짐" : "꺼짐"} /></div>
                <div className="form-grid-2">
                  <div className="field"><label className="label" htmlFor="rg-am">오전 조회 시각</label><input id="rg-am" type="time" className="input" defaultValue="10:00" onChange={mark} /></div>
                  <div className="field"><label className="label" htmlFor="rg-pm">오후 조회 시각</label><input id="rg-pm" type="time" className="input" defaultValue="17:00" onChange={mark} /></div>
                  <div className="field"><label className="label" htmlFor="rg-req">로컬 프로그램 필수</label><select id="rg-req" className="select" defaultValue="on" onChange={mark}><option value="on">ON — 미설치 시 안내 페이지로 이동</option><option value="off">OFF — 배포 전 유지</option></select></div>
                  <div className="field"><span className="label">조회 간 대기시간 (초)</span><div className="input-group"><input className="input" inputMode="numeric" defaultValue="3" aria-label="최소" onChange={mark} /><span className="unit">~</span><input className="input" inputMode="numeric" defaultValue="7" aria-label="최대" onChange={mark} /></div><div className="help">등기소 서버 부하 방지 — 이 범위에서 랜덤 대기</div></div>
                </div>
              </div>
            </section>
          )}

          {tab === "keys" && (
            <>
              <div className="banner banner--info"><Icon name="lock" size={16} /><span>모든 키는 가려진 상태로 저장·표시됩니다. 화면을 캡처해 공유해도 값이 드러나지 않습니다. 이미 캡처로 노출된 키는 '재발급'으로 교체하세요.</span></div>
              <section className="card"><div className="card__head"><h2>네이버 커머스 API</h2><Badge tone="good" dot>연결됨</Badge></div><div className="card__body form" style={{ maxWidth: 640 }}><div className="field"><label className="label" htmlFor="nv-id">애플리케이션 ID</label><input id="nv-id" className="input" defaultValue="naver-commerce-app" onChange={mark} /></div><SecretField id="nv-secret" label="시크릿" value="••••••••••••••••" onDirty={mark} /><div className="form-grid-2"><div className="field"><label className="label" htmlFor="nv-sync">자동 동기화</label><select id="nv-sync" className="select" defaultValue="ON" onChange={mark}><option>ON</option><option>OFF</option></select></div><div className="field"><label className="label" htmlFor="nv-every">주기</label><div className="input-group"><input id="nv-every" className="input" inputMode="numeric" defaultValue="5" onChange={mark} /><span className="unit">분 (1~1440)</span></div></div></div></div></section>
              <section className="card"><div className="card__head"><h2>국토교통부 오픈API</h2><Badge tone="good" dot>연결 확인 09-12</Badge></div><div className="card__body form" style={{ maxWidth: 640 }}><SecretField id="molit-key" label="인증키 (Decoding)" hint="data.go.kr 일반 인증키 하나로 실거래가와 건축물대장을 함께 씁니다. 서버 환경 변수 DATA_GO_KR_API_KEY 에 들어가며 브라우저로는 내려가지 않습니다. 활용 신청: 아파트/연립다세대/단독다가구/오피스텔 실거래가(매매·전월세) · 건축물대장정보 서비스" value="••••••••••••••••••••••••" onDirty={mark} /><div className="form-grid-2"><div className="field"><label className="label" htmlFor="molit-limit">기본 조회 제한 건수</label><input id="molit-limit" className="input" inputMode="numeric" defaultValue="2000" onChange={mark} /></div><div className="field"><span className="label">건축물대장</span><div className="row" style={{ gap: 8 }}><Badge tone="good" dot>물건 등록에 연결됨</Badge><a className="link small" href="/agent/properties?new=1">조회 화면 보기 ›</a></div><div className="help">물건 등록·상세에서 [대장 조회]로 면적·용도·층수·사용승인일을 가져옵니다.</div></div></div></div></section>
              <section className="card"><div className="card__head"><h2>카카오 (회원 지도)</h2></div><div className="card__body form" style={{ maxWidth: 640 }}><SecretField id="kakao-js" label="JavaScript 키" hint="지도를 화면에 띄우는 데 사용" value="••••••••••••••••" onDirty={mark} /><SecretField id="kakao-rest" label="REST API 키" hint="회원 주소를 좌표로 변환(지오코딩)하는 데 사용" value="••••••••••••••••" onDirty={mark} /><div className="row"><Switch checked onChange={mark} label="마커에 상호명 표시" /><Switch checked onChange={mark} label="보이는 회원 수 표시" /></div></div></section>
              <section className="card"><div className="card__head"><h2>구글 캘린더 (앱 공용 OAuth)</h2></div><div className="card__body form" style={{ maxWidth: 640 }}><div className="field"><label className="label">승인된 리디렉션 URI</label><div className="input-group"><input className="input" readOnly value="https://app.joonggaetalk.com/google-calendar/callback" aria-label="리디렉션 URI" /><button type="button" className="btn" onClick={() => toast("복사했습니다.")}><Icon name="copy" size={14} /> 복사</button></div></div><div className="field"><label className="label" htmlFor="g-id">Client ID</label><input id="g-id" className="input" defaultValue="…apps.googleusercontent.com" onChange={mark} /></div><SecretField id="g-secret" label="Client Secret" hint="각 중개사의 실제 연동은 나의 정보에서 개별 진행합니다." value="••••••••••••••••" onDirty={mark} /></div></section>
              <section className="card"><div className="card__head"><h2>텔레그램 알림 봇</h2><Badge tone="good" dot>웹훅 등록됨</Badge></div><div className="card__body form" style={{ maxWidth: 640 }}><SecretField id="tg-token" label="봇 토큰" hint="@BotFather에서 발급. 토큰을 바꾸면 웹훅을 다시 등록해야 합니다." value="••••••••••••••••••••••••••••" onDirty={mark} /><div className="field"><label className="label" htmlFor="tg-name">봇 사용자명</label><input id="tg-name" className="input" defaultValue="joonggaetalk_bot" onChange={mark} /></div><div className="row"><button type="button" className="btn btn--sm" onClick={() => toast("봇 토큰 확인: 정상")}>토큰 확인</button><button type="button" className="btn btn--sm" onClick={() => toast("웹훅을 다시 등록했습니다.")}>웹훅 등록</button></div></div></section>
            </>
          )}

          {tab === "program" && (
            <section className="card">
              <div className="card__head"><h2>등기 감시 프로그램 배포</h2><Badge tone="outline">현재 v69</Badge></div>
              <div className="card__body form" style={{ maxWidth: 640 }}>
                <div className="row row--between"><div><div className="strong">다운로드 제공</div><div className="muted small">끄면 회원에게 '준비 중'으로 표시되고 다운로드·업데이트가 막힙니다.</div></div><Switch checked={download} onChange={(v) => (v ? setDownload(true) : setOffConfirm("download"))} label={download ? "켜짐" : "꺼짐"} /></div>
                <div className="row row--between"><div><div className="strong">자동 업데이트 (관리자 테스트용)</div><div className="muted small">운영자 계정의 로컬 프로그램만 최신 버전을 받아 배포 전 테스트합니다.</div></div><Switch checked onChange={mark} label="켜짐" /></div>
                <div className="card" style={{ boxShadow: "none", background: "var(--surface-2)" }}><div className="card__body form">
                  <div className="form-grid-2"><div className="field"><label className="label" htmlFor="pv">새 버전 번호</label><input id="pv" className="input" placeholder="v70" onChange={mark} /><div className="help">빌드 스크립트의 버전 숫자와 같아야 합니다.</div></div><div className="field"><label className="label" htmlFor="pf">설치 프로그램 (exe)</label><input id="pf" type="file" className="input" style={{ paddingTop: 7 }} onChange={mark} /><div className="help">NSIS 설치 파일(약 85~90MB)을 올립니다. 저장 즉시 회원 PC가 자동 업데이트를 확인합니다.</div></div></div>
                  <div className="row"><button type="button" className="btn btn--primary" onClick={() => toast({ tone: "info", message: "업로드 (프로토타입)" })}><Icon name="upload" size={14} /> 업로드</button></div>
                </div></div>
                <div className="field" style={{ maxWidth: 320 }}><label className="label" htmlFor="pw4">로컬 프로그램 관리자 비밀번호</label><div className="input-group"><input id="pw4" className="input" type="password" inputMode="numeric" placeholder="새 4자리 숫자" onChange={mark} /></div><div className="help">트레이 아이콘의 관리자 창 비밀번호. 현재 값은 표시하지 않으며 바꿀 때만 입력합니다.</div></div>
              </div>
            </section>
          )}

          {tab === "general" && (
            <section className="card">
              <div className="card__head"><h2>일반</h2></div>
              <div className="card__body form" style={{ maxWidth: 560 }}>
                <div className="field"><label className="label" htmlFor="gn-name">서비스 이름</label><input id="gn-name" className="input" defaultValue="중개톡" onChange={mark} /></div>
                <div className="field"><label className="label" htmlFor="gn-buy">구매 페이지 URL</label><input id="gn-buy" className="input" defaultValue="https://smartstore.naver.com/…" onChange={mark} /><div className="help">사용기한 만료 임박 안내와 구매내역 화면의 '연장하기'에 쓰입니다.</div></div>
                <div className="field"><label className="label" htmlFor="gn-help">도움말 URL</label><input id="gn-help" className="input" defaultValue="https://…notion.site/…" onChange={mark} /><div className="help">비우면 도움말 버튼이 숨겨집니다. 화면별 도움말은 각 화면 제목 옆 물음표에서 편집합니다.</div></div>
                <div className="field"><label className="label" htmlFor="gn-log">작업 로그 보관 기간</label><div className="input-group"><input id="gn-log" className="input" inputMode="numeric" defaultValue="90" onChange={mark} /><span className="unit">일 (0이면 영구 보관)</span></div></div>
                <div className="field"><label className="label" htmlFor="gn-msg">문의 안내 문구</label><input id="gn-msg" className="input" defaultValue="운영자에게 문의해 주세요." onChange={mark} /></div>
              </div>
            </section>
          )}

          {dirty && (
            <div className="savebar" role="region" aria-label="변경 사항 저장">
              <Icon name="alertCircle" size={16} />
              <span className="s">저장하지 않은 변경 사항이 있습니다 · {TABS.find((t) => t.key === tab)?.label}</span>
              <span className="spacer" />
              <button type="button" className="btn btn--ghost" onClick={() => setDirty(false)}>되돌리기</button>
              <button type="button" className="btn btn--primary" onClick={() => { setDirty(false); toast("저장했습니다."); }}>저장</button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal open={offConfirm === "registry"} onClose={() => setOffConfirm(null)} danger title="등기 감시를 전체 중단할까요?" description="모든 회원의 등기부 조회가 멈추고 회원 화면에 '중단' 상태가 표시됩니다. 임차인 보호 알림이 나가지 않습니다." confirmLabel="전체 중단" onConfirm={() => { setRegistryOn(false); setOffConfirm(null); mark(); }} />
      <ConfirmModal open={offConfirm === "download"} onClose={() => setOffConfirm(null)} danger title="프로그램 다운로드 제공을 끌까요?" description="회원에게 '준비 중'으로 표시되고 신규 설치·업데이트가 모두 막힙니다." confirmLabel="끄기" onConfirm={() => { setDownload(false); setOffConfirm(null); mark(); }} />
    </>
  );
}
