"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Office } from "@/lib/types";

/**
 * 상단 바 '사무소' 단추가 여는 정보 입력 창. 원본 EDM 처럼 화면을 떠나지 않고 그 자리에서 고칩니다.
 *
 * 여기 있는 칸은 전부 지금 보고 있는 브리핑·레터에 바로 찍히는 값들입니다 —
 * 마스트헤드(상호·브랜드), CTA 버튼(연락처·카카오톡), 푸터(대표·등록번호), 슬로건.
 * 나머지 설정(지역·주력 주제·영상 채널)은 양이 많아 설정 화면에 그대로 둡니다.
 */

const FIELDS: { key: keyof Office; label: string; hint?: string; type?: string; required?: boolean }[] = [
  { key: "officeName", label: "중개사무소 상호", hint: "마스트헤드에 가장 크게 나옵니다", required: true },
  { key: "repName", label: "대표 공인중개사", required: true },
  { key: "registrationNo", label: "중개사무소 등록번호", required: true },
  { key: "phone", label: "연락처(휴대전화)", type: "tel", hint: "고객용 레터의 전화 버튼에 걸립니다", required: true },
  { key: "brandName", label: "브랜드 표기", hint: "마스트헤드 아래 작은 글씨" },
  { key: "areaLabel", label: "지역 표기", hint: '전국구면 "전국", 지역 밀착이면 "인천 부평구" 처럼' },
  { key: "kakaoUrl", label: "카카오톡 채널 URL", type: "url", hint: "비우면 상담 버튼이 전화만 표시됩니다" },
  { key: "slogan", label: "레터 슬로건", hint: "고객에게 보이는 문구입니다" },
];

export default function OfficeDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [office, setOffice] = useState<Office | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/studio/settings")
      .then((r) => r.json())
      .then((d: { office?: Office }) => live && d.office && setOffice(d.office))
      .catch(() => live && setMsg({ tone: "error", text: "설정을 불러오지 못했습니다." }));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (office) firstRef.current?.focus();
  }, [office]);

  // Esc 로 닫기 — 열려 있는 동안 뒤 화면은 스크롤하지 않습니다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const missing = FIELDS.filter((f) => f.required && !String(office?.[f.key] ?? "").trim()).map((f) => f.label);

  async function save() {
    if (!office) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(office),
      });
      const data = (await res.json()) as { office?: Office; error?: string; persistent?: boolean; storeLabel?: string; storeError?: string | null };
      if (!res.ok || !data.office) throw new Error(data.error || res.statusText);
      setOffice(data.office);
      // 서버 컴포넌트를 다시 그려 마스트헤드·푸터·CTA 에 즉시 반영합니다
      router.refresh();
      if (data.persistent === false) {
        setMsg({
          tone: "error",
          text: data.storeError
            ? `화면에는 반영했지만 저장소에 쓰지 못했습니다 — ${data.storeError}`
            : `화면에는 반영했지만 이 배포에는 영구 저장소가 없습니다(${data.storeLabel ?? "메모리 저장"}). 잠시 뒤 기본값으로 돌아갈 수 있습니다 — Vercel → Storage 에서 Upstash Redis 를 연결한 뒤 재배포해야 합니다.`,
        });
      } else {
        setMsg({ tone: "ok", text: "적용했습니다. 이 화면의 상호·연락처가 바로 바뀝니다." });
        window.setTimeout(onClose, 900);
      }
    } catch (e) {
      setMsg({ tone: "error", text: `저장 실패: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="odlg-back" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="odlg" role="dialog" aria-modal="true" aria-labelledby="odlg-title">
        <div className="odlg-head">
          <h2 id="odlg-title">🏢 중개사무소 정보</h2>
          <button className="odlg-x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <p className="odlg-sub">여기서 고치면 지금 보고 있는 브리핑·레터의 마스트헤드·상담 버튼·푸터가 바로 바뀝니다.</p>

        {!office ? (
          <p className="odlg-loading">불러오는 중…</p>
        ) : (
          <>
            <div className="odlg-body">
              {FIELDS.map((f, i) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`od-${f.key}`}>
                    {f.label}
                    {f.required && <span className="odlg-req">필수</span>}
                  </label>
                  <input
                    id={`od-${f.key}`}
                    ref={i === 0 ? firstRef : undefined}
                    type={f.type ?? "text"}
                    value={String(office[f.key] ?? "")}
                    onChange={(e) => setOffice({ ...office, [f.key]: e.target.value })}
                  />
                  {f.hint && <span className="hint">{f.hint}</span>}
                </div>
              ))}
            </div>
            {msg && <div className={`alert alert-${msg.tone} odlg-msg`}>{msg.text}</div>}
            {missing.length > 0 && <div className="alert alert-warn odlg-msg">발행 전 필수: {missing.join(" · ")}</div>}
            <div className="odlg-foot">
              <a className="odlg-more" href="/studio/settings">
                지역·주력 주제·영상 채널 설정 →
              </a>
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={onClose} disabled={busy}>
                취소
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "적용 중…" : "저장하고 적용"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
