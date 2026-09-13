"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AgencyBadge, GradeChip, RegionChip, ReviewChip, RouteChip, StatusPill, TopicChip } from "@/components/Badges";
import { fmtDate, relTime } from "@/lib/format";
import { focusRank, gradeIssue, isFresh, routeIssue } from "@/lib/routing";
import { REGION_LABEL, regionLabel, STATUS_LABEL, TOPICS, TOPIC_LABEL } from "@/lib/taxonomy";
import type { CollectStats, Issue, Topic } from "@/lib/types";

/**
 * 인박스. 다른 화면과 같은 뼈대(흰 패널 + 제목 + 설명 + 목록)를 씁니다.
 * 1차 축은 주제(C축)입니다. 주제 칩으로 먼저 좁히고, 기간·지역·검수 상태로 다시 걸러냅니다.
 */

type Filter = "all" | "today" | "week";
/** 칩 줄이 보여 줄 축. 주제뿐 아니라 발표 주체·정책 단계·지역으로도 인박스를 나눠 봅니다. */
type Axis = "topic" | "agency" | "status" | "region";
const AXIS_LABEL: Record<Axis, string> = { topic: "주제", agency: "발표 주체", status: "정책 단계", region: "지역" };

export default function InboxClient({
  issues,
  lastCollect,
  llm,
  focusTopics = [],
}: {
  issues: Issue[];
  lastCollect: CollectStats | null;
  llm: boolean;
  focusTopics?: Topic[];
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<Filter>("all");
  const [axis, setAxis] = useState<Axis>("topic");
  const [bucket, setBucket] = useState<string>("all");
  const [localOnly, setLocalOnly] = useState(false);
  const [bodyOnly, setBodyOnly] = useState(false);
  const [draftOnly, setDraftOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [focusOnly, setFocusOnly] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const now = Date.now();
  // "21시간 전" 은 서버와 브라우저의 시각이 달라 하이드레이션 경고를 냅니다. 마운트 뒤에만 그립니다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 주제 칩의 건수는 주제 외 조건만 적용한 모집단에서 셉니다(칩을 눌러도 다른 칩의 수가 변하지 않게)
  const pool = useMemo(
    () =>
      issues
        .map((i) => ({ i, route: routeIssue(i), grade: gradeIssue(i, now) }))
        .filter(({ i, route }) => {
          if (!showArchived && i.review === "archived") return false;
          if (period === "today" && !isFresh(i, "daily", now)) return false;
          if (period === "week" && !isFresh(i, "weekly", now)) return false;
          if (localOnly && i.region !== "local") return false;
          if (bodyOnly && route.customer !== "body" && route.customer !== "target") return false;
          if (draftOnly && i.review !== "draft") return false;
          if (focusOnly && focusTopics.length > 0 && !focusTopics.includes(i.topic)) return false;
          if (q && !(i.title + i.summary + i.agency + (i.place ?? "") + i.dong.join(" ")).toLowerCase().includes(q.toLowerCase())) return false;
          return true;
        }),
    [issues, period, localOnly, bodyOnly, draftOnly, showArchived, focusOnly, focusTopics, q, now],
  );

  /** 선택한 축에서 이슈가 속하는 칸의 키와 표시 이름 */
  const bucketOf = (i: Issue): { key: string; label: string } => {
    if (axis === "topic") return { key: i.topic, label: TOPIC_LABEL[i.topic] };
    if (axis === "agency") return { key: i.agency, label: i.agency };
    if (axis === "status") return { key: i.status, label: STATUS_LABEL[i.status] };
    const label = regionLabel(i.region, i.place);
    return { key: label, label };
  };

  /** 지역 축은 전국·우리 지역을 앞에 두고 나머지는 건수 순으로 */
  const regionRank = (k: string) => (k === REGION_LABEL.national ? 0 : k === REGION_LABEL.local ? 1 : 2);

  const buckets = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const { i } of pool) {
      const b = bucketOf(i);
      const cur = m.get(b.key);
      m.set(b.key, { label: b.label, n: (cur?.n ?? 0) + 1 });
    }
    // 주제·단계는 정해진 순서대로, 발표 주체는 건수 많은 순으로
    const order =
      axis === "topic"
        ? TOPICS.map(String)
        : axis === "status"
          ? Object.keys(STATUS_LABEL)
          : [...m.keys()].sort((a, b) => {
              if (axis === "region" && regionRank(a) !== regionRank(b)) return regionRank(a) - regionRank(b);
              return (m.get(b)?.n ?? 0) - (m.get(a)?.n ?? 0);
            });
    return order.filter((k) => m.has(k)).map((k) => ({ key: k, label: m.get(k)!.label, n: m.get(k)!.n }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, axis]);

  const rows = useMemo(
    () =>
      pool
        .filter(({ i }) => bucket === "all" || bucketOf(i).key === bucket)
        .sort((a, b) => {
          const g = { star: 0, ref: 1, keep: 2 };
          if (g[a.grade] !== g[b.grade]) return g[a.grade] - g[b.grade];
          const fa = focusRank(a.i.topic, focusTopics);
          const fb = focusRank(b.i.topic, focusTopics);
          if (fa !== fb) return fa - fb;
          return new Date(b.i.publishedAt).getTime() - new Date(a.i.publishedAt).getTime();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, bucket, axis, focusTopics],
  );

  async function patch(id: string, body: Partial<Issue>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/studio/issues/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      router.refresh();
    } catch (e) {
      setMsg(`저장 실패: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function collectNow() {
    setBusy("collect");
    setMsg("보도자료·기사를 수집하는 중입니다. 피드 수에 따라 10~30초 걸립니다.");
    try {
      const res = await fetch("/api/studio/collect", { method: "POST" });
      const data = (await res.json()) as { stats?: CollectStats; error?: string };
      if (!res.ok || !data.stats) throw new Error(data.error || res.statusText);
      const s = data.stats;
      setMsg(`수집 완료: ${s.fetched}건 읽음 · 새 이슈 ${s.added} · 기사 병합 ${s.merged} · 제외 ${s.skipped}${llm ? ` · 자동 초안 ${s.enriched}` : ""}${s.errors.length ? ` · 오류 ${s.errors.length}건` : ""}`);
      router.refresh();
    } catch (e) {
      setMsg(`수집 실패: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const starCount = rows.filter((r) => r.grade === "star").length;
  const draftCount = issues.filter((i) => i.review === "draft").length;

  return (
    <div className="panel panel-wide">
      <div className="filter-card">
        <div className="row">
          <div className="seg" role="group" aria-label="기간">
            {(["all", "today", "week"] as Filter[]).map((f) => (
              <button key={f} aria-pressed={period === f} onClick={() => setPeriod(f)}>
                {f === "all" ? "전체" : f === "today" ? "48시간" : "7일"}
              </button>
            ))}
          </div>
          <label className="row small" title="설정에서 시군구를 지정하면 그 지역 기사만 남깁니다">
            <input type="checkbox" checked={localOnly} onChange={(e) => setLocalOnly(e.target.checked)} /> 우리 지역만
          </label>
          <label className="row small">
            <input type="checkbox" checked={bodyOnly} onChange={(e) => setBodyOnly(e.target.checked)} /> 고객 본문·타깃만
          </label>
          <label className="row small">
            <input type="checkbox" checked={draftOnly} onChange={(e) => setDraftOnly(e.target.checked)} /> 미검수만
          </label>
          <label className="row small">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> 보관 포함
          </label>
          {focusTopics.length > 0 && (
            <label className="row small" title={`주력 주제: ${focusTopics.map((t) => TOPIC_LABEL[t]).join(" · ")}`}>
              <input type="checkbox" checked={focusOnly} onChange={(e) => setFocusOnly(e.target.checked)} /> 주력 주제만
            </label>
          )}
          <input type="text" placeholder="제목·기관·동 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={collectNow} disabled={busy === "collect"}>
            {busy === "collect" ? "수집 중…" : "지금 수집"}
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="분류 축">
            {(Object.keys(AXIS_LABEL) as Axis[]).map((a) => (
              <button
                key={a}
                aria-pressed={axis === a}
                onClick={() => {
                  setAxis(a);
                  setBucket("all");
                }}
              >
                {AXIS_LABEL[a]}
              </button>
            ))}
          </div>
          <div className="chipbar" role="group" aria-label={AXIS_LABEL[axis]} style={{ flex: 1 }}>
            <button className="fchip" aria-pressed={bucket === "all"} onClick={() => setBucket("all")}>
              전체 <b>{pool.length}</b>
            </button>
            {buckets.map((b) => (
              <button className="fchip" key={b.key} aria-pressed={bucket === b.key} onClick={() => setBucket(b.key)}>
                {axis === "topic" && focusTopics.includes(b.key as Topic) && <span className="fchip-star">★</span>}
                {b.label} <b>{b.n}</b>
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="panel-title">
        인박스 — {bucket === "all" ? "전체" : buckets.find((b) => b.key === bucket)?.label ?? bucket} ({rows.length})
      </h2>
      <p className="panel-sub">
        수집된 보도자료·기사·고시에 5축(발표 주체 · 정책 단계 · 주제 · 영향 대상 · 지역) 태그가 붙습니다. 주제로 먼저 묶고, 기관은 확정 여부 판단에만 씁니다.{" "}
        {focusTopics.length > 0 && <>주력 주제 ★ {focusTopics.map((t) => TOPIC_LABEL[t]).join(" · ")} 가 같은 등급 안에서 먼저 옵니다. </>}★ 발송 권장 {starCount}건 · 미검수 {draftCount}건
        {lastCollect && ` · 마지막 수집 읽음 ${lastCollect.fetched} / 새 이슈 ${lastCollect.added} / 병합 ${lastCollect.merged}${lastCollect.errors.length ? ` / 오류 ${lastCollect.errors.length}` : ""}`}
      </p>

      {msg && (
        <div className={`alert ${msg.startsWith("수집 실패") || msg.startsWith("저장 실패") ? "alert-error" : "alert-info"} banner`} role="status">
          {msg}
        </div>
      )}
      {lastCollect && lastCollect.errors.length > 0 && (
        <details className="small muted" style={{ marginBottom: 10 }}>
          <summary>마지막 수집 오류 {lastCollect.errors.length}건</summary>
          <ul>
            {lastCollect.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="inbox-list">
        {rows.length === 0 && <div className="card">조건에 맞는 이슈가 없습니다. 필터를 풀거나 '지금 수집'을 눌러 보세요.</div>}
        {rows.map(({ i, route, grade }) => (
          <div className={`inbox-row${i.review === "archived" ? " archived" : ""}`} key={i.id}>
            <div>
              <div className="tags">
                <GradeChip grade={grade} />
                <AgencyBadge agency={i.agency} />
                <StatusPill status={i.status} />
                <TopicChip topic={i.topic} />
                <RegionChip region={i.region} dong={i.dong} place={i.place} />
                <RouteChip route={route.customer} />
                <ReviewChip review={i.review} />
              </div>
              <div className="title">
                <Link href={`/studio/issues/${i.id}`}>{i.customer.headline && i.enrichedBy !== "rules" ? i.customer.headline : i.title}</Link>
              </div>
              <div className="meta">
                <span suppressHydrationWarning>
                  {fmtDate(i.publishedAt)}
                  {mounted ? ` · ${relTime(i.publishedAt)}` : ""}
                </span>
                <span>{i.sourceName}</span>
                <span>관련 기사 {i.articles.length}건</span>
                {i.enrichedBy === "llm" && <span>자동 초안</span>}
                {i.enrichedBy === "rules" && <span>규칙 태깅만 · 고객용 문장 필요</span>}
              </div>
            </div>
            <div className="actions">
              {i.review !== "reviewed" ? (
                <button className="btn btn-sm btn-primary" disabled={busy === i.id} onClick={() => patch(i.id, { review: "reviewed" })}>
                  검수 완료
                </button>
              ) : (
                <button className="btn btn-sm" disabled={busy === i.id} onClick={() => patch(i.id, { review: "draft" })}>
                  초안으로
                </button>
              )}
              {i.review !== "archived" ? (
                <button className="btn btn-sm" disabled={busy === i.id} onClick={() => patch(i.id, { review: "archived" })}>
                  보관
                </button>
              ) : (
                <button className="btn btn-sm" disabled={busy === i.id} onClick={() => patch(i.id, { review: "draft" })}>
                  복원
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
