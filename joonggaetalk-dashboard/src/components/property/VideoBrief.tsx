"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { profile } from "@/data/misc";
import type { Property } from "@/data/properties";
import { formatPhone, TODAY } from "@/lib/format";
import {
  buildPrompt,
  HEYGEN_ERRORS,
  missingForAd,
  nextStep,
  PROMPT_MAX,
  regionOf,
  stripUnit,
  type BriefFacts,
  type HeygenErrorCode,
  type Judgement,
  type OfficeFacts,
  type Orientation,
  type Video,
  type VideoRef,
} from "@/lib/heygen";

type Failure = { code: string; message: string; hint: string; why?: string; sessionId?: string | null };

type Job =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "polling"; ref: VideoRef; startedAt: number; progress: number | null; status: string }
  | { kind: "done"; ref: VideoRef; video: Video }
  | { kind: "error"; failure: Failure; ref?: VideoRef };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** HeyGen 영상 상태 → 화면 문구. 모르는 값은 원문 그대로 보여 준다. */
const STATUS_KO: Record<string, string> = { pending: "대기 중", processing: "렌더링 중" };

function office(): OfficeFacts {
  return {
    office: profile.office,
    agent: profile.name,
    address: profile.roadAddress || profile.address,
    phone: profile.officePhone || (profile.phone ? formatPhone(profile.phone) : ""),
    registrationNo: profile.registrationNo,
  };
}

/**
 * AI 소개 영상 — 물건 정보로 HeyGen 아바타 영상을 만든다.
 *
 * 영상은 몇 분이 걸린다. 그동안 창을 닫아도 HeyGen 은 계속 만들고, 영상 번호는
 * 만들기 요청이 접수되는 순간 물건에 저장되므로 다시 열면 이어서 확인한다.
 */
export function VideoBrief({ property, saved, onSaved }: { property: Property; saved?: VideoRef; onSaved?: (ref: VideoRef) => void }) {
  const toast = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [orientation, setOrientation] = useState<Orientation>(saved?.orientation ?? "portrait");
  const [direction, setDirection] = useState("");
  const [rooms, setRooms] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [maintenance, setMaintenance] = useState("");
  const [notes, setNotes] = useState("");
  const [attempt, setAttempt] = useState(saved?.attempt ?? 0);
  const [job, setJob] = useState<Job>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  /** 지금 돌고 있는 확인 루프 번호. 바뀌면 이전 루프는 스스로 멈춘다. */
  const loop = useRef(0);
  /** 이미 확인을 시작한 영상 번호 — 부모가 저장값을 다시 내려줘도 루프를 새로 띄우지 않는다 */
  const handled = useRef<string | null>(null);

  const land = property.type === "토지";
  const facts: BriefFacts = useMemo(
    () => ({
      type: property.type,
      title: stripUnit(property.register?.dong.bldNm || property.name),
      region: regionOf(property.jibunAddress || property.address),
      areaM2: property.areaM2,
      floor: property.floor,
      parking: property.parking,
      contractTypes: property.contractTypes,
      salePrice: property.salePrice,
      deposit: property.deposit,
      monthly: property.monthly,
      useAprDay: property.register?.dong.useAprDay,
      direction,
      rooms,
      moveIn,
      maintenance,
      notes,
    }),
    [property, direction, rooms, moveIn, maintenance, notes],
  );
  const officeFacts = useMemo(office, []);
  const prompt = useMemo(() => buildPrompt(facts, officeFacts, orientation), [facts, officeFacts, orientation]);
  const missing = useMemo(() => missingForAd(facts, officeFacts), [facts, officeFacts]);

  useEffect(() => {
    let alive = true;
    fetch("/api/heygen", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setConfigured(Boolean(d.configured)))
      .catch(() => alive && setConfigured(false));
    return () => {
      alive = false;
      loop.current++; // 닫히면 확인을 멈춘다 — HeyGen 은 계속 만든다
    };
  }, []);

  // 경과 시간 표시용
  useEffect(() => {
    if (job.kind !== "polling") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [job.kind]);

  const poll = useCallback(async (ref: VideoRef) => {
    const token = ++loop.current;
    handled.current = ref.videoId;
    const startedAt = Date.now();
    setJob({ kind: "polling", ref, startedAt, progress: null, status: "" });
    let attemptNo = 0;
    let streak = 0;

    while (loop.current === token) {
      const qs = `video=${encodeURIComponent(ref.videoId)}${ref.sessionId ? `&session=${encodeURIComponent(ref.sessionId)}` : ""}`;
      let data: Record<string, unknown> | null = null;
      try {
        data = await (await fetch(`/api/heygen?${qs}`, { cache: "no-store" })).json();
      } catch {
        data = null;
      }
      if (loop.current !== token) return;

      const elapsedMs = Date.now() - startedAt;
      let step;
      if (!data || data.ok !== true) {
        streak++;
        const code = (data?.code as HeygenErrorCode) ?? "UPSTREAM";
        step = nextStep({ error: code, attempt: attemptNo, elapsedMs, transientStreak: streak });
        if (step.action === "stop") {
          const base = HEYGEN_ERRORS[step.code ?? code] ?? { message: String(data?.message ?? "확인하지 못했습니다."), hint: String(data?.hint ?? "") };
          setJob({
            kind: "error",
            ref,
            failure: { code: step.code ?? code, message: String(data?.message ?? base.message), hint: String(data?.hint ?? base.hint), why: data?.why ? String(data.why) : undefined },
          });
          return;
        }
      } else {
        streak = 0;
        const judgement = data.judgement as Judgement;
        const video = data.video as Video;
        if (judgement.kind === "done") {
          setJob({ kind: "done", ref, video });
          return;
        }
        step = nextStep({ judgement, attempt: attemptNo, elapsedMs, transientStreak: 0 });
        if (step.action === "stop") {
          const code = step.code ?? "UNKNOWN_STATE";
          setJob({
            kind: "error",
            ref,
            failure: { code, ...HEYGEN_ERRORS[code], why: judgement.kind === "stop" ? judgement.why : undefined, sessionId: ref.sessionId },
          });
          return;
        }
        setJob({ kind: "polling", ref, startedAt, progress: judgement.kind === "working" ? judgement.progress : null, status: video.status });
      }
      attemptNo++;
      await sleep(step.delayMs);
    }
  }, []);

  // 저장된 영상이 있으면 열 때마다 상태를 새로 받는다 — 영상 주소가 만료되기 때문
  useEffect(() => {
    if (saved && configured && handled.current !== saved.videoId) poll(saved);
  }, [saved, configured, poll]);

  const create = async (nextAttempt: number) => {
    loop.current++;
    setJob({ kind: "creating" });
    for (let tries = 0; ; tries++) {
      let data: Record<string, unknown> | null = null;
      try {
        const res = await fetch("/api/heygen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: property.id, prompt, orientation, attempt: nextAttempt }),
        });
        data = await res.json();
      } catch {
        data = null;
      }
      // 같은 요청이 아직 처리 중 — 같은 키로 다시 보내면 처음 결과를 받는다. 새로 만들어지지 않는다.
      if (data?.code === "IN_PROGRESS" && tries < 5) {
        await sleep(5_000);
        continue;
      }
      if (!data || data.ok !== true) {
        const code = String(data?.code ?? "UPSTREAM");
        const base = HEYGEN_ERRORS[code as HeygenErrorCode] ?? HEYGEN_ERRORS.UPSTREAM;
        setJob({
          kind: "error",
          failure: {
            code,
            message: String(data?.message ?? base.message),
            hint: String(data?.hint ?? base.hint),
            why: data?.why ? String(data.why) : undefined,
            sessionId: (data?.sessionId as string) ?? null,
          },
        });
        return;
      }
      const ref: VideoRef = { videoId: String(data.videoId), sessionId: String(data.sessionId ?? ""), orientation, createdAt: TODAY, attempt: nextAttempt };
      setAttempt(nextAttempt);
      onSaved?.(ref);
      toast({ tone: "info", message: "영상 만들기를 시작했습니다. 창을 닫아도 HeyGen 에서 계속 만듭니다." });
      poll(ref);
      return;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({ tone: "good", message: "요청 문구를 복사했습니다. HeyGen 의 Video Agent 에 붙여 넣으면 됩니다." });
    } catch {
      toast({ tone: "danger", message: "복사하지 못했습니다. 아래 문구를 직접 선택해 복사해 주세요." });
    }
  };

  const busy = job.kind === "creating" || job.kind === "polling";
  const current = job.kind === "done" || job.kind === "polling" || job.kind === "error" ? job.ref : undefined;
  const elapsedMin = job.kind === "polling" ? Math.floor((now - job.startedAt) / 60_000) : 0;

  return (
    <div className="br">
      <div className="br__head">
        <div>
          <span className="br__title">
            <Icon name="play" size={15} /> AI 소개 영상
            {configured === false && <Badge tone="outline">키 미설정</Badge>}
          </span>
          <div className="help">물건 정보로 AI 아바타가 설명하는 짧은 영상을 만듭니다 (HeyGen).</div>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={!configured || busy || prompt.length > PROMPT_MAX}
          onClick={() => create(current ? attempt + 1 : attempt)}
        >
          {job.kind === "creating" ? "요청 중…" : job.kind === "polling" ? "만드는 중…" : current ? (
            <>
              <Icon name="refresh" size={14} /> 새로 만들기
            </>
          ) : (
            <>
              <Icon name="sparkles" size={14} /> 영상 만들기
            </>
          )}
        </button>
      </div>

      <div className="br__body stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="seg" role="group" aria-label="화면 방향">
            <button type="button" className={orientation === "portrait" ? "is-active" : ""} onClick={() => setOrientation("portrait")} disabled={busy}>
              세로 · 릴스·숏츠
            </button>
            <button type="button" className={orientation === "landscape" ? "is-active" : ""} onClick={() => setOrientation("landscape")} disabled={busy}>
              가로 · 유튜브·블로그
            </button>
          </div>
        </div>

        {!land && (
          <div className="form-grid-2">
            <Field id="vb-dir" label="방향" value={direction} onChange={setDirection} placeholder="예: 남향 (거실 기준)" />
            {property.type !== "상가" && <Field id="vb-rooms" label="방·욕실 수" value={rooms} onChange={setRooms} placeholder="예: 방 3 · 욕실 2" />}
            <Field id="vb-move" label="입주가능일" value={moveIn} onChange={setMoveIn} placeholder="예: 즉시 / 2026-12-15 이후 협의" />
            <Field id="vb-fee" label="관리비" value={maintenance} onChange={setMaintenance} placeholder="예: 월 평균 25만원" />
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="vb-notes">
            강조할 점 <span className="opt">선택 · 사실만</span>
          </label>
          <textarea
            id="vb-notes"
            className="textarea"
            style={{ minHeight: 64 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예: 2024년 욕실·주방 전체 수리. 확인되지 않은 거리·시세·전망은 적지 마세요."
          />
          <div className="help">메모 키워드는 넣지 않습니다 — '만기 임박', '가격협의 가능' 같은 내부 메모가 광고에 나가면 안 됩니다.</div>
        </div>

        {missing.length > 0 && (
          <Banner
            tone="warn"
            title={`인터넷 광고로 올리려면 ${missing.length}개 항목이 더 필요합니다`}
            body={
              <>
                {missing.join(" · ")}
                <div className="small mt-8">
                  공인중개사법상 표시·광고 명시사항입니다. 고객에게 따로 보내는 영상이면 그대로 만들어도 됩니다.
                  {missing.includes("사용승인일") && " 사용승인일은 위 [대장 조회] 결과를 물건에 반영하면 채워집니다."}
                  {missing.some((m) => m.startsWith("중개사무소")) && " 등록번호·연락처는 나의 정보에서 넣습니다."}
                </div>
              </>
            }
          />
        )}

        <details>
          <summary className="small link" style={{ cursor: "pointer" }}>
            HeyGen 에 보낼 요청 보기 ({prompt.length.toLocaleString()}자)
          </summary>
          <pre className="vb__prompt">{prompt}</pre>
          <button type="button" className="btn btn--sm" onClick={copy}>
            <Icon name="copy" size={14} /> 요청 복사
          </button>
        </details>

        {configured === false && (
          <Banner tone="info" title={HEYGEN_ERRORS.NO_KEY.message} body={HEYGEN_ERRORS.NO_KEY.hint} actions={<button type="button" className="btn btn--sm" onClick={copy}>요청 복사</button>} />
        )}

        {job.kind === "polling" && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row row--between small">
              <span>
                <b>만드는 중</b>
                <span className="muted"> · {elapsedMin > 0 ? `${elapsedMin}분 경과` : "방금 시작"}{job.status ? ` · ${STATUS_KO[job.status] ?? job.status}` : ""}</span>
              </span>
              {job.progress !== null && <span className="num">{job.progress}%</span>}
            </div>
            <div className="progress" aria-label="진행률">
              <i className="ok" style={{ width: `${job.progress ?? 4}%` }} />
            </div>
            <p className="help">창을 닫아도 HeyGen 에서 계속 만듭니다. 영상 번호가 물건에 저장돼 있어 다시 열면 이어서 확인합니다.</p>
          </div>
        )}

        {job.kind === "error" && (
          <Banner
            tone={job.failure.code === "STALLED" || job.failure.code === "NEEDS_INPUT" ? "warn" : "danger"}
            title={job.failure.message}
            body={
              <>
                {job.failure.hint}
                {job.failure.why && (
                  <details className="mt-8">
                    <summary className="small" style={{ cursor: "pointer" }}>자세히</summary>
                    <div className="small mono" style={{ whiteSpace: "pre-wrap" }}>{job.failure.why}</div>
                  </details>
                )}
              </>
            }
            actions={
              job.ref ? (
                <button type="button" className="btn btn--sm" onClick={() => poll(job.ref!)}>
                  <Icon name="refresh" size={14} /> 다시 확인
                </button>
              ) : job.failure.code === "UPSTREAM" || job.failure.code === "RATE_LIMIT" ? (
                <button type="button" className="btn btn--sm" onClick={() => create(attempt)}>
                  다시 시도
                </button>
              ) : undefined
            }
          />
        )}

        {job.kind === "done" && (
          <div className="stack" style={{ gap: 8 }}>
            {job.video.videoUrl ? (
              <video
                className="vb__video"
                data-orientation={job.ref.orientation}
                src={job.video.videoUrl}
                poster={job.video.thumbnailUrl || undefined}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <p className="help">영상은 완성됐지만 재생 주소가 오지 않았습니다. HeyGen 화면에서 확인하세요.</p>
            )}
            <div className="row row--between small">
              <span className="muted">
                {job.ref.createdAt} 만듦{job.video.duration ? ` · ${Math.round(job.video.duration)}초` : ""}
              </span>
              <span className="row" style={{ gap: 12 }}>
                {job.video.pageUrl && (
                  <a className="link" href={job.video.pageUrl} target="_blank" rel="noreferrer">
                    HeyGen 에서 보기 <Icon name="external" size={12} />
                  </a>
                )}
                {job.video.videoUrl && (
                  <a className="link" href={job.video.videoUrl} target="_blank" rel="noreferrer">
                    mp4 내려받기 <Icon name="download" size={12} />
                  </a>
                )}
              </span>
            </div>
            <Banner
              tone="warn"
              title="올리기 전에 끝까지 보세요"
              body="대본은 AI 가 썼습니다. 사실과 다른 말이 한마디라도 있으면 표시·광고 책임은 중개사에게 있습니다. 재생·내려받기 주소는 시간이 지나면 만료되므로, 이 화면을 다시 열어 새 주소를 받으세요."
            />
          </div>
        )}

        <p className="help">
          만들 때마다 HeyGen API 크레딧이 듭니다. 같은 내용으로 다시 눌러도 24시간 안에는 새로 만들지 않고 처음 영상을 돌려줍니다.
        </p>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
