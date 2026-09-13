"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgencyBadge, ReviewChip } from "@/components/Badges";
import { blogForbidden, generateBlogPost } from "@/lib/blog";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { mdToHtml } from "@/lib/markdown";
import type { BlogPost, Issue, MarketDoc, Office, Period } from "@/lib/types";

type Mode = "topics" | "list" | "view" | "edit";
const PERIOD_KO: Record<Period, string> = { daily: "일간", weekly: "주간", monthly: "월간" };

export default function BlogClient({
  issues,
  office,
  market,
  initialPosts,
  initialIssueId = null,
  initialPostId = null,
  period = "daily",
}: {
  issues: Issue[];
  office: Office;
  market: MarketDoc;
  initialPosts: BlogPost[];
  initialIssueId?: string | null;
  initialPostId?: string | null;
  period?: Period;
}) {
  const openPost = initialPostId ? initialPosts.find((p) => p.id === initialPostId) ?? null : null;
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [mode, setMode] = useState<Mode>(openPost ? "view" : initialPosts.length ? "list" : "topics");
  const [current, setCurrent] = useState<BlogPost | null>(openPost);
  const autoRan = useRef(false);
  const [draftBody, setDraftBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);

  const sorted = useMemo(() => [...issues].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()), [issues]);
  const html = useMemo(() => (current ? mdToHtml(current.body) : ""), [current]);
  const hints = useMemo(() => (current ? blogForbidden(current.body) : []), [current]);

  async function persist(post: BlogPost): Promise<BlogPost | null> {
    setBusy(true);
    try {
      const res = await fetch("/api/studio/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(post) });
      const data = (await res.json()) as { posts?: BlogPost[]; post?: BlogPost; error?: string };
      if (!res.ok || !data.posts || !data.post) throw new Error(data.error || res.statusText);
      setPosts(data.posts);
      return data.post;
    } catch (e) {
      setMsg({ tone: "error", text: `저장 실패: ${(e as Error).message}` });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createFrom(issue: Issue) {
    const post = generateBlogPost(issue, office, market);
    const saved = await persist(post);
    if (saved) {
      setCurrent(saved);
      setMode("view");
      setMsg({ tone: "ok", text: "초안이 생성되어 저장목록에 추가되었습니다." });
    }
  }

  // /studio/blog?issue=<id> 로 들어오면 그 이슈의 초안을 바로 만듭니다 (이슈 상세의 '블로그 초안' 링크)
  useEffect(() => {
    if (autoRan.current || !initialIssueId) return;
    autoRan.current = true;
    const target = issues.find((i) => i.id === initialIssueId);
    if (target) void createFrom(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIssueId]);

  async function saveEdit() {
    if (!current) return;
    const saved = await persist({ ...current, body: draftBody });
    if (saved) {
      setCurrent(saved);
      setMode("view");
      setMsg({ tone: "ok", text: "저장되었습니다." });
    }
  }

  async function remove(id: string) {
    if (!window.confirm("이 포스팅을 삭제할까요?")) return;
    const res = await fetch(`/api/studio/blog?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = (await res.json()) as { posts?: BlogPost[] };
    if (data.posts) {
      setPosts(data.posts);
      if (current?.id === id) {
        setCurrent(null);
        setMode(data.posts.length ? "list" : "topics");
      }
      setMsg({ tone: "ok", text: "삭제되었습니다." });
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ tone: "ok", text: `${label}을 복사했습니다.` });
    } catch {
      window.prompt("복사", text);
    }
  }

  const toolbar = (
    <div className="row" style={{ marginBottom: 10 }}>
      {mode !== "topics" && (
        <button className="btn" onClick={() => setMode("topics")}>
          ← 주제 선택
        </button>
      )}
      <button className="btn" onClick={() => setMode(mode === "list" ? "topics" : "list")} aria-pressed={mode === "list"}>
        저장목록 ({posts.length})
      </button>
      {current && (mode === "view" || mode === "edit") && (
        <>
          <span style={{ flex: 1 }} />
          {mode === "view" ? (
            <button
              className="btn"
              onClick={() => {
                setDraftBody(current.body);
                setMode("edit");
              }}
            >
              수정
            </button>
          ) : (
            <>
              <button className="btn btn-primary" disabled={busy} onClick={saveEdit}>
                저장
              </button>
              <button className="btn" onClick={() => setMode("view")}>
                취소
              </button>
            </>
          )}
          <button className="btn" onClick={() => copy(current.body, "마크다운")}>
            마크다운 복사
          </button>
          <button className="btn" onClick={() => copy(html, "HTML")}>
            HTML 복사
          </button>
          <button className="btn btn-danger" onClick={() => remove(current.id)}>
            삭제
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className={mode === "topics" || mode === "list" ? "panel" : "blog"}>
      {toolbar}
      {msg && <div className={`alert alert-${msg.tone} banner`}>{msg.text}</div>}

      {mode === "topics" && (
        <>
          <h2 className="panel-title">
            {PERIOD_KO[period]} 블로그 포스팅 — 주제 ({sorted.length})
          </h2>
          <p className="panel-sub">주제를 선택하면 SEO 골격(제목·메타·목차·소제목 8개·이미지 위치·직접 경험 슬롯·표·차트·FAQ)의 초안을 만들어 저장목록에 넣습니다. 상단 바에서 주기를 바꾸면 주제 목록이 바뀝니다.</p>
          <div className="stack">
            {sorted.length === 0 && <div className="card">이 기간에 수집된 주제가 없습니다. 상단 바에서 WEEKLY·MONTHLY 로 바꾸거나 인박스에서 '지금 수집'을 눌러 보세요.</div>}
            {sorted.map((i) => (
              <button className="topic-row" key={i.id} disabled={busy} onClick={() => createFrom(i)} title={`${i.title} · ${fmtDate(i.publishedAt)}`}>
                <AgencyBadge agency={i.agency} />
                <span className="topic-title">{i.customer.headline || i.title}</span>
                {i.review !== "reviewed" && <ReviewChip review={i.review} />}
                <span className="topic-arrow">→</span>
              </button>
            ))}
          </div>
        </>
      )}

      {mode === "list" && (
        <div className="stack">
          {posts.length === 0 && <div className="card">저장된 포스팅이 없습니다. '새 포스팅'에서 주제를 골라 보세요.</div>}
          {posts.map((p) => (
            <div className="card row between" key={p.id}>
              <div style={{ minWidth: 0 }}>
                <b>{p.title}</b>
                <div className="small muted">
                  {p.topicLabel} · 최종수정 {fmtDateTime(p.updatedAt)}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setCurrent(p);
                    setMode("view");
                  }}
                >
                  열기
                </button>
                <button className="btn btn-sm" onClick={() => copy(p.body, "마크다운")}>
                  복사
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && mode === "view" && (
        <>
          <p className="small muted">
            {current.topicLabel} · 최종수정 {fmtDateTime(current.updatedAt)}
            {hints.length > 0 && <> · 검토 힌트: 중개사 지침 표현({hints.join(", ")})이 본문에 있습니다. 공개 글이라면 표현을 다듬으세요.</>}
          </p>
          <article className="blog-doc" dangerouslySetInnerHTML={{ __html: html }} />
        </>
      )}

      {current && mode === "edit" && <textarea className="blog-editor" value={draftBody} onChange={(e) => setDraftBody(e.target.value)} spellCheck={false} />}
    </div>
  );
}
