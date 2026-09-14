/**
 * 저장소에 둔 스튜디오 비밀번호.
 *
 * 지금까지는 환경변수 STUDIO_PASSWORD 하나뿐이었습니다. 그건 Vercel 화면에 들어가
 * 변수를 넣고 **재배포**까지 해야 걸리는데, 매번 그러기 번거로워서 결국 비워 둔 채로
 * 스튜디오가 열려 있었습니다. 그래서 화면에서 바로 걸 수 있는 길을 하나 더 둡니다.
 *
 * 이 파일은 **미들웨어(Edge)에서도 불립니다.** 그래서 lib/store.ts 를 쓰지 못합니다 —
 * 거기서 node:fs 를 불러오는데 Edge 에는 없습니다. Upstash REST 만 fetch 로 직접 칩니다.
 *
 * 비밀번호 원문은 어디에도 저장하지 않습니다. tokenFor() 로 만든 SHA-256 값만 둡니다.
 */

const PREFIX = process.env.KV_PREFIX ?? "rera:";
const KEY = `${PREFIX}studio-auth`;

function creds(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/** 저장소에 비밀번호를 둘 수 있는 환경인가. 로컬 파일 저장만 있으면 못 둡니다 */
export function canStorePassword(): boolean {
  return creds() !== null;
}

async function cmd(body: unknown[]): Promise<unknown> {
  const c = creds();
  if (!c) return null;
  const res = await fetch(c.url, {
    method: "POST",
    headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown };
  return json.result ?? null;
}

/**
 * 저장된 토큰. 저장소가 없거나 한 번이라도 실패하면 null 을 돌려줍니다.
 *
 * 여기서 막는 쪽(fail-closed)으로 가면 저장소가 잠깐 흔들릴 때 사무소가 자기 스튜디오에
 * 못 들어가고 되돌릴 방법도 없습니다. 그래서 여는 쪽으로 둡니다 — 지금과 같은 상태가 될 뿐입니다.
 * 어떤 경우에도 확실히 잠가야 하면 환경변수 STUDIO_PASSWORD 를 쓰세요. 그건 저장소와 무관합니다.
 */
export async function storedToken(): Promise<string | null> {
  try {
    const raw = await cmd(["GET", KEY]);
    if (typeof raw !== "string" || !raw) return null;
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === "string" && parsed.token ? parsed.token : null;
  } catch {
    return null;
  }
}

/** 비밀번호를 걸거나(토큰 저장) 풉니다(null) */
export async function saveStoredToken(token: string | null): Promise<void> {
  if (!creds()) throw new Error("영구 저장소가 없어 비밀번호를 저장할 수 없습니다.");
  if (token) await cmd(["SET", KEY, JSON.stringify({ token, setAt: new Date().toISOString() })]);
  else await cmd(["DEL", KEY]);
}
