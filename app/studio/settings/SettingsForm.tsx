"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Office } from "@/lib/types";

const FIELDS: { key: keyof Office; label: string; hint?: string; type?: string; textarea?: boolean }[] = [
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
  { key: "areaLabel", label: "동네 표기", hint: "우리 동네 숫자 섹션 제목 옆" },
  { key: "slogan", label: "레터 슬로건", hint: "고객에게 보이는 문구입니다. 중개사 대상 문구는 쓰지 마세요" },
  { key: "defaultComment", label: "한마디 기본 문구", textarea: true },
];

export default function SettingsForm({ office: initial }: { office: Office }) {
  const router = useRouter();
  const [office, setOffice] = useState<Office>(initial);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/studio/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(office) });
      const data = (await res.json()) as { office?: Office; error?: string };
      if (!res.ok || !data.office) throw new Error(data.error || res.statusText);
      setOffice(data.office);
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
