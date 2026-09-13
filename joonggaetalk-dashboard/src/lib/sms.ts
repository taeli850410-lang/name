/**
 * 알림톡 대체발송(문자) 계산.
 *
 * 대체발송은 알림톡이 실패한 뒤에 사람이 따로 보내는 게 아니다.
 * 알림톡 요청에 예비 문자를 같이 실어 보내고, 카카오톡으로 꽂지 못하면
 * 대행사가 그 문자를 대신 내보낸다. 두 가지가 여기서 따라온다.
 *
 *   1. 문구는 발송 전에 준비돼 있어야 한다. 그래서 템플릿에 딸려 있다.
 *   2. 요청 자체가 접수되지 않으면(대행사 장애) 예비 문자도 나가지 않는다.
 */

export type SmsKind = "SMS" | "LMS";

/** SMS 한도. 이동통신 표준이 EUC-KR 기준이라 한글 한 글자가 2바이트다 — 90바이트 = 한글 45자. */
export const SMS_LIMIT = 90;
/** LMS 한도. 넘으면 보낼 수 없다. MMS 는 이미지용이라 대체발송에 쓰지 않는다. */
export const LMS_LIMIT = 2000;

/** 건당 단가(원). 알림톡과 나란히 놓고 봐야 켤지 말지 판단이 선다. */
export const SMS_COST: Record<SmsKind, number> = { SMS: 20, LMS: 50 };
export const ALIMTALK_COST = 6.5;

/**
 * 실패 사유별로 문자가 나가는지가 다르다. 이걸 뭉뚱그리면
 * "대체발송을 켰는데 왜 안 갔지" 가 그대로 문의가 된다.
 *
 *   auto      카카오톡으로 못 받는 고객 — 문자로 덮인다
 *   choice    거부 신호가 있는 고객 — 중개사가 켜야 나간다
 *   duplicate 알림톡이 갔는지 모르는 상태 — 보내면 같은 안내를 두 번 받는다
 *   blocked   문자로도 못 간다 (번호 오류) 또는 요청이 접수되지 않았다 (대행사 장애)
 */
export type FallbackPolicy = "auto" | "choice" | "duplicate" | "blocked";

/**
 * EUC-KR 기준 바이트 수. 아스키는 1, 한글·한자·전각기호는 2.
 * 줄바꿈은 1바이트로 센다 — CRLF 로 세는 대행사는 줄 수만큼 더 붙으므로
 * 한도에 바짝 붙여 쓰지 않도록 화면에서 남은 바이트를 같이 보여 준다.
 */
export function smsBytes(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.codePointAt(0)! < 0x80 ? 1 : 2;
  return n;
}

/**
 * EUC-KR 에 없는 글자 — 이모지가 대부분이다.
 * 넣으면 깨져 나가거나 MMS(건당 200원대)로 바뀐다.
 *
 * KS X 1001 표를 다 싣지 않고 확실한 것만 잡는다. ★ ☆ ♥ ☎ ※ 같은 기호는
 * EUC-KR 에 멀쩡히 들어 있어서, 넓게 잡으면 멀쩡한 문구에 경고가 떠
 * 경고 자체를 믿지 않게 된다. 놓치는 쪽이 낫다고 보고 세 가지만 본다.
 *   - 0xFFFF 를 넘는 글자: 요즘 이모지는 전부 여기다 (😀 🏠 👍)
 *   - U+FE0F: 이모지로 그려 달라는 표시라 붙어 있으면 이모지다
 *   - U+2B00~2BFF: 유니코드 4.0 이후에 생긴 기호라 KS X 1001 에 없다
 */
export function unsupportedChars(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp > 0xffff || cp === 0xfe0f || (cp >= 0x2b00 && cp <= 0x2bff)) out.add(ch);
  }
  return [...out];
}

export function smsKind(text: string): SmsKind {
  return smsBytes(text) <= SMS_LIMIT ? "SMS" : "LMS";
}

/** LMS 한도까지 넘긴 문구. 저장은 막아야 한다. */
export function isOverLimit(text: string): boolean {
  return smsBytes(text) > LMS_LIMIT;
}

/** SMS 한도까지 남은 바이트. 음수면 이미 LMS 로 넘어간 것이다. */
export function headroom(text: string): number {
  return SMS_LIMIT - smsBytes(text);
}

export function smsCost(text: string, count = 1): number {
  return SMS_COST[smsKind(text)] * count;
}

export type FallbackEstimate = {
  count: number;
  kind: SmsKind;
  /** 전부 대체됐을 때의 문자 비용 */
  cost: number;
  /** 같은 건수를 알림톡으로만 보냈을 때 */
  alimtalkCost: number;
  /** 문자 단가가 알림톡 단가의 몇 배인지 */
  multiple: number;
};

/** 대체발송을 켜면 비용이 얼마나 뛰는지. 켜기 전에 보여 줘야 하는 숫자다. */
export function estimateFallback(count: number, text: string, alimtalkUnit = ALIMTALK_COST): FallbackEstimate {
  const kind = smsKind(text);
  return {
    count,
    kind,
    cost: SMS_COST[kind] * count,
    alimtalkCost: Math.round(alimtalkUnit * count * 10) / 10,
    multiple: Math.round((SMS_COST[kind] / alimtalkUnit) * 10) / 10,
  };
}

export type SmsDraft = { text: string; droppedButtons: string[] };

/**
 * 알림톡 본문에서 대체 문자 초안을 만든다.
 *
 * 알림톡에 있고 문자에 없는 두 가지를 본문으로 되살린다.
 *   - 말풍선 머리의 채널명: 문자에는 없다. 모르는 번호로 보이지 않도록 상호를 앞에 붙인다.
 *   - 버튼: 문자에는 없다. 주소를 아는 버튼만 링크로 풀고, 나머지는 돌려줘서 화면에서 알린다.
 *
 * 링크를 풀면 URL 하나가 30~50바이트라 SMS 한도를 바로 넘기기도 한다.
 * 그래서 초안을 만든 뒤 길이를 다시 재야 한다.
 */
export function fromAlimtalk(body: string, opts: { sender: string; buttons?: string[]; links?: Record<string, string> }): SmsDraft {
  const { sender, buttons = [], links = {} } = opts;
  const droppedButtons: string[] = [];
  const linkLines: string[] = [];
  for (const b of buttons) {
    const url = links[b]?.trim();
    if (url) linkLines.push(`${b}: ${url}`);
    else droppedButtons.push(b);
  }
  const head = sender.trim() ? `[${sender.trim()}]\n` : "";
  const tail = linkLines.length ? `\n\n${linkLines.join("\n")}` : "";
  return { text: `${head}${body.trim()}${tail}`, droppedButtons };
}

/** #{변수} 를 값으로 바꾼다. 값이 없으면 그대로 남겨 눈에 띄게 둔다. */
export function renderVars(text: string, values: Record<string, string>): string {
  return text.replace(/#\{([^}]+)\}/g, (all, key: string) => values[key] ?? all);
}

/**
 * 값이 채워지지 않은 변수들.
 * 알림톡은 카카오 검수가 변수를 봐 주지만 문자는 아무도 안 봐 준다.
 * #{고객명} 이 그대로 나가는 사고는 여기서 막아야 한다.
 */
export function missingVars(text: string, values: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/#\{([^}]+)\}/g)) {
    if (values[m[1]] === undefined) out.add(m[1]);
  }
  return [...out];
}

/** 본문에 쓰인 변수 이름들 — 순서대로, 중복 없이. */
export function usedVars(text: string): string[] {
  return [...new Set([...text.matchAll(/#\{([^}]+)\}/g)].map((m) => m[1]))];
}
