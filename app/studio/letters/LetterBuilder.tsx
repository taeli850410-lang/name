"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LetterView from "@/components/LetterView";
import { fmtDateTime } from "@/lib/format";
import { letterTitle, segmentLabel, shareText } from "@/lib/letter";
import { PERIOD_LABEL, PERIOD_LIMIT, SEGMENTS, SEGMENT_KEYS } from "@/lib/taxonomy";
import type { Letter, Office, Period, Segment, Validation } from "@/lib/types";

/**
 * EDM 빌더. 브리핑 화면과 같은 뼈대를 씁니다:
 * 왼쪽 흰 패널에 주기·세그먼트·동네·한마디, 오른쪽에 고객이 받게 될 남색 EDM(브리핑과 같은 기기 프레임).
 */

type Mode = "build" | "history";

export default function LetterBuilder({ office, published }: { office: Office; published: Letter[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("build");
  const [period, setPeriod] = useState<Period>("weekly");
  const [segment, setSegment] = useState<Segment>("first");
  const [dong, setDong] = useState("");
  const [comment, setComment] = useState(office.defaultComment);
  const [draft, setDraft] = useState<Letter | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [done, setDone] = useState<{ url: string; letter: Letter } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function makeDraft() {
    setBusy("draft");
    setError(null);
    setDone(null);
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
      setDone({ url: data.url, letter: data.letter });
      setDraft(data.letter);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`${label}을 복사했습니다.`);
      window.setTimeout(() => setNote(null), 2400);
    } catch {
      window.prompt("복사", text);
    }
  }

  const canPublish = draft && validation && validation.errors.length === 0 && !done;
  const shown = done?.letter ?? (draft ? { ...draft, comment } : null);

  /* ── 발행 이력 ── */
  if (mode === "history") {
    return (
      <div className="panel panel-wide">
        <div className="row between">
          <button className="btn" onClick={() => setMode("build")}>
            ← EDM 만들기
          </button>
        </div>
        <h2 className="panel-title">발행 이력 ({published.length})</h2>
        <p className="panel-sub">발행본은 읽기 전용 스냅샷입니다. 나중에 이슈를 고쳐도 이미 보낸 EDM의 내용은 바뀌지 않습니다.</p>
        {note && <div className="alert alert-ok banner">{note}</div>}
        <div className="stack">
          {published.length === 0 && <div className="card">아직 발행한 EDM이 없습니다.</div>}
          {published.map((l) => (
            <div className="card row between" key={l.id}>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                  <span className="chip chip-c">{segmentLabel(l.segment)}</span>
                  <span className="chip chip-neutral">{PERIOD_LABEL[l.period]}</span>
                  {l.dong && <span className="chip chip-warn">{l.dong} 타깃</span>}
                </div>
                <b>{letterTitle(l)}</b>
                <div className="small muted">
                  {fmtDateTime(l.publishedAt)} · 이슈 {l.issues.length}개 · <code>/l/{l.id}</code>
                </div>
              </div>
              <div className="row">
                <Link className="btn btn-sm" href={`/l/${l.id}`} target="_blank">
                  열기
                </Link>
                <button className="btn btn-sm" onClick={() => copy(new URL(`/l/${l.id}`, window.location.origin).toString(), "링크")}>
                  링크 복사
                </button>
                <button className="btn btn-sm" onClick={() => copy(shareText(l, new URL(`/l/${l.id}`, window.location.origin).toString()), "카카오톡 문구")}>
                  카카오톡 문구
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── EDM 만들기 ── */
  return (
    <div className="builder">
      <div className="stack">
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <b>EDM 만들기</b>
            <button className="btn btn-sm" onClick={() => setMode("history")}>
              발행 이력 ({published.length})
            </button>
          </div>
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
            <label>공인중개사의 한마디</label>
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

        {note && <div className="alert alert-ok">{note}</div>}
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
        {validation && validation.errors.length === 0 && !done && <div className="alert alert-ok">검증 통과. 미리보기를 확인한 뒤 발행하세요.</div>}
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
        {done && (
          <div className="card">
            <h3>발행 완료</h3>
            <p className="small">
              읽기 전용 주소:{" "}
              <a href={done.url} target="_blank" rel="noreferrer noopener">
                {done.url}
              </a>
            </p>
            <div className="row">
              <button className="btn btn-sm" onClick={() => copy(done.url, "링크")}>
                링크 복사
              </button>
              <button className="btn btn-sm" onClick={() => copy(shareText(done.letter, done.url), "카카오톡 문구")}>
                카카오톡용 문구 복사
              </button>
              <a
                className="btn btn-sm"
                href={`mailto:?subject=${encodeURIComponent(`[${office.officeName}] 부동산 브리핑`)}&body=${encodeURIComponent(shareText(done.letter, done.url))}`}
              >
                메일 초안
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="brief-stage">
        <div className="brief-device">
          {shown ? (
            <LetterView letter={shown} />
          ) : (
            <div className="brief theme-navy">
              <div className="wrap">
                <div className="card empty">주기와 세그먼트를 고르고 '초안 만들기'를 누르면 고객이 받게 될 EDM이 여기에 나타납니다.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
