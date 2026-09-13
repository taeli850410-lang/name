import { editionLabel } from "./letter";
import { computeTiles } from "./market";
import { findForbidden, segmentImpact } from "./routing";
import { PERIOD_LABEL, PERSONAS, SEGMENTS, SEGMENT_KEYS, TOPIC_GLOSSARY } from "./taxonomy";
import type { Issue, MarketDoc, Office, Period, Segment } from "./types";

/**
 * 인스타그램 카드뉴스(1080×1350). 원본의 흐름(주제 → 장수·테마·템플릿 → 표지/본문/CTA)을 따르되,
 * 본문은 고객용 필드(무슨 일·나에게는·지금 할 일·용어)로 채웁니다. 중개사 지침 문장은 들어가지 않습니다.
 */

export type InstaThemeKey = "navy" | "blue" | "green" | "charcoal" | "burgundy" | "ivory";
export interface InstaTheme {
  label: string;
  bg: string;
  bg2: string;
  fg: string;
  accent: string;
  sub: string;
  muted: string;
  light: boolean;
}
export const INSTA_THEMES: Record<InstaThemeKey, InstaTheme> = {
  navy: { label: "남색", bg: "#122a5c", bg2: "#1c3a7a", fg: "#ffffff", accent: "#c9a15c", sub: "#d7e0f5", muted: "#a9b6d6", light: false },
  blue: { label: "블루", bg: "#173a8a", bg2: "#2352c9", fg: "#ffffff", accent: "#f2c94c", sub: "#dbe6ff", muted: "#a9bdf0", light: false },
  green: { label: "그린", bg: "#164d33", bg2: "#1f6b46", fg: "#ffffff", accent: "#c9a15c", sub: "#d5e8dc", muted: "#a3c2b0", light: false },
  charcoal: { label: "차콜", bg: "#1f2328", bg2: "#2d333b", fg: "#f5f5f4", accent: "#e0a75e", sub: "#e2d8c8", muted: "#9aa0a6", light: false },
  burgundy: { label: "버건디", bg: "#4a1224", bg2: "#6b1f38", fg: "#ffffff", accent: "#e6b96b", sub: "#f0d9e0", muted: "#c9a0ad", light: false },
  ivory: { label: "아이보리", bg: "#f7f3ea", bg2: "#efe8d9", fg: "#1b2a44", accent: "#b8863b", sub: "#5e5443", muted: "#8a8578", light: true },
};
export const INSTA_THEME_KEYS = Object.keys(INSTA_THEMES) as InstaThemeKey[];

export type InstaTemplateKey = "editorial" | "centered" | "minimal" | "serif";
export const INSTA_TEMPLATES: Record<InstaTemplateKey, string> = { editorial: "에디토리얼", centered: "센터", minimal: "미니멀", serif: "세리프" };
export const INSTA_MAX_CARDS = 10;
export const INSTA_TEMPLATE_KEYS = Object.keys(INSTA_TEMPLATES) as InstaTemplateKey[];

export interface Slide {
  kind: "solo" | "cover" | "body" | "cta";
  kicker?: string;
  title?: string;
  eyebrow?: string;
  text?: string;
  items?: string[];
  tags?: string[];
  dots?: number;
  foot: string;
  sub?: string;
}

export function audienceTags(issue: Issue): string[] {
  return PERSONAS.filter((p) => p !== "공인중개사" && (issue.personas[p] ?? 0) >= 3).map((p) => `#${p.replace(/\s/g, "")}`);
}

export function themeStyle(key: InstaThemeKey): Record<string, string> {
  const t = INSTA_THEMES[key] ?? INSTA_THEMES.navy;
  return {
    "--ic-bg": `linear-gradient(165deg, ${t.bg2}, ${t.bg})`,
    "--ic-fg": t.fg,
    "--ic-accent": t.accent,
    "--ic-sub": t.sub,
    "--ic-muted": t.muted,
    "--ic-border": t.light ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.18)",
    "--ic-chip": t.light ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.12)",
  };
}

function officeFoot(office: Office): string {
  return [office.officeName, office.repName ? `${office.repName} 공인중개사` : "", office.phone].filter(Boolean).join(" · ");
}

function kickerFor(issue: Issue, period: Period): string {
  const t = new Date(issue.publishedAt).getTime() || Date.now();
  const edition = editionLabel(period, t);
  return `${PERIOD_LABEL[period]} BRIEFING · ${period === "monthly" ? `${edition} 총정리` : edition}`;
}

/** 한 이슈를 n장(1~10)의 슬라이드로 구성합니다. 내용이 부족하면 가능한 장수까지만 만듭니다. */
export function buildSlides(issue: Issue, office: Office, market: MarketDoc, count: number, segment: Segment = "first", period: Period = "daily"): Slide[] {
  const c = issue.customer;
  const foot = officeFoot(office);
  const kicker = kickerFor(issue, period);
  const tags = audienceTags(issue);
  const title = c.headline || issue.title;

  if (count <= 1) {
    return [{ kind: "solo", kicker, title, text: c.what || issue.summary, tags, foot }];
  }

  const pool: Slide[] = [];
  if (c.what || issue.summary) pool.push({ kind: "body", eyebrow: "무슨 내용인가요?", text: c.what || issue.summary, foot: title });
  if (tags.length) pool.push({ kind: "body", eyebrow: "누구에게 영향을 주나요?", text: tags.join("  "), sub: "영향도 3 이상인 대상", foot: title });
  for (const s of [segment, ...SEGMENT_KEYS.filter((k) => k !== segment)]) {
    const line = c.forMe[s];
    if (line) pool.push({ kind: "body", eyebrow: `나에게는 · ${SEGMENTS[s].label}`, sub: SEGMENTS[s].desc, text: line, dots: segmentImpact(issue, s), foot: title });
  }
  if (c.actions.length) pool.push({ kind: "body", eyebrow: "지금 할 일", items: c.actions.slice(0, 3), foot: title });
  const faq = issue.broker.faq.find((f) => f.q && f.a);
  if (faq) pool.push({ kind: "body", eyebrow: "공인중개사 POINT", title: faq.q, text: faq.a, foot: title });
  const glossary = c.glossary ?? TOPIC_GLOSSARY[issue.topic];
  if (glossary) pool.push({ kind: "body", eyebrow: "용어 하나", title: glossary.term, text: glossary.def, foot: title });
  const { tiles } = computeTiles(market, segment);
  if (tiles.length) {
    pool.push({
      kind: "body",
      eyebrow: `우리 동네 숫자 · ${office.areaLabel}`,
      items: tiles.slice(0, 3).map((t) => `${t.label}${t.provisional ? "(잠정)" : ""}  ${t.value}${t.delta ? `  ${t.delta}` : ""}`),
      sub: "출처·기준일이 확인된 수치만 · 최근 두 달은 잠정치",
      foot: title,
    });
  }
  const arts = issue.articles.filter((a) => a.url).slice(0, 3);
  if (arts.length) pool.push({ kind: "body", eyebrow: "관련 보도", items: arts.map((a) => `${a.publisher} · ${a.title}`), sub: "기사 원문은 프로필 링크의 브리핑에서", foot: title });

  const bodyCount = Math.max(0, Math.min(Math.min(count, INSTA_MAX_CARDS) - 2, pool.length));
  return [
    { kind: "cover", kicker, title, tags, foot: `${foot}  ·  넘겨보세요 →` },
    ...pool.slice(0, bodyCount),
    { kind: "cta", title: "이 정책이 내 집에는\n어떤 영향을 줄까요?", text: "매도·매수·갈아타기·정책 상담 — 공인중개사가 확정된 숫자로 함께 정리해 드립니다.", foot, sub: office.address },
  ];
}

/** 카드에 실리는 모든 문장에 대해 R7 금지 표현 검사 */
export function slidesForbidden(slides: Slide[]): string[] {
  const texts = slides.flatMap((s) => [s.title ?? "", s.text ?? "", ...(s.items ?? [])]);
  return Array.from(new Set(texts.flatMap((t) => findForbidden(t))));
}
