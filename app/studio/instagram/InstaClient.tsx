"use client";

import { toPng } from "html-to-image";
import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AgencyBadge, ReviewChip } from "@/components/Badges";
import { dots, fmtDate, fmtDateTime } from "@/lib/format";
import {
  buildSlides,
  INSTA_MAX_CARDS,
  INSTA_TEMPLATES,
  INSTA_TEMPLATE_KEYS,
  INSTA_THEMES,
  INSTA_THEME_KEYS,
  slidesForbidden,
  themeStyle,
  type InstaTemplateKey,
  type InstaThemeKey,
  type Slide,
} from "@/lib/insta";
import { focusRank } from "@/lib/routing";
import { SEGMENTS, SEGMENT_KEYS, TOPIC_LABEL } from "@/lib/taxonomy";
import type { InstaSave, Issue, MarketDoc, Office, Period, Segment, Topic } from "@/lib/types";

const W = 1080;
const H = 1350;
const PERIOD_KO: Record<Period, string> = { daily: "일간", weekly: "주간", monthly: "월간" };

function ScaledCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.4);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setK(el.clientWidth / W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="icard-scale" ref={ref}>
      <div className="icard-inner" style={{ transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
  );
}

function CardTop({ office, idx, total }: { office: Office; idx: number; total: number }) {
  return (
    <div className="ic-top">
      <span className="ic-brand">{office.officeName}</span>
      <span className="ic-idx">
        {String(idx + 1).padStart(2, "0")} / {total}
      </span>
    </div>
  );
}

function Card({ slide, idx, total, office, theme, template }: { slide: Slide; idx: number; total: number; office: Office; theme: InstaThemeKey; template: InstaTemplateKey }) {
  const style = themeStyle(theme) as CSSProperties;
  const cls = `icard ${slide.kind} t-${template}`;
  if (slide.kind === "solo") {
    return (
      <div className={cls} style={style}>
        <CardTop office={office} idx={idx} total={total} />
        <div className="ic-kicker">{slide.kicker}</div>
        <h1>{slide.title}</h1>
        <div className="ic-rule" />
        <p className="ic-body">{slide.text}</p>
        {slide.tags && slide.tags.length > 0 && (
          <div className="ic-tags">
            {slide.tags.map((t) => (
              <span className="ic-tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="ic-foot">{slide.foot}</div>
      </div>
    );
  }
  if (slide.kind === "cover") {
    return (
      <div className={cls} style={style}>
        <CardTop office={office} idx={idx} total={total} />
        <div className="ic-kicker">{slide.kicker}</div>
        <h1>{slide.title}</h1>
        <div className="ic-rule" />
        {slide.tags && slide.tags.length > 0 && (
          <div className="ic-tags">
            {slide.tags.map((t) => (
              <span className="ic-tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="ic-foot">{slide.foot}</div>
      </div>
    );
  }
  if (slide.kind === "cta") {
    return (
      <div className={cls} style={style}>
        <span className="ic-idx ic-idx-abs">
          {String(idx + 1).padStart(2, "0")} / {total}
        </span>
        <div className="ic-cta-mark">☏</div>
        <h2>
          {(slide.title ?? "").split("\n").map((l, i) => (
            <span key={i}>
              {l}
              <br />
            </span>
          ))}
        </h2>
        <p className="ic-cta-sub">{slide.text}</p>
        {office.phone && <div className="ic-phone">{office.phone}</div>}
        <div className="ic-foot">
          {slide.foot}
          {slide.sub ? <br /> : null}
          {slide.sub}
          <br />
          정보 제공 목적의 자료입니다 · 개별 판단은 상담으로 확인하세요
        </div>
      </div>
    );
  }
  return (
    <div className={cls} style={style}>
      <CardTop office={office} idx={idx} total={total} />
      <div className="ic-eyebrow">
        {slide.eyebrow}
        {slide.dots != null && <span className="ic-dots">{dots(slide.dots)}</span>}
      </div>
      {slide.sub && <div className="ic-sub">{slide.sub}</div>}
      {slide.title && <h3 className="ic-term">{slide.title}</h3>}
      {slide.text && <p className="ic-body">{slide.text}</p>}
      {slide.items && (
        <ol className="ic-list">
          {slide.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )}
      <div className="ic-foot">{slide.foot}</div>
    </div>
  );
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function cardToPng(card: HTMLElement): Promise<string> {
  const clone = card.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.style.borderRadius = "0";
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;height:${H}px;z-index:-1;pointer-events:none;`;
  holder.appendChild(clone);
  document.body.appendChild(holder);
  try {
    return await toPng(clone, { width: W, height: H, pixelRatio: 1, cacheBust: true });
  } finally {
    holder.remove();
  }
}

/**
 * 인스타 카드뉴스 화면. 원본 스튜디오의 뼈대를 따릅니다:
 * 저장목록 → "{주기} 카드뉴스 — 주제 (N)" 목록 → 주제 선택 → 장수(1~10)·색상 테마·템플릿 → 카드가 세로로 쌓이고 카드마다 저장 버튼.
 */
export default function InstaClient({
  issues,
  office,
  market,
  initialSaves,
  initialIssueId = null,
  period = "daily",
  focusTopics = [],
}: {
  issues: Issue[];
  office: Office;
  market: MarketDoc;
  initialSaves: InstaSave[];
  initialIssueId?: string | null;
  period?: Period;
  focusTopics?: Topic[];
}) {
  const [issueId, setIssueId] = useState<string | null>(initialIssueId && issues.some((i) => i.id === initialIssueId) ? initialIssueId : null);
  const [count, setCount] = useState(5);
  const [theme, setTheme] = useState<InstaThemeKey>("navy");
  const [template, setTemplate] = useState<InstaTemplateKey>("editorial");
  const [segment, setSegment] = useState<Segment>("first");
  const [listOpen, setListOpen] = useState(false);
  const [saves, setSaves] = useState<InstaSave[]>(initialSaves);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);

  const issue = useMemo(() => issues.find((i) => i.id === issueId) ?? null, [issues, issueId]);
  const slides = useMemo(() => (issue ? buildSlides(issue, office, market, count, segment, period) : []), [issue, office, market, count, segment, period]);
  const forbidden = useMemo(() => slidesForbidden(slides), [slides]);
  // 주력 주제를 먼저, 그 안에서 최신순
  const sorted = useMemo(
    () =>
      [...issues].sort((a, b) => {
        const f = focusRank(a.topic, focusTopics) - focusRank(b.topic, focusTopics);
        return f !== 0 ? f : new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }),
    [issues, focusTopics],
  );

  function fileBase(i: number) {
    return `landlanguage-${theme}-${template}-${String(i + 1).padStart(2, "0")}.png`;
  }

  async function saveOne(i: number) {
    const cards = deckRef.current?.querySelectorAll<HTMLElement>(".icard") ?? [];
    const card = cards[i];
    if (!card) return;
    setBusy("png");
    try {
      download(await cardToPng(card), fileBase(i));
      setMsg({ tone: "ok", text: `${i + 1}번 카드를 저장했습니다.` });
    } catch (e) {
      setMsg({ tone: "error", text: `이미지 저장 실패: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function saveAll(asZip: boolean) {
    const cards = Array.from(deckRef.current?.querySelectorAll<HTMLElement>(".icard") ?? []);
    if (!cards.length) return;
    setBusy(asZip ? "zip" : "all");
    try {
      if (asZip) {
        const zip = new JSZip();
        for (let i = 0; i < cards.length; i++) {
          setMsg({ tone: "info", text: `이미지 만드는 중… ${i + 1}/${cards.length}` });
          const png = await cardToPng(cards[i]);
          zip.file(fileBase(i), png.split(",")[1], { base64: true });
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        download(url, `landlanguage-${theme}-${template}-cards.zip`);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setMsg({ tone: "ok", text: `${cards.length}장을 ZIP 한 파일로 저장했습니다.` });
      } else {
        for (let i = 0; i < cards.length; i++) {
          setMsg({ tone: "info", text: `이미지 저장 중… ${i + 1}/${cards.length}` });
          download(await cardToPng(cards[i]), fileBase(i));
          await new Promise((r) => setTimeout(r, 400));
        }
        setMsg({ tone: "ok", text: `${cards.length}장 저장 완료.` });
      }
    } catch (e) {
      setMsg({ tone: "error", text: `저장 실패: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function saveConfig() {
    if (!issue) return;
    setBusy("cfg");
    try {
      const res = await fetch("/api/studio/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: issue.id, title: issue.customer.headline || issue.title, count, theme, template, segment }),
      });
      const data = (await res.json()) as { saves?: InstaSave[]; error?: string };
      if (!res.ok || !data.saves) throw new Error(data.error || res.statusText);
      setSaves(data.saves);
      setMsg({ tone: "ok", text: "현재 카드뉴스 구성을 저장했습니다." });
    } catch (e) {
      setMsg({ tone: "error", text: `구성 저장 실패: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function removeSave(id: string) {
    if (!window.confirm("이 구성을 삭제할까요?")) return;
    const res = await fetch(`/api/studio/instagram?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = (await res.json()) as { saves?: InstaSave[] };
    if (data.saves) setSaves(data.saves);
  }

  function openSave(s: InstaSave) {
    if (!issues.some((i) => i.id === s.issueId)) {
      setMsg({ tone: "error", text: "저장된 구성의 이슈가 이 기간 목록에 없습니다. 상단 바에서 주기를 바꿔 보세요." });
      return;
    }
    setIssueId(s.issueId);
    setCount(Math.min(INSTA_MAX_CARDS, s.count));
    setTheme((INSTA_THEME_KEYS.includes(s.theme as InstaThemeKey) ? s.theme : "navy") as InstaThemeKey);
    setTemplate((INSTA_TEMPLATE_KEYS.includes(s.template as InstaTemplateKey) ? s.template : "editorial") as InstaTemplateKey);
    setSegment(s.segment);
    setListOpen(false);
  }

  /* ── 주제 선택 / 저장목록 ── */
  if (!issue) {
    return (
      <div className="panel">
        <div className="row between">
          <button className="btn" onClick={() => setListOpen(!listOpen)} aria-pressed={listOpen}>
            {listOpen ? "← 주제 선택" : `저장목록 (${saves.length})`}
          </button>
        </div>
        {msg && <div className={`alert alert-${msg.tone} banner`} style={{ marginTop: 10 }}>{msg.text}</div>}
        {listOpen ? (
          <div className="stack" style={{ marginTop: 14 }}>
            {saves.length === 0 && <div className="card">저장된 구성이 없습니다. 주제·장수·테마를 고른 뒤 '현재 구성 저장'을 눌러 보세요.</div>}
            {saves.map((s) => (
              <div className="card row between" key={s.id}>
                <div>
                  <b>{s.title}</b>
                  <div className="small muted">
                    {s.count}장 · {INSTA_THEMES[s.theme as InstaThemeKey]?.label ?? s.theme} · {INSTA_TEMPLATES[s.template as InstaTemplateKey] ?? s.template} · {SEGMENTS[s.segment].label} · {fmtDateTime(s.createdAt)}
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-sm" onClick={() => openSave(s)}>
                    열기
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeSave(s.id)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <h2 className="panel-title">
              {PERIOD_KO[period]} 카드뉴스 — 주제 ({sorted.length})
            </h2>
            <p className="panel-sub">주제를 선택하면 카드 장수(1~{INSTA_MAX_CARDS}장)를 골라 카드뉴스를 만듭니다. 상단 바에서 주기를 바꾸면 주제 목록이 바뀝니다.</p>
            <div className="stack">
              {sorted.length === 0 && <div className="card">이 기간에 수집된 주제가 없습니다. 상단 바에서 WEEKLY·MONTHLY 로 바꾸거나 인박스에서 '지금 수집'을 눌러 보세요.</div>}
              {sorted.map((i) => (
                <button className="topic-row" key={i.id} onClick={() => setIssueId(i.id)} title={`${i.title} · ${fmtDate(i.publishedAt)}`}>
                  <AgencyBadge agency={i.agency} />
                  <span className="topic-title">{i.customer.headline || i.title}</span>
                  {focusTopics.includes(i.topic) && <span className="chip chip-star">★ {TOPIC_LABEL[i.topic]}</span>}
                  {i.review !== "reviewed" && <ReviewChip review={i.review} />}
                  <span className="topic-arrow">→</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ── 카드 구성 ── */
  return (
    <div className="panel insta-layout">
      <div className="card insta-controls">
        <button className="btn btn-sm" onClick={() => setIssueId(null)}>
          ← 주제 다시 선택
        </button>
        {issue.review !== "reviewed" && <div className="alert alert-warn small" style={{ marginTop: 10 }}>검수 전 이슈입니다. 문장을 확인한 뒤 배포하세요.</div>}
        {forbidden.length > 0 && <div className="alert alert-error small" style={{ marginTop: 10 }}>카드에 고객용 금지 표현이 있습니다: {forbidden.join(", ")}. 이슈 상세에서 고치세요.</div>}

        <div className="field" style={{ marginTop: 12 }}>
          <label>카드 장수 — {slides.length}장 생성됨</label>
          <div className="count-seg">
            {Array.from({ length: INSTA_MAX_CARDS }, (_, i) => i + 1).map((n) => (
              <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
          {count >= 3 && slides.length < count && <span className="hint">이 주제는 내용 기준 최대 {slides.length}장까지 구성됩니다.</span>}
        </div>
        <div className="field">
          <label>색상 테마</label>
          <div className="theme-seg">
            {INSTA_THEME_KEYS.map((k) => (
              <button key={k} aria-pressed={theme === k} title={INSTA_THEMES[k].label} onClick={() => setTheme(k)} style={{ background: `linear-gradient(165deg, ${INSTA_THEMES[k].bg2}, ${INSTA_THEMES[k].bg})` }}>
                <i style={{ background: INSTA_THEMES[k].accent }} />
              </button>
            ))}
            <span className="small muted">{INSTA_THEMES[theme].label}</span>
          </div>
        </div>
        <div className="field">
          <label>템플릿</label>
          <div className="seg">
            {INSTA_TEMPLATE_KEYS.map((k) => (
              <button key={k} aria-pressed={template === k} onClick={() => setTemplate(k)}>
                {INSTA_TEMPLATES[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>먼저 보여줄 대상</label>
          <div className="seg">
            {SEGMENT_KEYS.map((s) => (
              <button key={s} aria-pressed={segment === s} onClick={() => setSegment(s)}>
                {SEGMENTS[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => saveAll(true)}>
            {busy === "zip" ? "만드는 중…" : `전체 이미지 한번에 저장 (ZIP · ${slides.length}장)`}
          </button>
          <button className="btn" disabled={busy !== null} onClick={() => saveAll(false)}>
            개별 저장
          </button>
          <button className="btn" disabled={busy !== null} onClick={saveConfig}>
            현재 구성 저장
          </button>
        </div>
        <p className="hint small muted" style={{ marginTop: 8 }}>
          선택 주제: {issue.customer.headline || issue.title} · 전체 저장(ZIP)은 카드 {slides.length}장을 하나의 압축 파일로 내려받습니다. 각 카드의 저장 버튼으로 개별 저장도 가능합니다. PNG 는
          1080×1350 원본 크기입니다.
        </p>
        {msg && <div className={`alert alert-${msg.tone} small`} style={{ marginTop: 8 }}>{msg.text}</div>}
      </div>

      <div className="insta-deck" ref={deckRef}>
        {slides.map((s, i) => (
          <div className="insta-item" key={i}>
            <button className="card-save btn btn-sm" disabled={busy !== null} onClick={() => saveOne(i)}>
              저장
            </button>
            <ScaledCard>
              <Card slide={s} idx={i} total={slides.length} office={office} theme={theme} template={template} />
            </ScaledCard>
          </div>
        ))}
      </div>
    </div>
  );
}
