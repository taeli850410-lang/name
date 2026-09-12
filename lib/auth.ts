/** 스튜디오 접근 보호. STUDIO_PASSWORD 가 없으면 열려 있고, 있으면 쿠키 토큰으로 확인합니다. Edge·Node 양쪽에서 동작하도록 WebCrypto 만 씁니다. */

export const STUDIO_COOKIE = "ll_studio";

export function studioProtected(): boolean {
  return Boolean(process.env.STUDIO_PASSWORD);
}

export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`ll-studio:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}
