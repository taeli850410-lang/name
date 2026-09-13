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
}

/**
 * 키 앞에 붙이는 이름표. 한 Redis 를 다른 앱과 같이 쓸 때 issues·settings 같은
 * 흔한 키가 겹치지 않게 합니다. KV_PREFIX 로 바꿀 수 있습니다.
 */
const PREFIX = process.env.KV_PREFIX ?? "rera:";

class UpstashStore implements KV {
  kind: StoreKind = "upstash";
  persistent = true;
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
  async get<T>(key: string): Promise<T | null> {
    const r = await this.cmd(["GET", this.k(key)]);
    if (r == null) return null;
    try {
      return JSON.parse(String(r)) as T;
    } catch {
      return null;
    }
  }
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

export function storeStatus(): { kind: StoreKind; persistent: boolean; label: string } {
  const s = getStore();
  const label =
    s.kind === "upstash" ? "Upstash Redis 연결됨" : s.kind === "file" ? "로컬 파일 저장(.data/)" : "메모리 저장 · 재시작 시 초기화";
  return { kind: s.kind, persistent: s.persistent, label };
}
