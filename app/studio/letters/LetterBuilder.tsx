"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LetterView from "@/components/LetterView";
import { shareText } from "@/lib/letter";
import { PERIOD_LABEL, PERIOD_LIMIT, SEGMENTS, SEGMENT_KEYS } from "@/lib/taxonomy";
import type { Letter, Office, Period, Segment, Validation } from "@/lib/types";

export default function LetterBuilder({ office }: { office: Office }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("weekly");
  const [segment, setSegment] = useState<Segment>("first");
  const [dong, setDong] = useState("");
  const [comment, setComment] = useState(office.defaultComment);
  const [draft, setDraft] = useState<Letter | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [published, setPublished] = useState<{ url: string; letter: Letter } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function makeDraft() {
    setBusy("draft");
    setError(null);
    setPublished(null);
    try {
      const res = await fetch("/api/studio/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", period, segment, dong: dong || null, comment }),
      });
      const data = (await res.json()) as { letter?: Letter; validation?: Validation; error?: string };
      if (!res.ok || !data.letter || !data.validation) throw new Error(data.error || res.statusText);
      setDraft(data.letter);
      setValidation(data.validation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!draft) return;
    setBusy("publish");
    setError(null);
    try {
      const res = await fetch("/api/studio/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", letter: { ...draft, comment, headline: draft.headline } }),
      });
      const data = (await res.json()) as { letter?: Letter; url?: string; validation?: Validation; error?: string };
      if (!res.ok || !data.letter || !data.url) {
        if (data.validation) setValidation(data.validation);
        throw new Error(data.error || res.statusText);
      }
      setPublished({ url: data.url, letter: data.letter });
      setDraft(data.letter);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
    } catch {
      window.prompt("복사", text);
    }
  }

  const canPublish = draft && validation && validation.errors.length === 0 && !published;
  const shown = published?.letter ?? (draft ? { ...draft, comment } : null);

  return (
    <div className="builder">
      <div className="stack">
        <div className="card">
          <div className="field">
            <label>주기</label>
            <div className="seg" role="group" aria-label="주기">
              {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
                <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>
                  {PERIOD_LABEL[p]} · {PERIOD_LIMIT[p]}개
                </button>
              ))}
            </div>
            <span className="hint">DAILY 48시간 · WEEKLY 7일 · MONTHLY 31일 안의 검수 완료 이슈만 고릅니다.</span>
          </div>
          <div className="field">
            <label>고객 세그먼트</label>
            <div className="seg" role="group" aria-label="세그먼트">
              {SEGMENT_KEYS.map((s) => (
                <button key={s} aria-pressed={segment === s} onClick={() => setSegment(s)}>
                  {SEGMENTS[s].label}
                </button>
              ))}
            </div>
            <span className="hint">{SEGMENTS[segment].desc}. 이 세그먼트 영향도가 3 이상인 이슈만 본문에 실립니다.</span>
          </div>
          <div className="field">
            <label>동네 타깃 (선택)</label>
            <input type="text" placeholder="예: 관양동" value={dong} onChange={(e) => setDong(e.target.value)} />
            <span className="hint">입력하면 그 동의 고시·정비사업 이슈(R3)가 맨 앞에 실립니다.</span>
          </div>
          <div className="field">
            <label>중개사의 한마디</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={makeDraft} disabled={busy !== null}>
              {busy === "draft" ? "선정 중…" : "초안 만들기"}
            </button>
            <button className="btn" onClick={publish} disabled={!canPublish || busy !== null}>
              {busy === "publish" ? "발행 중…" : "발행"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {validation && validation.errors.length > 0 && (
          <div className="alert alert-error">
            발행할 수 없습니다.
            <ul>
              {validation.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {validation && validation.errors.length === 0 && !published && <div className="alert alert-ok">검증 통과. 미리보기를 확인한 뒤 발행하세요.</div>}
        {validation && validation.warnings.length > 0 && (
          <div className="alert alert-warn">
            참고
            <ul>
              {validation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {published && (
          <div className="card">
            <h3>발행 완료</h3>
            <p className="small">
              읽기 전용 주소:{" "}
              <a href={published.url} target="_blank" rel="noreferrer noopener">
                {published.url}
              </a>
            </p>
            <div className="row">
              <button className="btn btn-sm" onClick={() => copy(published.url)}>
                링크 복사
              </button>
              <button className="btn btn-sm" onClick={() => copy(shareText(published.letter, published.url))}>
                카카오톡용 문구 복사
              </button>
              <a className="btn btn-sm" href={`mailto:?subject=${encodeURIComponent(`[${office.officeName}] 부동산 브리핑`)}&body=${encodeURIComponent(shareText(published.letter, published.url))}`}>
                메일 초안
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="preview-frame">
        <div className="device">
          {shown ? (
            <LetterView letter={shown} />
          ) : (
            <div className="ll">
              <div className="wrap">
                <div className="card">주기와 세그먼트를 고르고 '초안 만들기'를 누르면 고객이 받게 될 레터가 여기에 나타납니다.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
