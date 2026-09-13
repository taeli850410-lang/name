import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * 키-값 저장소 어댑터.
 * - Upstash Redis(Vercel Marketplace) REST 환경변수가 있으면 영구 저장
 * - 로컬 개발이면 .data/ 폴더 파일 저장
 * - 그 외(예: 저장소 연동 전 Vercel 배포)는 메모리 저장 — 재시작 시 초기화되며 화면에 경고를 띄웁니다.
 */

export type StoreKind = "upstash" | "file" | "memory";

export interface KV {
  kind: StoreKind;
  persistent: boolean;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  /** 저장소에 실제로 한 번 다녀옵니다. 정상이면 null, 아니면 사람이 읽을 실패 이유 */
  check(): Promise<string | null>;
}

/**
 * 키 앞에 붙이는 이름표. 한 Redis 를 다른 앱과 같이 쓸 때 issues·settings 같은
 * 흔한 키가 겹치지 않게 합니다. KV_PREFIX 로 바꿀 수 있습니다.
 */
const PREFIX = process.env.KV_PREFIX ?? "rera:";

/** 실패 메시지를 그대로 두되, 자주 나오는 원인은 무엇을 고쳐야 하는지까지 적어 줍니다 */
function reason(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/\b401\b|\b403\b|WRONGPASS|Unauthorized/i.test(msg)) return `인증 실패 — 토큰이 맞지 않습니다 (${msg})`;
  if (/read.?only|NOPERM/i.test(msg)) return `읽기 전용 토큰입니다 — 쓰기 가능한 토큰이 필요합니다 (${msg})`;
  if (/\b404\b/.test(msg)) return `주소가 맞지 않습니다 — REST URL 을 확인하세요 (${msg})`;
  return msg;
}

class UpstashStore implements KV {
  kind: StoreKind = "upstash";
  persistent = true;
  /** 읽기는 던지지 않고 이유만 남깁니다 — 저장소가 죽었다고 화면까지 못 그리면 원인을 볼 곳이 없습니다 */
  private readError: string | null = null;
  private probe: Promise<string | null> | null = null;
  constructor(
    private url: string,
    private token: string,
  ) {}
  private k(key: string) {
    return `${PREFIX}${key}`;
  }
  private async cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = (await res.json()) as { result?: unknown; error?: string };
    if (data.error) throw new Error(data.error);
    return data.result;
  }
  /**
   * 환경변수가 있다는 것과 Redis 가 받아 준다는 것은 다릅니다. 토큰을 잘못 붙여넣거나
   * 읽기 전용 토큰을 넣어도 변수는 그대로 있으니, 한 번 써 보고 그 값을 되읽어 확인합니다.
   * 환경변수는 도는 중에 바뀌지 않으므로 인스턴스당 한 번만 다녀옵니다.
   */
  check(): Promise<string | null> {
    this.probe ??= this.roundTrip();
    return this.probe.then((p) => this.readError ?? p);
  }
  private async roundTrip(): Promise<string | null> {
    const key = `${PREFIX}__probe`;
    const mark = String(Date.now());
    try {
      await this.cmd(["SET", key, mark, "EX", 60]);
      const back = await this.cmd(["GET", key]);
      return String(back) === mark ? null : "쓴 값이 그대로 돌아오지 않았습니다";
    } catch (e) {
      return reason(e);
    }
  }
  async get<T>(key: string): Promise<T | null> {
    let r: unknown;
    try {
      r = await this.cmd(["GET", this.k(key)]);
    } catch (e) {
      this.readError = reason(e);
      return null;
    }
    if (r == null) return null;
    try {
      return JSON.parse(String(r)) as T;
    } catch {
      return null;
    }
  }
  /** 저장은 실패하면 던집니다 — 저장된 척하는 화면이 제일 나쁩니다 */
  async set<T>(key: string, value: T): Promise<void> {
    await this.cmd(["SET", this.k(key), JSON.stringify(value)]);
  }
}

class FileStore implements KV {
  kind: StoreKind = "file";
  persistent = true;
  private dir = path.join(process.cwd(), ".data", "kv");
  private file(key: string) {
    return path.join(this.dir, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  }
  /** 로컬 디스크입니다. 쓸 수 없으면 저장할 때 그 자리에서 드러납니다 */
  async check(): Promise<string | null> {
    return null;
  }
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.file(key), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  async set<T>(key: string, value: T): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    // 동시 쓰기(예: generateMetadata 와 페이지 렌더가 함께 시딩)에도 안전하도록 임시 파일명을 매번 다르게
    const tmp = `${this.file(key)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value), "utf8");
    await fs.rename(tmp, this.file(key));
  }
}

class MemoryStore implements KV {
  kind: StoreKind = "memory";
  persistent = false;
  private map: Map<string, string>;
  constructor() {
    const g = globalThis as unknown as { __llMemoryStore?: Map<string, string> };
    if (!g.__llMemoryStore) g.__llMemoryStore = new Map();
    this.map = g.__llMemoryStore;
  }
  /** 확인할 것이 없습니다. 사라진다는 사실은 kind 가 이미 말하고 있습니다 */
  async check(): Promise<string | null> {
    return null;
  }
  async get<T>(key: string): Promise<T | null> {
    const v = this.map.get(key);
    return v == null ? null : (JSON.parse(v) as T);
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, JSON.stringify(value));
  }
}

let instance: KV | null = null;

export function getStore(): KV {
  if (instance) return instance;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) instance = new UpstashStore(url, token);
  else if (!process.env.VERCEL) instance = new FileStore();
  else instance = new MemoryStore();
  return instance;
}

export interface StoreStatus {
  kind: StoreKind;
  /** 지금 이 순간 정말로 저장되는지. 변수만 있고 Redis 가 거절하면 false 입니다 */
  persistent: boolean;
  label: string;
  /** 실패했을 때만 채워지는 이유 */
  error: string | null;
}

export async function storeStatus(): Promise<StoreStatus> {
  const s = getStore();
  const error = await s.check();
  if (s.kind === "upstash") {
    return error
      ? { kind: "upstash", persistent: false, label: "Upstash 연결 실패 · 저장 안 됨", error }
      : { kind: "upstash", persistent: true, label: "Upstash Redis 연결됨", error: null };
  }
  return {
    kind: s.kind,
    persistent: s.persistent,
    label: s.kind === "file" ? "로컬 파일 저장(.data/)" : "메모리 저장 · 재시작 시 초기화",
    error: null,
  };
}
