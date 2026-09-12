import { PERSONA_MATRIX } from "./taxonomy";
import type { AgencyGroup, Persona, Region, SourceKind, Status, Topic } from "./types";

/**
 * 규칙 기반 5축 분류기. LLM 초안이 없어도 인박스에서 필터·라우팅이 되도록
 * 제목·요약의 키워드로 발표 주체(A)·단계(B)·주제(C)·지역(E)과 영향도(D) 초안을 만듭니다.
 */

const RELEVANT = /주택|부동산|아파트|청약|전세|월세|임대|대출|금리|재개발|재건축|정비사업|분양|토지|택지|세제|양도세|종부세|취득세|공시가격|실거래|집값|GTX|역세권|중개|규제지역|DSR|LTV|신도시|공급대책|주거/;

export function isRealEstateRelevant(text: string): boolean {
  return RELEVANT.test(text);
}

const ANYANG_DONGS = [
  "안양동", "석수동", "박달동", "호계동", "평촌동", "관양동", "비산동", "부흥동", "달안동", "갈산동", "신촌동", "범계동", "부림동", "귀인동", "평안동", "충훈동",
  "인덕원", "만안구", "동안구", "평촌", "충훈부", "수촌마을", "중촌마을", "뉴타운맨션", "삼호아파트",
];
/** 별칭 → 행정동 */
const DONG_ALIAS: Record<string, string> = {
  평촌: "평촌동",
  충훈부: "충훈동",
  인덕원: "관양동",
  수촌마을: "관양동",
};
const GYEONGGI = /경기도|경기\s|수원|성남|용인|고양|화성|군포|의왕|과천|광명|부천|안산|시흥|김포|파주|남양주|하남|구리|의정부|양주|평택|오산|이천|여주|광주시|동탄|판교|분당/;
const METRO = /수도권|인천/;
const OTHER = /대전|부산|대구|광주광역|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주|창원|청주|천안|전주|포항|김해|구미|둔산|해운대|수성구/;

export function detectRegion(text: string): { region: Region; dong: string[] } {
  const hits = ANYANG_DONGS.filter((d) => text.includes(d));
  const dong = hits.map((d) => DONG_ALIAS[d] ?? d).filter((d) => d.endsWith("동") || d.endsWith("마을") || d.endsWith("아파트") || d.endsWith("맨션"));
  if (/안양/.test(text) || hits.length) return { region: "anyang", dong: Array.from(new Set(dong)) };
  if (GYEONGGI.test(text)) return { region: "gyeonggi", dong: [] };
  if (/서울/.test(text) && !/전국/.test(text)) return { region: "seoul", dong: [] };
  if (METRO.test(text)) return { region: "metro", dong: [] };
  if (OTHER.test(text) && !/전국|정부|국토교통부|국토부|한국은행|금융위/.test(text)) return { region: "other", dong: [] };
  return { region: "national", dong: [] };
}

const AGENCY_RULES: { re: RegExp; group: AgencyGroup; name: string }[] = [
  { re: /안양시의회|안양시청|안양시/, group: "anyang", name: "안양시" },
  { re: /경기도의회|경기도청|경기도/, group: "gyeonggi", name: "경기도" },
  { re: /국토교통부|국토부/, group: "molit", name: "국토교통부" },
  { re: /금융위원회|금융위|금융감독원|금감원|금융당국/, group: "fsc", name: "금융위원회" },
  { re: /재정경제부|재경부|기획재정부|기재부/, group: "mofe", name: "재정경제부" },
  { re: /국세청/, group: "nts", name: "국세청" },
  { re: /한국은행|한은|금통위|금융통화위원회/, group: "bok", name: "한국은행" },
  { re: /주택도시보증공사|HUG/, group: "reb", name: "HUG" },
  { re: /토지주택공사|LH/, group: "reb", name: "LH" },
  { re: /한국부동산원|부동산원/, group: "reb", name: "한국부동산원" },
  { re: /법제처|국회|상임위|국토위|본회의|의원/, group: "law", name: "국회" },
  { re: /공인중개사협회|협회/, group: "industry", name: "한국공인중개사협회" },
  { re: /건설|시공사|수주|조합/, group: "industry", name: "업계" },
];

export function detectAgency(text: string, sourceKind: SourceKind, sourceName: string): { agency: string; agencyGroup: AgencyGroup } {
  for (const r of AGENCY_RULES) {
    if (r.re.test(text)) return { agency: r.name, agencyGroup: r.group };
  }
  if (sourceKind === "press") return { agency: sourceName || "언론", agencyGroup: "press" };
  if (sourceKind === "notice") return { agency: sourceName || "지자체", agencyGroup: "other" };
  return { agency: sourceName || "정부", agencyGroup: "other" };
}

export function detectStatus(text: string, sourceKind: SourceKind, region: Region): Status {
  if (/입법예고|의견제출|시행령 개정안|시행규칙 개정안|개정령안/.test(text)) return "LEGISLATIVE_NOTICE";
  if (sourceKind === "notice" || ((region === "anyang" || region === "gyeonggi") && /고시|공고|공람|정비구역 지정|추진위원회 승인|조합설립|특별정비/.test(text)))
    return "LOCAL_NOTICE";
  if (/국회|본회의|상임위|국토위|법안|발의|법률안|조례안|의결/.test(text)) {
    return /통과|가결|의결됐|처리됐|공포/.test(text) ? "CONFIRMED" : "IN_ASSEMBLY";
  }
  if (/검토|논의|추진 방안|거론|만지작|가닥|저울질|검토 중|협의 중|방안 마련/.test(text)) return "UNDER_REVIEW";
  if (/전망|분석|관측|예상|전문가|시각|해석|칼럼|사설|우려|가능성/.test(text) && !/발표|시행|확정|인상|인하/.test(text)) return "OUTLOOK";
  if (/통계|동향|지수|거래량|실거래가|상승률|하락률|최고치|최저치|평균|비중|건수|조사 결과|집계/.test(text)) return "STAT";
  if (sourceKind === "official") return "CONFIRMED";
  if (/시행|확정|결정|인상|인하|동결|지정|면제|도입|출시|의무화|시행된다|적용된다/.test(text)) return "CONFIRMED";
  if (/예정|부터 시행|앞두고|내년|다음 달부터/.test(text)) return "SCHEDULED";
  return "PRESS_REPORTED";
}

const TOPIC_WORDS: Record<Topic, RegExp> = {
  rate: /기준금리|금리|대출|DSR|LTV|DTI|주담대|주택담보|전세대출|디딤돌|보금자리|가계부채|금통위|스트레스|이자/g,
  tax: /양도세|양도소득세|종부세|종합부동산세|취득세|재산세|보유세|세제|세금|세율|공시가격|과세|세법|소득세법|중과/g,
  subs: /청약|분양|특별공급|가점|당첨|분양가|미분양|청약홈|무순위|사전청약|줍줍/g,
  supply: /공급대책|주택공급|택지|신도시|공공주택|착공|인허가|개발부담금|공급 확대|용산공원|공공택지|주택법|건축 허용|다세대|층수|용적률/g,
  redev: /재개발|재건축|정비사업|정비구역|조합|시공사|분담금|안전진단|노후계획도시|특별정비|리모델링|가로주택|공공재개발|뉴타운|촉진지구|정비계획/g,
  lease: /전세|월세|임대차|임차인|임대인|보증금|전세사기|갱신|상한|확정일자|전세보증|깡통|역전세|전월세|주거비/g,
  transit: /GTX|철도|지하철|역세권|광역교통|개통|노선|도로|인덕원선|월곶판교|신분당|교통망|트램/g,
  stat: /실거래가|가격동향|거래량|지수|통계|상승률|하락률|매매가|집값|아파트값|시세|심리지수|거래 절벽|최고치|평균/g,
  regulation: /조정대상지역|투기과열지구|규제지역|토지거래허가|허가구역|규제 해제|규제 완화|규제 강화/g,
  broker: /공인중개사|중개보수|중개수수료|임장비|확인·설명|확인설명|중개사무소|전자계약|중개업|중개사/g,
};

export function detectTopic(title: string, summary: string): Topic {
  let best: Topic = "stat";
  let bestScore = -1;
  for (const t of Object.keys(TOPIC_WORDS) as Topic[]) {
    const re = TOPIC_WORDS[t];
    const th = (title.match(re) || []).length;
    const sh = (summary.match(re) || []).length;
    const score = th * 3 + sh;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (bestScore <= 0) return /주택|건축|아파트/.test(title + summary) ? "supply" : "stat";
  return best;
}

export function normalizeTitle(s: string): string {
  return (s || "")
    .replace(/\s*-\s*[^-]{2,20}$/, "")
    .replace(/\[[^\]]*\]|\([^)]*\)|「|」|『|』|“|”|"|'|‘|’|…|\.{3}|·/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function titleHash(s: string): string {
  const n = normalizeTitle(s).replace(/\s/g, "");
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h << 5) + h + n.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function bigrams(s: string): Set<string> {
  const t = normalizeTitle(s).replace(/\s/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** 제목 유사도 (문자 bigram Jaccard) — 같은 이슈의 다른 기사 묶기 */
export function titleSimilarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface ClassifyInput {
  title: string;
  summary: string;
  sourceKind: SourceKind;
  sourceName: string;
}

export interface Classification {
  agency: string;
  agencyGroup: AgencyGroup;
  status: Status;
  topic: Topic;
  region: Region;
  dong: string[];
  personas: Record<Persona, number>;
  relevant: boolean;
}

export function classify(input: ClassifyInput): Classification {
  const text = `${input.title} ${input.summary}`;
  const { region, dong } = detectRegion(text);
  const { agency, agencyGroup } = detectAgency(text, input.sourceKind, input.sourceName);
  const topic = detectTopic(input.title, input.summary);
  const status = detectStatus(text, input.sourceKind, region);
  const personas = { ...PERSONA_MATRIX[topic] };
  if (region === "anyang") {
    personas["매수 예정자"] = Math.min(5, personas["매수 예정자"] + 1);
    personas["공인중개사"] = 5;
  }
  return { agency, agencyGroup, status, topic, region, dong, personas, relevant: isRealEstateRelevant(text) };
}
