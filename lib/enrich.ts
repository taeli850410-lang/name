import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { REGION_LABEL, STATUS_LABEL, TOPIC_LABEL } from "./taxonomy";
import type { Issue, Persona, Region, Status, Topic } from "./types";

/**
 * 선택 기능: ANTHROPIC_API_KEY 가 있으면 수집된 이슈의 고객용·중개사용 초안을 Claude 가 작성합니다.
 * 결과는 항상 review='draft' 로 남고, 중개사가 스튜디오에서 검수해야 발행됩니다.
 */

export function llmEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function llmModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-opus-5";
}

const STATUS_VALUES = ["CONFIRMED", "SCHEDULED", "LEGISLATIVE_NOTICE", "IN_ASSEMBLY", "UNDER_REVIEW", "PRESS_REPORTED", "OUTLOOK", "STAT", "LOCAL_NOTICE"] as const;
const TOPIC_VALUES = ["rate", "tax", "subs", "supply", "redev", "lease", "transit", "stat", "regulation", "broker"] as const;
const REGION_VALUES = ["national", "metro", "local", "other"] as const;

const EnrichSchema = z.object({
  headline: z.string().describe("고객용 제목. 30자 안팎, 존댓말, 원문에 있는 숫자·기관명만 사용"),
  what: z.string().describe("무슨 일이 있었는지 2문장, 존댓말. 원문에 없는 수치·날짜는 쓰지 않는다"),
  forMe: z
    .object({
      first: z.string().describe("내집마련(무주택자·임차인)에게 달라지는 점 한 문장"),
      move: z.string().describe("보유·갈아타기(1주택자·매수·매도 예정)에게 달라지는 점 한 문장"),
      asset: z.string().describe("자산·임대(다주택자·임대인)에게 달라지는 점 한 문장"),
    })
    .describe("세그먼트별 '나에게는' 문장. 2인칭 존댓말, 지시문은 고객 본인의 행동에만"),
  actions: z.array(z.string()).describe("고객이 지금 할 일 1~3개. 각 항목은 고객 본인의 행동으로 시작"),
  glossary: z.object({ term: z.string(), def: z.string() }).nullable().describe("고객이 모를 만한 용어 1개와 쉬운 풀이. 없으면 null"),
  facts: z.array(z.string()).describe("중개사용 팩트: 대상·수치·일정·경과규정. 원문 근거만"),
  script: z.array(z.string()).describe("중개사용 상담 스크립트: 고객이 물으면 이렇게 설명"),
  checklist: z.array(z.string()).describe("중개사용 실무 체크리스트: 특약·확인설명서·신고 의무·세무 연계"),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe("예상 질문과 답 가이드 1~3개"),
  local: z.string().describe("담당 지역 관련 구역·단지·규제 영향, 또는 지역별 편차 메모. 근거 없으면 빈 문자열"),
  personas: z
    .object({
      무주택자: z.number(),
      "1주택자": z.number(),
      다주택자: z.number(),
      "매수 예정자": z.number(),
      "매도 예정자": z.number(),
      임대인: z.number(),
      임차인: z.number(),
      공인중개사: z.number(),
    })
    .describe("영향도 0~5 정수"),
  status: z.enum(STATUS_VALUES).describe("정책 단계"),
  topic: z.enum(TOPIC_VALUES).describe("주제"),
  region: z.enum(REGION_VALUES).describe("지역 범위"),
  agency: z.string().describe("실제 발표 주체 표시명 (예: 국토교통부, 한국은행, 지자체명, 언론사명)"),
  dong: z.array(z.string()).describe("담당 지역의 행정동 이름 목록. 담당 지역과 무관하면 빈 배열"),
  effectiveAt: z.string().nullable().describe("시행일 YYYY-MM-DD. 원문에 명시된 경우만, 아니면 null"),
});

export type EnrichResult = z.infer<typeof EnrichSchema>;

function systemPrompt(areaLabel: string, sigungu?: string): string {
  const scopeLine = sigungu
    ? `이 사무소는 ${sigungu}(표기: ${areaLabel})를 맡습니다. ${sigungu} 관련 기사만 region=local 로 잡고, dong 은 ${sigungu}의 행정동만 적습니다.`
    : `이 사무소는 전국을 대상으로 합니다. region 은 national·metro·other 중에서 고르고, local 은 쓰지 않으며 dong 은 항상 빈 배열입니다.`;
  return `당신은 공인중개사무소가 발행하는 부동산 브리핑의 편집자입니다.
${scopeLine}
보도자료·기사 하나를 받아 두 독자를 위한 초안을 씁니다.

[고객용 규칙]
- 2인칭 존댓말, 한 문장 30자 안팎, 어려운 용어는 첫 등장 시 풀이.
- 지시문("~하세요")은 고객 본인의 행동에만 씁니다. "고객에게", "안내하세요", "설명하세요", "상담 시", "영업", "경쟁", "수주", "협회" 같은 중개사 지침 표현은 고객용 필드에 절대 쓰지 않습니다.
- 확정된 내용과 논의·전망 단계를 분명히 구분합니다. 확정 전이면 "확정되면", "예정" 같은 표현을 씁니다.
- 원문에 없는 수치·날짜·대상을 만들어 내지 않습니다. 불확실하면 "원문 확인이 필요해요"라고 씁니다.

[중개사용 규칙]
- 명령형 체크리스트 허용. 법령·조문·수치는 원문 그대로.
- facts 는 대상·수치·일정·경과규정, script 는 고객이 물었을 때의 설명 방식, checklist 는 계약서 특약·확인설명서·신고 의무·세무사 연계.

[분류]
- status: ${Object.entries(STATUS_LABEL)
  .map(([k, v]) => `${k}=${v}`)
  .join(", ")}
- topic: ${Object.entries(TOPIC_LABEL)
  .map(([k, v]) => `${k}=${v}`)
  .join(", ")}
- region: ${Object.entries(REGION_LABEL)
  .map(([k, v]) => `${k}=${v}`)
  .join(", ")}
- personas 는 0~5 정수. 이 이슈가 그 대상에게 얼마나 중요한지.`;
}

function clampInt(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
}

export function applyEnrichment(issue: Issue, r: EnrichResult): Partial<Issue> {
  const personas = { ...issue.personas } as Record<Persona, number>;
  for (const k of Object.keys(r.personas) as Persona[]) personas[k] = clampInt(r.personas[k]);
  return {
    customer: {
      headline: r.headline.trim(),
      what: r.what.trim(),
      forMe: { first: r.forMe.first.trim(), move: r.forMe.move.trim(), asset: r.forMe.asset.trim() },
      actions: r.actions.map((a) => a.trim()).filter(Boolean).slice(0, 3),
      glossary: r.glossary && r.glossary.term.trim() ? { term: r.glossary.term.trim(), def: r.glossary.def.trim() } : null,
    },
    broker: {
      facts: r.facts.filter(Boolean),
      script: r.script.filter(Boolean),
      checklist: r.checklist.filter(Boolean),
      faq: r.faq.filter((f) => f.q && f.a).slice(0, 3),
      local: r.local.trim(),
    },
    personas,
    status: r.status as Status,
    topic: r.topic as Topic,
    region: r.region as Region,
    agency: r.agency.trim() || issue.agency,
    dong: r.dong.map((d) => d.trim()).filter(Boolean),
    effectiveAt: r.effectiveAt && /^\d{4}-\d{2}-\d{2}$/.test(r.effectiveAt) ? r.effectiveAt : issue.effectiveAt,
    enrichedBy: "llm",
    review: "draft",
    updatedAt: new Date().toISOString(),
  };
}

export async function enrichIssue(issue: Issue, office?: { areaLabel: string; sigungu?: string; scope?: "national" | "local" }): Promise<Partial<Issue> | null> {
  const areaLabel = office?.areaLabel || "전국";
  const sigungu = office?.scope === "local" ? office.sigungu?.trim() || undefined : undefined;
  if (!llmEnabled()) return null;
  const client = new Anthropic();
  const payload = {
    title: issue.title,
    summary: issue.summary,
    source: issue.sourceName,
    sourceKind: issue.sourceKind,
    publishedAt: issue.publishedAt,
    officialUrl: issue.officialUrl,
    articles: issue.articles.map((a) => ({ publisher: a.publisher, title: a.title, date: a.date, excerpt: a.excerpt })),
    currentTags: { agency: issue.agency, status: issue.status, topic: issue.topic, region: issue.region, dong: issue.dong },
  };
  const response = await client.beta.messages.parse({
    model: llmModel(),
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(EnrichSchema) },
    system: systemPrompt(areaLabel, sigungu),
    messages: [
      {
        role: "user",
        content: `다음 이슈의 고객용·중개사용 초안과 분류를 작성하세요.\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  const parsed = response.parsed_output;
  if (!parsed) return null;
  return applyEnrichment(issue, parsed);
}
