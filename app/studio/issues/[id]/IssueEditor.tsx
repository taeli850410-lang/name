"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AgencyBadge, GradeChip, RegionChip, RouteChip, StatusPill, TopicChip } from "@/components/Badges";
import { LetterIssueCard } from "@/components/LetterView";
import { fmtDate } from "@/lib/format";
import { links, TOPIC_LINKS } from "@/lib/links";
import { findForbidden, gradeIssue, routeIssue, segmentImpact } from "@/lib/routing";
import { newsSearchLinks, searchQuery, sortArticles } from "@/lib/source";
import { AGENCY_GROUPS, AGENCY_GROUP_LABEL, PERSONAS, REGIONS, REGION_LABEL, SEGMENTS, SEGMENT_KEYS, STATUSES, STATUS_LABEL, TOPICS, TOPIC_LABEL } from "@/lib/taxonomy";
import type { AgencyGroup, Issue, LetterIssue, Persona, Region, Segment, Status, Topic } from "@/lib/types";

const lines = (arr: string[]) => arr.join("\n");
const unlines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function IssueEditor({ issue: initial, llm }: { issue: Issue; llm: boolean }) {
  const router = useRouter();
  const [issue, setIssue] = useState<Issue>(initial);
  const [segment, setSegment] = useState<Segment>("first");
  const [busy, setBusy] = useState<"save" | "enrich" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [faqText, setFaqText] = useState(issue.broker.faq.map((f) => `${f.q} || ${f.a}`).join("\n"));

  const route = useMemo(() => routeIssue(issue), [issue]);
  const grade = useMemo(() => gradeIssue(issue), [issue]);
  const forbidden = useMemo(() => {
    const texts = [issue.customer.headline, issue.customer.what, ...Object.values(issue.customer.forMe), ...issue.customer.actions];
    return Array.from(new Set(texts.flatMap((t) => findForbidden(t || ""))));
  }, [issue]);

  const preview: LetterIssue = useMemo(() => {
    const forMe = issue.customer.forMe[segment] || "";
    const [lead, ...rest] = issue.articles.filter((a) => a.url);
    const arts = lead ? [lead, ...sortArticles(rest)].slice(0, 5) : [];
    const first = arts[0];
    return {
      issueId: issue.id,
      agency: issue.agency,
      status: issue.status,
      topic: issue.topic,
      publishedAt: issue.publishedAt,
      effectiveAt: issue.effectiveAt,
      officialUrl: issue.officialUrl,
      articleUrl: first?.url ?? null,
      articleLabel: first ? `${first.publisher} 기사` : null,
      title: issue.title,
      articles: arts,
      customer: issue.customer,
      forMe,
      impact: segmentImpact(issue, segment),
      links: links(TOPIC_LINKS[issue.topic].customer).slice(0, 3),
      dong: issue.dong,
      targeted: route.customer === "target",
    };
  }, [issue, segment, route.customer]);

  function setC<K extends keyof Issue["customer"]>(k: K, v: Issue["customer"][K]) {
    setIssue({ ...issue, customer: { ...issue.customer, [k]: v } });
  }
  function setB<K extends keyof Issue["broker"]>(k: K, v: Issue["broker"][K]) {
    setIssue({ ...issue, broker: { ...issue.broker, [k]: v } });
  }

  async function save(extra: Partial<Issue> = {}) {
    setBusy("save");
    setMsg(null);
    const faq = faqText
      .split("\n")
      .map((l) => l.split("||").map((x) => x.trim()))
      .filter((p) => p.length >= 2 && p[0] && p[1])
      .map(([q, a]) => ({ q, a }));
    const body: Partial<Issue> = {
      customer: issue.customer,
      broker: { ...issue.broker, faq },
      personas: issue.personas,
      agency: issue.agency,
      agencyGroup: issue.agencyGroup,
      status: issue.status,
      topic: issue.topic,
      region: issue.region,
      dong: issue.dong,
      effectiveAt: issue.effectiveAt,
      officialUrl: issue.officialUrl,
      review: issue.review,
      enrichedBy: issue.enrichedBy === "rules" ? "manual" : issue.enrichedBy,
      ...extra,
    };
    try {
      const res = await fetch(`/api/studio/issues/${issue.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { issue?: Issue; error?: string };
      if (!res.ok || !data.issue) throw new Error(data.error || res.statusText);
      setIssue(data.issue);
      setMsg({ tone: "ok", text: "저장되었습니다." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: `저장 실패: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function enrich() {
    setBusy("enrich");
    setMsg({ tone: "info", text: "Claude 가 고객용·중개사용 초안을 작성하는 중입니다. 20~60초 걸릴 수 있습니다." });
    try {
      const res = await fetch(`/api/studio/issues/${issue.id}/enrich`, { method: "POST" });
      const data = (await res.json()) as { issue?: Issue; error?: string };
      if (!res.ok || !data.issue) throw new Error(data.error || res.statusText);
      setIssue(data.issue);
      setFaqText(data.issue.broker.faq.map((f) => `${f.q} || ${f.a}`).join("\n"));
      setMsg({ tone: "ok", text: "초안이 생성되었습니다. 내용을 확인한 뒤 검수 완료로 저장하세요." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: `초안 생성 실패: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="editor">
      <div>
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <GradeChip grade={grade} />
            <AgencyBadge agency={issue.agency} />
            <StatusPill status={issue.status} />
            <TopicChip topic={issue.topic} />
            <RegionChip region={issue.region} dong={issue.dong} />
            <RouteChip route={route.customer} />
          </div>
          <h2 style={{ fontSize: 17 }}>{issue.title}</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            {issue.sourceName} · {fmtDate(issue.publishedAt)} · 수집 {fmtDate(issue.createdAt)}
          </p>
          {issue.summary && <p className="small">{issue.summary}</p>}
          <div className="route-box">
            <b>라우팅 {route.rules.join(" · ")}</b>
            <ul>
              {route.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          {issue.articles.length > 0 && (
            <ul className="small" style={{ marginTop: 10 }}>
              {issue.articles.map((a, i) => (
                <li key={a.url}>
                  {i === 0 && <span className="muted">대표 · </span>}
                  <a href={a.url} target="_blank" rel="noreferrer noopener">
                    {a.publisher} · {a.title}
                  </a>{" "}
                  <span className="muted">{fmtDate(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="small muted" style={{ marginTop: 8 }}>
            최신 뉴스 검색:{" "}
            {newsSearchLinks(searchQuery(issue.title)).map((l, i) => (
              <span key={l.href}>
                {i > 0 && " · "}
                <a href={l.href} target="_blank" rel="noreferrer noopener">
                  {l.label} ↗
                </a>
              </span>
            ))}
          </div>
        </div>

        {msg && <div className={`alert alert-${msg.tone} banner`}>{msg.text}</div>}
        {forbidden.length > 0 && (
          <div className="alert alert-error banner">고객용 필드에 금지 표현이 있습니다: {forbidden.join(", ")}. 발행 전 고쳐야 합니다.</div>
        )}

        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="row">
            <button className="btn btn-primary" disabled={busy !== null} onClick={() => save()}>
              {busy === "save" ? "저장 중…" : "저장"}
            </button>
            {issue.review !== "reviewed" ? (
              <button className="btn" disabled={busy !== null} onClick={() => save({ review: "reviewed" })}>
                저장하고 검수 완료
              </button>
            ) : (
              <button className="btn" disabled={busy !== null} onClick={() => save({ review: "draft" })}>
                초안으로 되돌리기
              </button>
            )}
          </div>
          <button className="btn" disabled={busy !== null || !llm} title={llm ? "" : "ANTHROPIC_API_KEY 를 설정하면 활성화됩니다"} onClick={enrich}>
            {busy === "enrich" ? "생성 중…" : "자동 초안 생성"}
          </button>
        </div>

        <div className="card">
          <h3>
            <span className="chip chip-outline">태그</span> 5축 분류
          </h3>
          <div className="grid-2">
            <div className="field">
              <label>발표 주체 (표시명)</label>
              <input type="text" value={issue.agency} onChange={(e) => setIssue({ ...issue, agency: e.target.value })} />
            </div>
            <div className="field">
              <label>주체 그룹</label>
              <select value={issue.agencyGroup} onChange={(e) => setIssue({ ...issue, agencyGroup: e.target.value as AgencyGroup })}>
                {AGENCY_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {AGENCY_GROUP_LABEL[g]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>정책 단계</label>
              <select value={issue.status} onChange={(e) => setIssue({ ...issue, status: e.target.value as Status })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>주제</label>
              <select value={issue.topic} onChange={(e) => setIssue({ ...issue, topic: e.target.value as Topic })}>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>지역 범위</label>
              <select value={issue.region} onChange={(e) => setIssue({ ...issue, region: e.target.value as Region })}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {REGION_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>안양 행정동 (쉼표 구분)</label>
              <input type="text" value={issue.dong.join(", ")} onChange={(e) => setIssue({ ...issue, dong: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              <span className="hint">동이 있으면 해당 동 고객에게만 타깃 발송됩니다(R3).</span>
            </div>
            <div className="field">
              <label>시행일</label>
              <input type="date" value={issue.effectiveAt ?? ""} onChange={(e) => setIssue({ ...issue, effectiveAt: e.target.value || null })} />
            </div>
            <div className="field">
              <label>공식 원문 URL</label>
              <input type="url" value={issue.officialUrl ?? ""} onChange={(e) => setIssue({ ...issue, officialUrl: e.target.value || null })} />
            </div>
          </div>
          <label className="small" style={{ fontWeight: 600, color: "var(--ink-2)" }}>
            영향도 (0~5)
          </label>
          <div className="persona-grid" style={{ marginTop: 6 }}>
            {PERSONAS.map((p: Persona) => (
              <div key={p}>
                <label>{p}</label>
                <input type="number" min={0} max={5} value={issue.personas[p] ?? 0} onChange={(e) => setIssue({ ...issue, personas: { ...issue.personas, [p]: Math.max(0, Math.min(5, Number(e.target.value) || 0)) } })} />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>
            <span className="chip chip-c">고객용</span> 레터에 실리는 문장
          </h3>
          <div className="field">
            <label>고객용 제목 (30자 안팎)</label>
            <input type="text" value={issue.customer.headline} onChange={(e) => setC("headline", e.target.value)} />
          </div>
          <div className="field">
            <label>무슨 일 (2문장)</label>
            <textarea value={issue.customer.what} onChange={(e) => setC("what", e.target.value)} />
          </div>
          {SEGMENT_KEYS.map((s) => (
            <div className="field" key={s}>
              <label>
                나에게는 · {SEGMENTS[s].label} <span className="muted">({SEGMENTS[s].desc})</span>
              </label>
              <input type="text" value={issue.customer.forMe[s] ?? ""} onChange={(e) => setC("forMe", { ...issue.customer.forMe, [s]: e.target.value })} />
            </div>
          ))}
          <div className="field">
            <label>지금 할 일 (줄마다 하나, 최대 3개)</label>
            <textarea value={lines(issue.customer.actions)} onChange={(e) => setC("actions", unlines(e.target.value).slice(0, 3))} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>용어</label>
              <input type="text" value={issue.customer.glossary?.term ?? ""} onChange={(e) => setC("glossary", e.target.value ? { term: e.target.value, def: issue.customer.glossary?.def ?? "" } : null)} />
            </div>
            <div className="field">
              <label>용어 풀이</label>
              <input type="text" value={issue.customer.glossary?.def ?? ""} onChange={(e) => setC("glossary", issue.customer.glossary ? { ...issue.customer.glossary, def: e.target.value } : { term: "", def: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>
            <span className="chip chip-b">중개사용</span> 상담·실무
          </h3>
          <div className="field">
            <label>팩트 (대상·수치·일정·경과규정, 줄마다 하나)</label>
            <textarea value={lines(issue.broker.facts)} onChange={(e) => setB("facts", unlines(e.target.value))} />
          </div>
          <div className="field">
            <label>상담 스크립트 (고객이 물으면 이렇게)</label>
            <textarea value={lines(issue.broker.script)} onChange={(e) => setB("script", unlines(e.target.value))} />
          </div>
          <div className="field">
            <label>실무 체크리스트 (특약·확인설명서·신고·세무)</label>
            <textarea value={lines(issue.broker.checklist)} onChange={(e) => setB("checklist", unlines(e.target.value))} />
          </div>
          <div className="field">
            <label>FAQ (줄마다 "질문 || 답")</label>
            <textarea value={faqText} onChange={(e) => setFaqText(e.target.value)} />
          </div>
          <div className="field">
            <label>안양 지역 영향</label>
            <textarea value={issue.broker.local} onChange={(e) => setB("local", e.target.value)} />
          </div>
        </div>
      </div>

      <aside className="sticky">
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>고객용 미리보기</h3>
            <div className="seg" role="group" aria-label="세그먼트">
              {SEGMENT_KEYS.map((s) => (
                <button key={s} aria-pressed={segment === s} onClick={() => setSegment(s)}>
                  {SEGMENTS[s].label}
                </button>
              ))}
            </div>
          </div>
          <p className="small muted" style={{ margin: "6px 0 0" }}>
            {route.customer === "exclude"
              ? "중개사 전용으로 분류되어 고객 레터에는 실리지 않습니다."
              : route.customer === "watch"
                ? "고객 레터에는 '주요 뉴스' 카드(제목·기사 링크)로만 실립니다. 아래는 본문에 실릴 경우의 모습입니다."
                : route.customer === "target"
                  ? "해당 동을 지정한 레터에만 실립니다."
                  : "검수 완료 후 이 세그먼트 영향도가 3 이상이면 본문에 실립니다."}
          </p>
        </div>
        <div className="brief theme-navy compact">
          <div className="wrap">
            <LetterIssueCard item={preview} index={0} />
          </div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h4>이 이슈로 만들기</h4>
          <div className="row" style={{ marginTop: 6 }}>
            <a className="btn btn-sm" href={`/studio/instagram?issue=${issue.id}`}>
              인스타 카드뉴스
            </a>
            <a className="btn btn-sm" href={`/studio/blog?issue=${issue.id}`}>
              블로그 초안
            </a>
          </div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h4>중개사용 바로가기</h4>
          <ul className="small" style={{ marginTop: 6 }}>
            {links(TOPIC_LINKS[issue.topic].broker).map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer noopener">
                  {l.label}
                </a>{" "}
                <span className="muted">{l.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
