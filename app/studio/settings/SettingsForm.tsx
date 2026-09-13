"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_CHANNELS, DEFAULT_CHANNELS_TEXT, TIER_LABEL, type ChannelTier } from "@/lib/channels";
import { TOPICS, TOPIC_LABEL, VIDEO_IN_BRIEF } from "@/lib/taxonomy";

import type { Office, Topic } from "@/lib/types";

/** 전국구 기본 추천 조합 */
const RECOMMENDED_NATIONAL: Topic[] = ["rate", "lease", "subs"];
/** 지역 밀착으로 바꿨을 때 추천 조합 */
const RECOMMENDED_LOCAL: Topic[] = ["redev", "lease", "rate"];
const WHY: Partial<Record<Topic, string>> = {
  rate: "세 세그먼트 공통 — 내집마련·갈아타기·자산 모두 영향도 3 이상입니다",
  lease: "거래 빈도 최고 — 임차인·임대인 양쪽이 모두 고객입니다",
  subs: "무주택 수요의 출발점 — 청약·분양 일정은 검색량이 가장 큰 주제입니다",
  redev: "지역 독점 정보 — 구역 소식은 전국 매체가 다루지 않아 검색 경쟁이 낮습니다",
};
const list = (v?: string[]) => (v ?? []).join(", ");
const lines = (v?: string[]) => (v ?? []).join("\n");
const parseLines = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);

const parseList = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

/** 자유 입력 칸으로 다룰 수 있는 문자열 필드만 (스위치·목록 필드는 아래에서 따로 그립니다) */
type TextKey = Extract<{ [K in keyof Office]-?: string extends NonNullable<Office[K]> ? K : never }[keyof Office], string>;

const FIELDS: { key: TextKey; label: string; hint?: string; type?: string; textarea?: boolean }[] = [
  { key: "officeName", label: "중개사무소 상호" },
  { key: "brandName", label: "브랜드 표기", hint: "마스트헤드 아래 작은 글씨" },
  { key: "repName", label: "대표 공인중개사 성명" },
  { key: "registrationNo", label: "중개사무소 등록번호" },
  { key: "phone", label: "연락처(휴대전화)", type: "tel" },
  { key: "address", label: "소재지" },
  { key: "email", label: "이메일", hint: "수신거부 링크가 없으면 이 주소로 수신거부 메일이 옵니다", type: "email" },
  { key: "kakaoUrl", label: "카카오톡 채널 URL", hint: "예: https://pf.kakao.com/_xxxx", type: "url" },
  { key: "unsubscribeUrl", label: "수신거부 링크", hint: "발송 서비스(스티비 등)의 수신거부 URL. 없으면 이메일로 대체", type: "url" },
  { key: "privacyUrl", label: "개인정보처리방침 링크", hint: "푸터 '수신거부·개인정보처리방침'에 연결. 비우면 수신거부만 표시", type: "url" },
  { key: "areaLabel", label: "지역 표기", hint: "마스트헤드와 숫자 섹션에 쓰는 이름. 전국구면 \"전국\", 지역 밀착이면 \"안양 만안·동안구\" 처럼" },
  { key: "slogan", label: "레터 슬로건", hint: "고객에게 보이는 문구입니다. 중개사 대상 문구는 쓰지 마세요" },
  { key: "defaultComment", label: "한마디 기본 문구", textarea: true },
];

export default function SettingsForm({ office: initial }: { office: Office }) {
  const router = useRouter();
  const [office, setOffice] = useState<Office>(initial);
  const [focus, setFocus] = useState<Topic[]>(initial.focusTopics ?? []);
  const [scope, setScope] = useState<"national" | "local">(initial.scope === "local" ? "local" : "national");
  const [dongs, setDongs] = useState(list(initial.dongs));
  const [codes, setCodes] = useState(list(initial.lawdCodes));
  const [channels, setChannels] = useState(lines(initial.videoSources));
  const [showVideos, setShowVideos] = useState(initial.showVideos !== false);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/studio/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...office, focusTopics: focus, scope, dongs: parseList(dongs), lawdCodes: parseList(codes), videoSources: parseLines(channels), showVideos }) });
      const data = (await res.json()) as { office?: Office; error?: string };
      if (!res.ok || !data.office) throw new Error(data.error || res.statusText);
      setOffice(data.office);
      setFocus(data.office.focusTopics ?? []);
      setScope(data.office.scope === "local" ? "local" : "national");
      setDongs(list(data.office.dongs));
      setCodes(list(data.office.lawdCodes));
      setChannels(lines(data.office.videoSources));
      setShowVideos(data.office.showVideos !== false);
      setMsg({ tone: "ok", text: "저장되었습니다. 다음 발행부터 반영됩니다." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: `저장 실패: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("모든 이슈를 샘플 데이터로 되돌립니다. 수집·검수한 내용이 사라집니다. 계속할까요?")) return;
    setBusy("reset");
    try {
      const res = await fetch("/api/studio/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset-issues" }) });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      setMsg({ tone: "ok", text: "이슈를 샘플 데이터로 초기화했습니다." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: `초기화 실패: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid-2">
      <div className="card">
        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`f-${f.key}`}>{f.label}</label>
            {f.textarea ? (
              <textarea id={`f-${f.key}`} value={office[f.key] ?? ""} onChange={(e) => setOffice({ ...office, [f.key]: e.target.value })} />
            ) : (
              <input id={`f-${f.key}`} type={f.type ?? "text"} value={office[f.key] ?? ""} onChange={(e) => setOffice({ ...office, [f.key]: e.target.value })} />
            )}
            {f.hint && <span className="hint">{f.hint}</span>}
          </div>
        ))}
        <div className="field">
          <label>지역 범위</label>
          <div className="seg" role="group" aria-label="지역 범위">
            <button type="button" aria-pressed={scope === "national"} onClick={() => setScope("national")}>
              전국구
            </button>
            <button type="button" aria-pressed={scope === "local"} onClick={() => setScope("local")}>
              지역 밀착
            </button>
          </div>
          <span className="hint">
            {scope === "national"
              ? "전국 정책·시장 뉴스를 그대로 싣습니다. 특정 지자체 고시와 다른 지역의 구역·교통·규제 사안은 고객용에서 빠지고 중개사용 참고로만 남습니다."
              : "아래 시군구가 기사에 걸리면 '우리 지역'으로 분류해 앞세우고, 그 지역 고시는 동네 타깃(R3)이 됩니다. 지역 뉴스 피드도 하나 더 돕니다."}
          </span>
        </div>
        {scope === "local" && (
          <>
            <div className="field">
              <label htmlFor="f-sido">시도</label>
              <input id="f-sido" type="text" placeholder="예: 경기도" value={office.sido ?? ""} onChange={(e) => setOffice({ ...office, sido: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="f-sigungu">시군구</label>
              <input id="f-sigungu" type="text" placeholder="예: 안양시" value={office.sigungu ?? ""} onChange={(e) => setOffice({ ...office, sigungu: e.target.value })} />
              <span className="hint">이 이름(과 접미사를 뗀 짧은 이름)이 제목·요약에 있으면 '우리 지역'으로 잡습니다.</span>
            </div>
            <div className="field">
              <label htmlFor="f-dongs">행정동 (쉼표 구분)</label>
              <input id="f-dongs" type="text" placeholder="예: 관양동, 비산동, 석수동" value={dongs} onChange={(e) => setDongs(e.target.value)} />
              <span className="hint">레터 빌더의 동네 타깃과 지역 뉴스 피드에 씁니다.</span>
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="f-codes">법정동코드 (쉼표 구분, 5자리)</label>
          <input id="f-codes" type="text" placeholder="예: 41171, 41173" value={codes} onChange={(e) => setCodes(e.target.value)} />
          <span className="hint">
            '우리 동네 숫자'의 실거래 집계 대상입니다. 코드는{" "}
            <a href="https://www.code.go.kr/stdcode/regCodeL.do" target="_blank" rel="noreferrer noopener">
              행정표준코드관리시스템
            </a>{" "}
            에서 시군구까지 5자리로 확인합니다. 비우면 기준금리만 갱신되고 실거래는 샘플 값이 남습니다.
          </span>
        </div>
        <div className="field">
          <label>영상 기사란</label>
          <div className="seg" role="group" aria-label="영상 기사란">
            <button type="button" aria-pressed={showVideos} onClick={() => setShowVideos(true)}>
              켜기
            </button>
            <button type="button" aria-pressed={!showVideos} onClick={() => setShowVideos(false)}>
              끄기
            </button>
          </div>
          <span className="hint">
            브리핑·레터 맨 위에 유튜브 영상 보도 {VIDEO_IN_BRIEF}편을 채널 이름·주제와 함께 싣습니다. 부동산과 무관한 영상은 제목·설명을 보고 걸러냅니다.
          </span>
        </div>
        {showVideos && (
          <div className="field">
            <label htmlFor="f-channels">영상 채널 (한 줄에 하나)</label>
            <textarea id="f-channels" rows={6} placeholder={DEFAULT_CHANNELS_TEXT} value={channels} onChange={(e) => setChannels(e.target.value)} />
            <span className="hint">
              채널 주소 · @핸들 · UC 아이디 · 재생목록 주소를 넣을 수 있습니다. <b>비워 두면 아래 기본 채널 {DEFAULT_CHANNELS.length}곳으로 돕니다.</b> 유튜브 채널 피드는 최신 15편만
              주므로, 하루에 수백 편을 올리는 종합뉴스 채널은 부동산 영상이 방금 올라왔을 때만 걸립니다. 부동산·경제 전문 채널이나 그 채널의 부동산 재생목록이 훨씬 잘 걸립니다.
            </span>
            {channels.trim() === "" && (
              <button className="btn btn-sm" type="button" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => setChannels(DEFAULT_CHANNELS_TEXT)}>
                기본 채널 {DEFAULT_CHANNELS.length}곳 넣고 편집하기
              </button>
            )}
            <ul className="small muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {(["estate", "econ", "news"] as ChannelTier[]).map((t) => (
                <li key={t}>
                  <b>{TIER_LABEL[t]}</b> — {DEFAULT_CHANNELS.filter((c) => c.tier === t).map((c) => c.name).join(" · ")}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="field">
          <label>주력 주제</label>
          <div className="chipbar">
            {TOPICS.map((t) => (
              <button
                className="fchip"
                key={t}
                type="button"
                aria-pressed={focus.includes(t)}
                onClick={() => setFocus(focus.includes(t) ? focus.filter((x) => x !== t) : [...focus, t])}
              >
                {TOPIC_LABEL[t]}
              </button>
            ))}
          </div>
          <span className="hint">
            고른 주제를 인박스·브리핑·레터에서 같은 조건일 때 앞으로 당깁니다. 규칙 R1~R8(고객 본문 여부·분량·신선도)은 그대로라 다른 주제가 사라지지는 않습니다. 2~4개가 적당하고, 비우면
            가중치 없이 최신순으로만 정렬합니다.
          </span>
          {focus.length === 0 && (
            <button
              className="btn btn-sm"
              type="button"
              style={{ alignSelf: "flex-start", marginTop: 4 }}
              onClick={() => setFocus(scope === "local" ? RECOMMENDED_LOCAL : RECOMMENDED_NATIONAL)}
            >
              추천 조합 넣기 · {(scope === "local" ? RECOMMENDED_LOCAL : RECOMMENDED_NATIONAL).map((t) => TOPIC_LABEL[t]).join(" · ")}
            </button>
          )}
          {focus.length > 0 && (
            <ul className="small muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {focus.filter((t) => WHY[t]).map((t) => (
                <li key={t}>
                  <b>{TOPIC_LABEL[t]}</b> — {WHY[t]}
                </li>
              ))}
            </ul>
          )}
        </div>
        {msg && <div className={`alert alert-${msg.tone}`} style={{ marginBottom: 10 }}>{msg.text}</div>}
        <button className="btn btn-primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "저장 중…" : "저장"}
        </button>
      </div>
      <div className="stack">
        <div className="card">
          <h3>발행 전 검증 항목</h3>
          <ul className="small">
            <li>상호 · 대표 성명 · 등록번호 · 연락처 (필수)</li>
            <li>수신거부 링크 또는 이메일 (필수)</li>
            <li>고객용 문장의 금지 표현: 고객에게 · 안내하세요 · 설명하세요 · 상담 시 · 영업 · 경쟁 · 수주 · 협회 · DEMO · 입력해 주세요 · 미설정</li>
            <li>검수 완료된 이슈만, 신선도 창 안에서, 세그먼트 영향도 3 이상</li>
            <li>주력 주제는 순서만 당기고 R1~R8 을 덮어쓰지 않습니다</li>
            <li>전국구에서는 특정 지자체 고시와 타 지역 구역·교통·규제 사안이 고객용에서 빠집니다</li>
          </ul>
        </div>
        <div className="card">
          <h3>환경변수</h3>
          <ul className="small">
            <li><code>STUDIO_PASSWORD</code> 스튜디오 접근 비밀번호</li>
            <li><code>KV_REST_API_URL</code> / <code>KV_REST_API_TOKEN</code> Upstash Redis (영구 저장)</li>
            <li><code>ANTHROPIC_API_KEY</code> 자동 초안 (선택)</li>
            <li><code>CRON_SECRET</code> Vercel Cron 보호</li>
            <li><code>DATA_GO_KR_KEY</code> / <code>ECOS_API_KEY</code> 시장 데이터 갱신 (선택)</li>
          </ul>
        </div>
        <div className="card">
          <h3>초기화</h3>
          <p className="small muted">수집·검수한 이슈를 모두 지우고 샘플 10건으로 되돌립니다.</p>
          <button className="btn btn-danger btn-sm" onClick={reset} disabled={busy !== null}>
            {busy === "reset" ? "초기화 중…" : "샘플 데이터로 초기화"}
          </button>
        </div>
      </div>
    </div>
  );
}
