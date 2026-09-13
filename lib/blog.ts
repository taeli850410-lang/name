import { clamp, dots, fmtDate, newId } from "./format";
import { computeTiles } from "./market";
import { findForbidden, segmentImpact } from "./routing";
import { sortArticles } from "./source";
import { PERSONAS, SEGMENTS, SEGMENT_KEYS, STATUS_LABEL, TOPIC_GLOSSARY, TOPIC_LABEL } from "./taxonomy";
import type { BlogPost, Issue, MarketDoc, Office } from "./types";

/**
 * 블로그 포스팅 초안(마크다운). 원본의 SEO 골격(제목·메타·목차·소제목 8개·이미지 위치·직접 경험 슬롯·표·차트·FAQ·CTA)을
 * 유지하되 내용은 이슈 레코드의 고객용·중개사용 필드와 우리 동네 숫자에서 가져옵니다. 없는 수치는 만들지 않습니다.
 */

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

function imgSlot(n: number, what: string, why: string, alt: string): string {
  return `> 🖼️ **[이미지 추가위치 ${CIRCLED[n - 1] ?? n}]**
> - **어떤 이미지:** ${what}
> - **넣는 이유:** ${why}
> - **대체텍스트(alt) 예시:** ${alt}
> - **주의:** 이미지 속 핵심 문구·숫자·일정은 본문에도 그대로 적어 주세요. 이미지만으로는 검색 노출에 불리합니다.`;
}

const urlHost = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

export function generateBlogPost(issue: Issue, office: Office, market: MarketDoc): BlogPost {
  const c = issue.customer;
  const b = issue.broker;
  const base = c.headline || issue.title;
  const kw = clamp(base, 22);
  const audience = PERSONAS.filter((p) => p !== "공인중개사" && (issue.personas[p] ?? 0) >= 3);
  const today = fmtDate(new Date().toISOString());
  const title = `${base} — 내집마련·보유·임대 상황별 영향과 상담 전 체크리스트`;
  const meta = clamp(`${base}. 무주택자·1주택자·다주택자에게 각각 어떤 의미인지, 매수·매도 전 확인할 점을 현직 공인중개사가 실무 관점에서 정리했습니다.`, 158);
  const facts = b.facts.length ? b.facts : c.actions;
  const [lead, ...rest] = issue.articles.filter((a) => a.url);
  const arts = (lead ? [lead, ...sortArticles(rest)] : []).slice(0, 4);
  const artLines = arts.length ? arts.map((a) => `- [${a.publisher} · ${a.title}](${a.url})`).join("\n") : "- (참고 보도 링크를 추가하세요)";
  const glossary = c.glossary ?? TOPIC_GLOSSARY[issue.topic];
  const extraGlossary = c.glossary && c.glossary.term !== TOPIC_GLOSSARY[issue.topic].term ? TOPIC_GLOSSARY[issue.topic] : null;
  const { tiles, history } = computeTiles(market, "move");
  const tileRows = tiles.map((t) => `| ${t.label}${t.provisional ? " (잠정)" : ""} | ${t.value} | ${t.delta || "-"} | ${t.asOf} | [${urlHost(t.sourceUrl)}](${t.sourceUrl}) |`).join("\n");
  const historyChart = history.length > 1 ? `\n[[CHART\ntitle:${office.areaLabel} 아파트 매매 중위가 추이 (만원)\nunit:\n${history.map((h) => `${h.label}:${h.value}`).join("\n")}\nCHART]]\n` : "";
  const personaChart = `\n[[CHART\ntitle:보유 형태별 영향도 (0~5)\nunit:\n${PERSONAS.filter((p) => p !== "공인중개사")
    .map((p) => `${p}:${issue.personas[p] ?? 0}`)
    .join("\n")}\nCHART]]\n`;
  const segRows = SEGMENT_KEYS.map((s) => {
    const lv = segmentImpact(issue, s);
    return `| ${SEGMENTS[s].label} | ${dots(lv)} (${lv}/5) | ${SEGMENTS[s].desc} | ${c.forMe[s] || "직접적인 영향은 제한적이에요."} |`;
  }).join("\n");
  const checklist = Array.from(
    new Set([
      ...c.actions,
      ...b.checklist,
      "확정된 내용인지, 논의·전망 단계인지 먼저 구분하기",
      "적용 지역·시행 시점·대상 요건을 공식 원문에서 직접 확인하기",
      "내 대출 유형(변동·고정)과 다음 금리 변경일 확인하기",
      "세무·법률 판단이 필요하면 전문가와 별도로 상담하기",
    ]),
  ).filter(Boolean);
  const faq = [
    ...b.faq.map((f) => `**Q. ${f.q}**\n\nA. ${f.a}`),
    `**Q. "${clamp(base, 30)}", 이거 확정된 건가요?**\n\nA. 현재는 **${STATUS_LABEL[issue.status]}** 단계입니다. ${
      issue.status === "CONFIRMED" || issue.status === "SCHEDULED" || issue.status === "STAT" || issue.status === "LOCAL_NOTICE"
        ? "확정된 사안이지만 세부 시행 조건은 원문에서 다시 확인하시는 게 안전합니다."
        : "아직 확정 전이므로 이 정보만으로 매수·매도 시점을 서두르지 마시고, 공식 발표를 기다리며 자금 계획을 미리 점검해 두시길 권합니다."
    }`,
    `**Q. 이 글의 정보, 어디까지 믿어도 되나요?**\n\nA. 이 글은 ${arts.length ? arts.map((a) => a.publisher).join("·") + " 등 공개 자료" : "공개된 자료"}를 바탕으로 정리했습니다. 세부 수치·시행일은 시간이 지나며 바뀔 수 있으니, 실제 판단은 반드시 공식 원문을 재확인한 뒤 내리시길 권합니다.`,
  ].join("\n\n");
  const scriptLines = b.script.length ? b.script.map((s, i) => `${i + 1}. ${s}`).join("\n") : "1. (상담에서 확인하는 포인트를 채워주세요)";

  const body = `# ${title}

> **메타 설명(160자 이내):** ${meta}

## 이 글이 필요한 분
- ${audience.length ? audience.join(" · ") : "내 집 마련·갈아타기·임대를 고민하는 분"} — 뉴스는 봤는데 "그래서 내 상황에선 뭐가 달라지나"가 궁금한 분
- 매수·매도·갈아타기 시점을 고민 중이라 근거 있는 판단 기준이 필요한 분
- 복잡한 정책 용어를 한 번에 이해하고 싶은 분
- 작성일 ${today} · 참고 출처는 글 맨 아래 링크로 정리했습니다.

## 목차
1. 먼저, 무슨 내용인지 팩트로 정리
2. 알아두면 좋은 용어
3. 내집마련·보유·임대 — 상황별로 뭐가 달라지나
4. 공인중개사가 상담에서 실제로 보는 것
5. 숫자로 보는 우리 동네 시장 흐름
6. 상담 전 실무 체크리스트
7. 자주 묻는 질문
8. 마치며 — 제 생각

## 들어가며
${c.what || issue.summary}

뉴스 헤드라인만 보면 막연히 불안해지거나, 반대로 "나랑 상관없는 얘기겠지" 하고 무덤덤해지기 쉽습니다. 하지만 현장에서 매일 상담을 하다 보면, 정작 중요한 건 발표 그 자체가 아니라 **"이게 내 조건에 실제로 적용되는지, 적용된다면 언제부터인지"** 라는 걸 절실히 느낍니다. 같은 뉴스를 보고도 어떤 분은 서둘러 계약을 진행하고, 어떤 분은 몇 달을 더 관망합니다. 그 차이는 정보를 얼마나 많이 아느냐가 아니라, 그 정보를 **본인 상황에 맞게 해석**했는지에서 갈립니다.

이 글에서는 이번 이슈가 정확히 무엇인지 사실관계부터 정리하고, 내집마련·보유·임대 등 상황별로 어떤 의미가 있는지, 그리고 실제 상담에서 공인중개사가 어떤 부분을 확인하는지까지 순서대로 설명해 드리겠습니다.

${imgSlot(1, `이 글의 대표 이미지(썸네일). "${kw}"를 상징하는 실사 사진(아파트 단지·계약서·상담 장면 등) 또는 제목을 큼직하게 넣은 자체 제작 배너 1장. 권장 비율 1200×630.`, "목록·검색 결과·SNS 공유 시 클릭을 유도하고, 글 주제를 한눈에 전달합니다.", `"${kw} 관련 안내 이미지 – 상황별 영향 정리"`)}

> ✍️ [직접 경험 입력] 이 이슈가 나온 뒤 실제로 받은 문의(예: "지금 계약해도 되나요"), 상담하며 느낀 분위기 변화를 1~2문장 적어주세요. 직접 겪은 이야기가 상위노출에서 가장 큰 힘이 됩니다.

## 1. 먼저, 무슨 내용인지 팩트로 정리
${c.what || issue.summary}

이번 사안은 현재 **${STATUS_LABEL[issue.status]}** 단계입니다. '확정'과 '검토·전망'은 전혀 다른 이야기입니다. 확정된 정책은 시행일과 적용 대상이 정해져 있어 그에 맞춰 계획을 세울 수 있지만, 검토 중이거나 보도만 된 단계라면 내용이 얼마든지 바뀔 수 있습니다.

핵심만 추리면 이렇습니다.
${facts.length ? facts.map((f) => `- ${f}`).join("\n") : "- (핵심 요약 3줄을 채워주세요)"}

관련 보도 원문:
${artLines}${issue.officialUrl ? `\n- 공식 원문: ${issue.officialUrl}` : ""}

${imgSlot(2, `${issue.agency}의 공식 자료 화면 또는 관련 기사 캡처 1장. 발표일·적용 시점·핵심 수치에 밑줄/박스로 표시.`, '"어디서 나온 이야기인지" 출처를 시각적으로 보여 주면 글의 신뢰도가 올라갑니다.', `"${issue.agency} 발표 자료 캡처 – 발표일과 적용 시점 표시"`)}

## 2. 알아두면 좋은 용어
이 주제를 이해하려면 용어를 먼저 짚고 넘어가는 게 좋습니다.

**${glossary.term}**
${glossary.def}
${extraGlossary ? `\n**${extraGlossary.term}**\n${extraGlossary.def}\n` : ""}
용어를 정확히 알아야 뉴스에서 말하는 내용이 나에게 유리한지 불리한지도 정확히 판단할 수 있습니다.

## 3. 내집마련·보유·임대 — 상황별로 뭐가 달라지나
같은 뉴스라도 무주택자인지, 1주택자인지, 다주택자인지, 지금 매수·매도를 준비 중인지에 따라 체감하는 무게가 완전히 다릅니다.

| 구분 | 영향도 | 이런 분께 | 달라지는 점 |
|---|---|---|---|
${segRows}

보유 형태별로 더 잘게 나누면 아래와 같습니다. 막대가 높을수록 이번 이슈를 더 눈여겨봐야 하는 대상이라는 뜻입니다.
${personaChart}
영향도가 높다고 무조건 '나쁜 소식'이라는 뜻은 아닙니다. 매수 예정자에게 영향도가 높게 나온다면 지금이 자금 계획을 다시 점검해 볼 타이밍이라는 신호일 수 있습니다.

${imgSlot(3, "위 표를 그대로 옮긴 비교 인포그래픽(카드뉴스형). 항목별로 \"영향 큼/보통/작음\"을 색으로 구분.", "독자가 스크롤을 멈추고 자기 상황에 해당하는 줄을 바로 찾게 해 줍니다.", '"상황별 영향 비교표 – 내집마련·보유·임대"')}

## 4. 공인중개사가 상담에서 실제로 보는 것
뉴스에는 나오지 않지만, 실제 상담 창구에서는 이런 부분을 먼저 확인합니다.

${scriptLines}

상담을 오시는 분들께 저는 항상 "기사 제목이 아니라 원문의 시행일자부터 같이 찾아보자"고 말씀드립니다. 언론 보도는 압축되면서 뉘앙스가 강해지는 경우가 많고, 실제 적용 대상은 훨씬 좁거나 조건이 까다로운 경우가 흔하기 때문입니다.
${b.local ? `\n**${office.areaLabel} 기준으로 보면**\n${b.local}\n` : ""}
${imgSlot(4, "실제 상담에서 확인하는 서류(등기부·대출 상담 내역·시행일 안내문 등)나 사무소 상담 장면 사진. 개인정보는 반드시 가리고 촬영.", '"직접 해 본 사람"이라는 신호를 줍니다.', '"상담 시 확인하는 서류 예시 – 개인정보는 가림 처리"')}

> ✍️ [직접 경험 입력] 실제 계약·상담에서 이 항목 때문에 문제가 됐던 사례, 예상과 달랐던 점, 초보자가 놓치기 쉬운 포인트를 2~3개 적어주세요.

## 5. 숫자로 보는 우리 동네 시장 흐름
말로만 설명하면 막연할 수 있어, ${office.areaLabel} 실거래 집계와 기준금리를 함께 정리했습니다. 아래 수치는 모두 출처와 기준일이 명시된 공개 자료를 근거로 하며, 신고 기한 때문에 최근 두 달은 잠정치입니다.

| 지표 | 현재 값 | 전월 대비 | 기준 | 출처 |
|---|---|---|---|---|
${tileRows}
${historyChart}
통계는 '전체 중간값'이고, 실제 개별 단지·물건은 편차가 매우 큽니다. 위 지표는 시장의 큰 흐름을 파악하는 참고 자료로 활용하시고, 실제 매수·매도 의사결정은 관심 단지의 최근 3~6개월 실거래가를 별도로 확인한 뒤 내리시길 권합니다.

## 6. 상담 전 실무 체크리스트
캡처해 두었다가 상담 전에 하나씩 확인해 보시면 좋습니다.

| 확인 | 체크 항목 |
|---|---|
${checklist.map((x) => `| ☐ | ${x} |`).join("\n")}

${imgSlot(5, "위 체크리스트를 체크박스(☑) 형태의 카드 이미지 1장으로 재구성. 저장·캡처해서 쓰기 좋게 여백을 넉넉히.", '독자가 "저장"해 두고 실제로 활용하게 만들어 체류·재방문을 늘립니다.', `"상담 전 체크리스트 카드 – 확인 항목 ${checklist.length}가지"`)}

## 7. 자주 묻는 질문
${faq}

## 8. 마치며 — 제 생각
정책·시장 뉴스는 '발표'보다 '내 조건에 적용되는지, 시점이 언제인지'가 훨씬 중요합니다. 숫자와 날짜는 반드시 공식 원문과 대조한 뒤 판단하시길 권합니다. 오늘 정리해 드린 표와 체크리스트를 참고해, 조급하게 결정하기보다 본인의 자금 계획과 일정에 맞춰 차근차근 준비하시길 바랍니다.

> ✍️ [직접 경험 입력] 이 주제에 대한 본인의 관점, 상담에서 자주 하는 조언을 한 문단으로 마무리해 주세요.

## 상담 안내
글로 다 담지 못한 세부 사항이나 본인 상황에 맞춘 판단이 필요하시면 편하게 문의 주세요.
- 전화: ${office.phone || "(연락처 미입력 — 설정에서 입력)"}
- ${office.officeName}${office.repName ? ` · 대표 ${office.repName}` : ""}${office.address ? ` · ${office.address}` : ""}${office.registrationNo ? ` · 등록번호 ${office.registrationNo}` : ""}

${imgSlot(6, '사무소 전경 사진 + "오시는 길" 지도 캡처, 또는 상담 예약 화면/카카오톡 채널 QR코드.', "전화·방문·예약으로 이어지는 마지막 전환 지점입니다.", `"${office.officeName} 사무소 위치 및 상담 예약 안내"`)}

> ※ 본 글은 정보 제공 목적이며 특정 매물·상품을 광고하지 않습니다. 협찬·광고를 받은 경우 이 자리에 '업체 지원' 또는 '내돈내산'을 명확히 표기하세요.

## 참고 자료
${artLines}${issue.officialUrl ? `\n- ${issue.agency} 공식 원문: ${issue.officialUrl}` : ""}
${tiles.map((t) => `- ${t.label} (${t.asOf}): [${urlHost(t.sourceUrl)}](${t.sourceUrl})`).join("\n")}

---
_이 글은 Real Estate Report Alert 자동 초안입니다. 🖼️ [이미지 추가위치] 안내에 맞춰 이미지를 넣고, ✍️ 표시된 부분에 직접 경험을 채우고, 수치·날짜를 원문과 대조한 뒤 발행하세요._`;

  const now = new Date().toISOString();
  return { id: newId("b"), issueId: issue.id, topicLabel: `${issue.agency} · ${TOPIC_LABEL[issue.topic]} · ${clamp(base, 40)}`, title, body, createdAt: now, updatedAt: now };
}

/** 본문에서 고객용 금지 표현을 찾아 검토 힌트로 보여 줍니다(차단하지는 않음). */
export function blogForbidden(body: string): string[] {
  return findForbidden(body);
}
