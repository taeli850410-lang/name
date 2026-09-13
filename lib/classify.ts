import { PERSONA_MATRIX } from "./taxonomy";
import type { AgencyGroup, AreaConfig, Persona, Region, SourceKind, Status, Topic } from "./types";

/**
 * 규칙 기반 5축 분류기. LLM 초안이 없어도 인박스에서 필터·라우팅이 되도록
 * 제목·요약의 키워드로 발표 주체(A)·단계(B)·주제(C)·지역(E)과 영향도(D) 초안을 만듭니다.
 */

/**
 * 부동산 기사·영상인지 가르는 1차 필터. 기관 보도자료뿐 아니라 유튜브 제목도 통과해야 해서,
 * 공문 용어(주택·정비사업)와 생활 용어(영끌·주담대·갭투자)를 같이 답니다.
 * 주식에도 쓰이는 말(매수·매도·시세)은 일부러 뺐습니다 — 증시 영상이 딸려 들어옵니다.
 */
const RELEVANT =
  /주택|부동산|아파트|청약|전세|월세|임대|대출|금리|재개발|재건축|정비사업|분양|토지|택지|세제|양도세|종부세|취득세|공시가격|실거래|집값|GTX|역세권|중개|규제지역|DSR|LTV|신도시|공급대책|주거|영끌|주담대|빌라|오피스텔|다세대|연립주택|단독주택|입주권|분양권|조합원|분담금|전월세|보증금|특별공급|청약통장|갭투자|매물|호가|전용면적|보유세|재산세|공시지가|등기/;

export function isRealEstateRelevant(text: string): boolean {
  return RELEVANT.test(text);
}

/**
 * 위 낱말 중 부동산에서만 쓰는 것들. 금리·대출·세제·매물·호가·등기는 뺐습니다 —
 * 증시 영상 제목에도 그대로 나오는 말이라 그것만으로는 부동산 기사라고 볼 수 없습니다.
 * ("FOMC 앞둔 증시… 금리·유가 불확실성" 이 이 한 단어로 브리핑에 올라왔습니다.)
 */
const STRONG =
  /주택|부동산|아파트|청약|전세|월세|임대|재개발|재건축|정비사업|분양|택지|양도세|종부세|취득세|공시가격|실거래|집값|GTX|역세권|중개|규제지역|거래허가|토지|DSR|LTV|신도시|공급대책|주거|영끌|주담대|빌라|오피스텔|다세대|연립주택|단독주택|입주권|분양권|조합원|분담금|전월세|보증금|특별공급|청약통장|갭투자|전용면적|보유세|재산세|공시지가/;

export function isStrongRealEstate(text: string): boolean {
  return STRONG.test(text);
}

/** 설명문에서 해시태그만 뽑습니다. #재건축 같은 건 글쓴이가 직접 단 주제 표시라 홍보 문구보다 믿을 만합니다 */
export function hashtagsOf(text: string): string {
  return (text.match(/#[^\s#<>]{1,30}/g) ?? []).join(" ");
}

/** 수도권 광역 단위 — 전국 독자에게도 의미 있는 시장 기사 */
const METRO = /수도권|서울시|서울특별시|서울\s|서울은|서울의|서울\b|인천|경기도|경기\s|경기권/;
/** 특정 시군구 — 그 지역 사람에게만 의미 있는 사안 */
const CITY_NAMES = [
  "수원", "성남", "용인", "고양", "화성", "안양", "군포", "의왕", "과천", "광명", "부천", "안산", "시흥", "김포", "파주",
  "남양주", "하남", "구리", "의정부", "양주", "평택", "오산", "이천", "여주", "동탄", "판교", "분당", "평촌", "인덕원",
  "창원", "청주", "천안", "전주", "포항", "김해", "구미", "진주", "목포", "여수", "원주", "춘천", "서귀포", "둔산", "해운대",
];
/**
 * 짧은 지명은 다른 낱말 안에 숨어 있습니다 — "보여주면"의 여주, "고양이"의 고양.
 * 앞뒤가 한글이면 지명으로 보지 않되, 행정 접미사(안양시·대전시의회)까지는 허용합니다.
 */
const cityPattern = (n: string) => `(?<![가-힣])${n}(?:특별자치시|특별시|광역시|시|군|구)?(?:의회|청|장)?(?![가-힣])`;
const CITY = new RegExp(CITY_NAMES.map(cityPattern).join("|"));
/** 지방 광역시·도 */
const WIDE = /부산|대구|광주광역|대전|울산|세종|강원|충청북도|충북|충청남도|충남|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주/;
/** 정부 부처·전국 단위 신호 */
const NATIONWIDE = /전국|정부|국토교통부|국토부|한국은행|금융위|금융당국|기획재정부|재정경제부|기재부|국세청|법제처|국회|한국부동산원|부동산원/;

/**
 * 화면에 띄울 지역 이름. region 4단계(전국·수도권·우리 지역·타 지역)는 라우팅용이라 그대로 두고,
 * 뱃지에는 실제 지명(서울·부산·안양…)을 보여주려고 따로 뽑습니다.
 * 제목에서만 찾습니다 — 요약까지 보면 "기준금리 인상, 서울 집값 영향" 같은 전국 기사가 서울로 보입니다.
 */
/** 자치구·택지지구 이름은 상위 시로 올려 보여줍니다 */
const SUB_CITY: Record<string, string> = {
  동탄: "화성", 판교: "성남", 분당: "성남", 평촌: "안양", 인덕원: "안양", 둔산: "대전", 해운대: "부산",
};
const WIDE_PLACES: [RegExp, string][] = [
  [/부산/, "부산"], [/대구/, "대구"], [/광주광역/, "광주"], [/대전/, "대전"], [/울산/, "울산"], [/세종/, "세종"],
  [/강원/, "강원"], [/충청북도|충북/, "충북"], [/충청남도|충남/, "충남"],
  [/전북특별자치도|전라북도|전북/, "전북"], [/전라남도|전남/, "전남"],
  [/경상북도|경북/, "경북"], [/경상남도|경남/, "경남"], [/제주/, "제주"],
];
const METRO_PLACES: [RegExp, string][] = [
  [/서울/, "서울"], [/인천/, "인천"], [/경기도|경기\s|경기권/, "경기"], [/수도권/, "수도권"],
];

/** 제목에 이름이 걸린 가장 좁은 행정구역. 전국 사안이면 null */
export function detectPlace(title: string): string | null {
  for (const n of CITY_NAMES) if (new RegExp(cityPattern(n)).test(title)) return SUB_CITY[n] ?? n;
  for (const [re, name] of WIDE_PLACES) if (re.test(title)) return name;
  for (const [re, name] of METRO_PLACES) if (re.test(title)) return name;
  return null;
}

/**
 * 지명 → 시도. 인박스 '지역' 축을 시도 단위로 묶을 때 씁니다.
 * 뱃지에는 여전히 좁은 지명(안양·동탄)이 뜨고, 칸만 시도로 말아 올립니다.
 */
const SIDO_OF: Record<string, string> = {
  서울: "서울특별시", 인천: "인천광역시", 경기: "경기도", 수도권: "수도권",
  부산: "부산광역시", 대구: "대구광역시", 광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
  강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도", 전북: "전북특별자치도", 전남: "전라남도",
  경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도",
  // 경기도 시군구
  수원: "경기도", 성남: "경기도", 용인: "경기도", 고양: "경기도", 화성: "경기도", 안양: "경기도", 군포: "경기도",
  의왕: "경기도", 과천: "경기도", 광명: "경기도", 부천: "경기도", 안산: "경기도", 시흥: "경기도", 김포: "경기도",
  파주: "경기도", 남양주: "경기도", 하남: "경기도", 구리: "경기도", 의정부: "경기도", 양주: "경기도", 평택: "경기도",
  오산: "경기도", 이천: "경기도", 여주: "경기도",
  // 그 밖의 시군구
  창원: "경상남도", 김해: "경상남도", 진주: "경상남도",
  청주: "충청북도", 천안: "충청남도", 전주: "전북특별자치도",
  포항: "경상북도", 구미: "경상북도", 목포: "전라남도", 여수: "전라남도",
  원주: "강원특별자치도", 춘천: "강원특별자치도", 서귀포: "제주특별자치도",
};

/** 인박스 '지역' 축 칸 순서 — 수도권 먼저, 그다음 광역시·도 */
export const SIDO_ORDER = [
  "서울특별시", "경기도", "인천광역시", "수도권",
  "부산광역시", "대구광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
];

/** 좁은 지명을 시도 이름으로 올립니다. 모르는 이름이면 null */
export function sidoOf(place?: string | null): string | null {
  if (!place) return null;
  return SIDO_OF[place] ?? SIDO_OF[shortName(place)] ?? null;
}

const SIDO_NAMES = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
];

/** "안양시" → "안양" 처럼 행정 접미사를 뗀 짧은 이름 */
export function shortName(name: string): string {
  return name.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구|도)$/, "");
}

/**
 * 지역 판정. 설정한 시군구·동이 걸리면 '우리 지역', 수도권 광역 기사는 '수도권',
 * 특정 타 시군구·지방은 '타 지역', 정부 발표는 '전국'입니다. 설정이 비면(전국구) '우리 지역'은 나오지 않습니다.
 */
export function detectRegion(text: string, area?: AreaConfig): { region: Region; dong: string[] } {
  const dongs = (area?.dongs ?? []).filter(Boolean);
  const dongHits = dongs.filter((d) => text.includes(d));
  const sigungu = area?.sigungu?.trim();
  const shortSigungu = sigungu ? shortName(sigungu) : "";
  const localHit = Boolean((sigungu && text.includes(sigungu)) || (shortSigungu.length >= 2 && text.includes(shortSigungu)) || dongHits.length);
  if (localHit) return { region: "local", dong: Array.from(new Set(dongHits)) };
  if (NATIONWIDE.test(text) && !CITY.test(text)) return { region: "national", dong: [] };
  if (CITY.test(text)) return { region: "other", dong: [] };
  if (WIDE.test(text)) return { region: "other", dong: [] };
  if (METRO.test(text)) return { region: "metro", dong: [] };
  return { region: "national", dong: [] };
}

const AGENCY_RULES: { re: RegExp; group: AgencyGroup; name: string }[] = [
  { re: /국토교통부|국토부/, group: "molit", name: "국토교통부" },
  { re: /금융위원회|금융위|금융감독원|금감원|금융당국/, group: "fsc", name: "금융위원회" },
  { re: /재정경제부|재경부|기획재정부|기재부/, group: "mofe", name: "재정경제부" },
  { re: /국세청/, group: "nts", name: "국세청" },
  { re: /행정안전부|행안부/, group: "other", name: "행정안전부" },
  { re: /통계청/, group: "other", name: "통계청" },
  { re: /국무조정실|국무총리실/, group: "other", name: "국무조정실" },
  { re: /한국은행|한은|금통위|금융통화위원회/, group: "bok", name: "한국은행" },
  { re: /주택도시보증공사|HUG/, group: "reb", name: "HUG" },
  { re: /토지주택공사|LH/, group: "reb", name: "LH" },
  { re: /한국부동산원|부동산원/, group: "reb", name: "한국부동산원" },
  { re: /법제처/, group: "law", name: "법제처" },
  { re: /국민참여입법센터|입법예고/, group: "law", name: "국민참여입법센터" },
  { re: /국회|상임위|국토위|본회의|법안소위|의원/, group: "law", name: "국회" },
  { re: /대법원|법원경매|경매법정/, group: "other", name: "법원" },
  { re: /공인중개사협회|협회/, group: "industry", name: "한국공인중개사협회" },
  { re: /건설|시공사|수주|조합/, group: "industry", name: "업계" },
];

/** "안양시의회", "경기도청", 또는 "안양시, ○○ 고시" 처럼 발표 주체 자리에 선 지자체 이름을 뽑습니다 */
function detectLocalGov(text: string, area?: AreaConfig): string | null {
  const withOffice = text.match(/([가-힣]{2,7}(?:특별자치시|특별자치도|특별시|광역시|시|군|구|도))(?:의회|청)/);
  if (withOffice) return withOffice[1];
  // 제목 맨 앞의 "○○시," / "○○군은" 같은 주어 자리
  const asSubject = text.match(/^([가-힣]{2,6}(?:특별자치시|특별자치도|특별시|광역시|시|군|구|도))(?=[,은는이가의\s])/);
  if (asSubject) return asSubject[1];
  for (const name of [area?.sigungu, area?.sido, ...SIDO_NAMES]) {
    if (name && text.includes(name)) return name;
  }
  return null;
}

export function detectAgency(text: string, sourceKind: SourceKind, sourceName: string, area?: AreaConfig): { agency: string; agencyGroup: AgencyGroup } {
  const gov = detectLocalGov(text, area);
  // 지자체 이름이 기사 앞머리(발표 주체 자리)에 있으면 부처 규칙보다 먼저
  if (gov && /(의회|청)/.test(text.slice(0, Math.max(0, text.indexOf(gov)) + gov.length + 2))) {
    return { agency: gov, agencyGroup: "local" };
  }
  for (const r of AGENCY_RULES) {
    if (r.re.test(text)) return { agency: r.name, agencyGroup: r.group };
  }
  if (gov) return { agency: gov, agencyGroup: "local" };
  if (sourceKind === "press") return { agency: sourceName || "언론", agencyGroup: "press" };
  if (sourceKind === "notice") return { agency: sourceName || "지자체", agencyGroup: "other" };
  return { agency: sourceName || "정부", agencyGroup: "other" };
}

export function detectStatus(text: string, sourceKind: SourceKind, region: Region): Status {
  if (/입법예고|의견제출|시행령 개정안|시행규칙 개정안|개정령안/.test(text)) return "LEGISLATIVE_NOTICE";
  if (sourceKind === "notice" || (region !== "national" && /고시|공고|공람|정비구역 지정|추진위원회 승인|조합설립|특별정비/.test(text))) return "LOCAL_NOTICE";
  if (/국회|본회의|상임위|국토위|법안|발의|법률안|조례안|의결/.test(text)) {
    return /통과|가결|의결됐|처리됐|공포/.test(text) ? "CONFIRMED" : "IN_ASSEMBLY";
  }
  if (/검토|논의|추진 방안|거론|만지작|가닥|저울질|검토 중|협의 중|방안 마련/.test(text)) return "UNDER_REVIEW";
  // "금리 인상에도 집값 하락 제한적" 같은 해설 기사가 '확정'으로 새지 않도록, 기관의 실제 행위를 나타내는 말이 없을 때만 전망으로 봅니다
  if (/전망|분석|관측|예상|전문가|시각|해석|칼럼|사설|우려|가능성/.test(text) && !/발표했|발표한|확정했|의결했|시행한다|시행된다|고시했/.test(text)) return "OUTLOOK";
  if (/통계|동향|지수|거래량|실거래가|상승률|하락률|최고치|최저치|평균|비중|건수|조사 결과|집계/.test(text)) return "STAT";
  if (sourceKind === "official") return "CONFIRMED";
  // 시행 시점이 앞으로인 것이 명시되면 '시행 예정'이 먼저입니다
  if (/부터 시행|시행 예정|시행될 예정|예정이다|예정인|도입 예정|앞두고/.test(text)) return "SCHEDULED";
  if (/시행|확정|결정|인상|인하|동결|지정|면제|도입|출시|의무화|착공|준공|개통|시행된다|적용된다/.test(text)) return "CONFIRMED";
  if (/예정|내년|다음 달부터/.test(text)) return "SCHEDULED";
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
  place: string | null;
  personas: Record<Persona, number>;
  relevant: boolean;
}

export function classify(input: ClassifyInput, area?: AreaConfig): Classification {
  const text = `${input.title} ${input.summary}`;
  const { region, dong } = detectRegion(text, area);
  const { agency, agencyGroup } = detectAgency(text, input.sourceKind, input.sourceName, area);
  const topic = detectTopic(input.title, input.summary);
  const status = detectStatus(text, input.sourceKind, region);
  const personas = { ...PERSONA_MATRIX[topic] };
  if (region === "local") {
    personas["매수 예정자"] = Math.min(5, personas["매수 예정자"] + 1);
    personas["공인중개사"] = 5;
  }
  // 제목에 지명이 없어도 지자체가 낸 고시면 그 지자체 이름을 지명으로 씁니다
  const place = detectPlace(input.title) ?? (agencyGroup === "local" ? shortName(agency) : null);
  return { agency, agencyGroup, status, topic, region, dong, place, personas, relevant: isRealEstateRelevant(text) };
}
