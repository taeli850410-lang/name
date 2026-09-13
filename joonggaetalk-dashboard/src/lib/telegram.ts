/**
 * 텔레그램 알림 — 운영자에게 장애·실패를 밀어 넣는다.
 *
 * 화면을 열어야만 보이는 알림은 장애 알림이 못 된다. 장애가 났을 때
 * 화면을 열어 보고 있을 리가 없기 때문이다. 종 아이콘도 배너도 브라우저
 * 안에서만 산다. 밖으로 나가는 통로가 하나는 있어야 한다.
 *
 * 텔레그램을 고른 이유는 심사도 계약도 없고 무료라서다. 알림톡은 채널
 * 개설·템플릿 검수·발신번호 등록이 끝나야 쓸 수 있는데, 그건 몇 주가 걸린다.
 *
 * 봇 토큰은 서버에만 둔다. 토큰이 새면 남이 이 봇으로 아무 말이나 보낸다.
 */

/** 무엇 때문에 부르는지. 종류마다 급한 정도가 다르다. */
export type AlertKind = "장애" | "발송실패" | "등기변동" | "문의답변" | "점검";

export type Alert = {
  kind: AlertKind;
  title: string;
  /** 본문 — 줄바꿈으로 나눠 적는다. 비어 있어도 된다. */
  lines?: string[];
  /** 눌러서 바로 갈 화면. 있으면 맨 끝에 붙는다. */
  url?: string;
};

/** 종류를 한눈에 구분할 표시. 글자만 있으면 목록에서 다 똑같아 보인다. */
const MARK: Record<AlertKind, string> = {
  장애: "🔴",
  발송실패: "⚠️",
  등기변동: "📄",
  문의답변: "💬",
  점검: "✅",
};

/**
 * 텔레그램에 보낼 본문.
 *
 * HTML 서식을 쓰므로 <, >, & 를 반드시 바꿔야 한다. 안 바꾸면 텔레그램이
 * 400 으로 거절하는데, 하필 오류 원문에 <, > 가 자주 들어 있다 —
 * 장애를 알리려다 그 장애 때문에 알림이 실패하는 꼴이 된다.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatAlert(a: Alert, now?: string): string {
  const head = `${MARK[a.kind]} <b>${escapeHtml(a.title)}</b>`;
  const body = (a.lines ?? []).filter((l) => l.trim()).map((l) => escapeHtml(l));
  const tail: string[] = [];
  if (now) tail.push(`<i>${escapeHtml(now)}</i>`);
  // 주소는 escape 하지 않는다 — 텔레그램이 알아서 누를 수 있게 만든다
  if (a.url) tail.push(a.url);
  return [head, ...body, ...(tail.length ? ["", ...tail] : [])].join("\n");
}

/** 텔레그램 한 메시지 상한은 4096자다. 넘치면 잘라 보내되 잘렸다고 밝힌다. */
export const MAX_LEN = 4096;

export function clamp(text: string): string {
  if (text.length <= MAX_LEN) return text;
  const note = "\n… (너무 길어 줄였습니다)";
  return text.slice(0, MAX_LEN - note.length) + note;
}

/* ------------------------------------------------------------- 설정 */

export type TelegramConfig = { token: string; chatId: string };

/**
 * 토큰과 받을 사람. 둘 중 하나만 있어도 보낼 수 없으므로 같이 본다.
 *
 * chatId 가 따로 필요한 이유: 봇은 자기에게 먼저 말을 건 사람에게만
 * 보낼 수 있다. 봇을 만들었다고 아무에게나 못 보낸다.
 */
export function readConfig(env: Record<string, string | undefined>): TelegramConfig | null {
  const token = (env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

/** 토큰 모양이 맞는가 — `숫자:영문숫자` 다. 틀린 걸 보내면 401 이 온다. */
export function looksLikeToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token.trim());
}

/* ------------------------------------------------------------- 오류 */

export type TelegramErrorCode = "NO_CONFIG" | "BAD_TOKEN" | "NO_CHAT" | "BLOCKED" | "RATE_LIMIT" | "UPSTREAM";

export const TELEGRAM_ERRORS: Record<TelegramErrorCode, { message: string; hint: string }> = {
  NO_CONFIG: {
    message: "텔레그램이 설정되지 않았습니다.",
    hint: "@BotFather 에서 봇을 만들고 TELEGRAM_BOT_TOKEN 과 TELEGRAM_CHAT_ID 를 환경 변수에 넣은 뒤 다시 배포하세요.",
  },
  BAD_TOKEN: {
    message: "봇 토큰이 맞지 않습니다.",
    hint: "@BotFather 에서 받은 토큰을 그대로 넣었는지, 앞뒤가 잘리지 않았는지 확인하세요.",
  },
  NO_CHAT: {
    message: "받는 사람을 찾을 수 없습니다.",
    hint: "텔레그램에서 만든 봇을 찾아 /start 를 한 번 보내야 합니다. 봇은 먼저 말을 건 사람에게만 보낼 수 있습니다.",
  },
  BLOCKED: {
    message: "받는 사람이 이 봇을 차단했습니다.",
    hint: "텔레그램에서 봇 차단을 풀고 다시 /start 를 보내 주세요.",
  },
  RATE_LIMIT: {
    message: "너무 자주 보내 텔레그램이 잠시 막았습니다.",
    hint: "잠시 뒤 다시 시도하면 풀립니다.",
  },
  UPSTREAM: { message: "텔레그램 서버가 응답하지 않습니다.", hint: "잠시 뒤 다시 시도해 주세요." },
};

/**
 * 텔레그램이 준 응답 → 우리 오류 코드.
 *
 * 넷을 나누는 이유는 고치는 곳이 전부 다르기 때문이다. 토큰이 틀렸으면
 * 환경 변수를, 대화가 없으면 휴대폰에서 /start 를, 차단이면 차단 해제를
 * 해야 한다. "전송 실패" 하나로 뭉치면 어디를 봐야 할지 알 수 없다.
 */
export function mapError(status: number, description = ""): TelegramErrorCode {
  const d = description.toLowerCase();
  if (status === 401 || d.includes("unauthorized")) return "BAD_TOKEN";
  if (status === 429 || d.includes("too many requests")) return "RATE_LIMIT";
  if (d.includes("chat not found") || d.includes("chat_id is empty")) return "NO_CHAT";
  if (d.includes("blocked") || d.includes("bot was kicked")) return "BLOCKED";
  if (status === 400) return "NO_CHAT";
  return "UPSTREAM";
}

/* ------------------------------------------------------------- 응답 읽기 */

type ApiResponse = { ok?: boolean; description?: string; result?: unknown };

export function readOk(payload: unknown): boolean {
  return (payload as ApiResponse)?.ok === true;
}

export function readDescription(payload: unknown): string {
  const d = (payload as ApiResponse)?.description;
  return typeof d === "string" ? d : "";
}

/**
 * getUpdates 응답에서 "이 봇에게 말을 건 사람들"을 뽑는다.
 *
 * chat_id 를 사람이 직접 찾으려면 텔레그램 API 주소를 브라우저에 치고
 * JSON 을 눈으로 훑어야 한다. 그 과정에서 토큰이 주소창에 남는다.
 * 서버가 대신 물어보고 목록만 돌려주면 그럴 일이 없다.
 */
export type ChatCandidate = { id: string; name: string };

export function readChats(payload: unknown): ChatCandidate[] {
  const result = (payload as ApiResponse)?.result;
  if (!Array.isArray(result)) return [];
  const seen = new Map<string, string>();
  for (const update of result) {
    const chat = (update as { message?: { chat?: Record<string, unknown> } })?.message?.chat;
    if (!chat) continue;
    const id = chat.id === undefined || chat.id === null ? "" : String(chat.id);
    if (!id || seen.has(id)) continue;
    const name =
      [chat.first_name, chat.last_name].filter((v) => typeof v === "string" && v).join(" ") ||
      (typeof chat.username === "string" ? `@${chat.username}` : "") ||
      (typeof chat.title === "string" ? chat.title : "") ||
      "이름 없음";
    seen.set(id, name);
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}
