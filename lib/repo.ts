import bundledMarket from "@/data/market-sample.json";
import { DEFAULT_OFFICE, seedIssues, seedLetters } from "./seed";
import { getStore } from "./store";
import { normalizeRegion } from "./taxonomy";
import type { AreaConfig, BlogPost, InstaSave, Issue, Letter, MarketDoc, Meta, Office } from "./types";

/** 저장소 접근 계층. 컬렉션 단위 문서(issues, letters, settings, market, meta, insta, blog)로 저장합니다. */

const KEYS = { issues: "issues", letters: "letters", settings: "settings", market: "market", meta: "meta", insta: "insta", blog: "blog" } as const;

export async function getIssues(): Promise<Issue[]> {
  const store = getStore();
  const list = await store.get<Issue[]>(KEYS.issues);
  // 구버전 저장본의 지역 값(seoul·gyeonggi·anyang)을 현재 4종으로 옮겨 읽습니다
  if (list) return list.map((i) => ({ ...i, region: normalizeRegion(i.region) }));
  const seeded = seedIssues(await getArea());
  await store.set(KEYS.issues, seeded);
  return seeded;
}

/** 설정에서 이 사무소가 맡은 지역을 꺼냅니다. 전국구면 빈 값 */
export async function getArea(): Promise<AreaConfig> {
  const o = await getSettings();
  if (o.scope !== "local") return {};
  return { sido: o.sido, sigungu: o.sigungu, dongs: o.dongs ?? [] };
}

export async function saveIssues(list: Issue[]): Promise<void> {
  await getStore().set(KEYS.issues, list);
}

export async function getIssue(id: string): Promise<Issue | null> {
  return (await getIssues()).find((i) => i.id === id) ?? null;
}

export async function updateIssue(id: string, patch: Partial<Issue>): Promise<Issue | null> {
  const list = await getIssues();
  const idx = list.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const next: Issue = { ...list[idx], ...patch, id, updatedAt: new Date().toISOString() };
  list[idx] = next;
  await saveIssues(list);
  return next;
}

export async function resetIssuesToSeed(): Promise<Issue[]> {
  const seeded = seedIssues(await getArea());
  await saveIssues(seeded);
  return seeded;
}

export async function getSettings(): Promise<Office> {
  const stored = await getStore().get<Partial<Office>>(KEYS.settings);
  return { ...DEFAULT_OFFICE, ...(stored ?? {}) };
}

export async function saveSettings(office: Office): Promise<void> {
  await getStore().set(KEYS.settings, office);
}

export async function getLetters(): Promise<Letter[]> {
  const store = getStore();
  const list = await store.get<Letter[]>(KEYS.letters);
  if (list) return list;
  const seeded = seedLetters(bundledMarket as MarketDoc);
  await store.set(KEYS.letters, seeded);
  return seeded;
}

export async function getLetter(id: string): Promise<Letter | null> {
  return (await getLetters()).find((l) => l.id === id) ?? null;
}

export async function saveLetter(letter: Letter): Promise<void> {
  const list = await getLetters();
  const idx = list.findIndex((l) => l.id === letter.id);
  if (idx >= 0) list[idx] = letter;
  else list.unshift(letter);
  await getStore().set(KEYS.letters, list.slice(0, 100));
}

export async function getMarket(): Promise<MarketDoc> {
  const stored = await getStore().get<MarketDoc>(KEYS.market);
  return stored ?? (bundledMarket as MarketDoc);
}

export async function saveMarket(doc: MarketDoc): Promise<void> {
  await getStore().set(KEYS.market, doc);
}

export async function getMeta(): Promise<Meta> {
  const stored = await getStore().get<Meta>(KEYS.meta);
  return stored ?? { lastCollectAt: null, lastCollect: null, lastMarketAt: null };
}

export async function saveMeta(meta: Meta): Promise<void> {
  await getStore().set(KEYS.meta, meta);
}

/* ── 인스타 카드 구성 ── */
export async function getInstaSaves(): Promise<InstaSave[]> {
  return (await getStore().get<InstaSave[]>(KEYS.insta)) ?? [];
}
export async function addInstaSave(save: InstaSave): Promise<InstaSave[]> {
  const list = [save, ...(await getInstaSaves())].slice(0, 100);
  await getStore().set(KEYS.insta, list);
  return list;
}
export async function deleteInstaSave(id: string): Promise<InstaSave[]> {
  const list = (await getInstaSaves()).filter((s) => s.id !== id);
  await getStore().set(KEYS.insta, list);
  return list;
}

/* ── 블로그 포스팅 ── */
export async function getBlogPosts(): Promise<BlogPost[]> {
  return (await getStore().get<BlogPost[]>(KEYS.blog)) ?? [];
}
export async function upsertBlogPost(post: BlogPost): Promise<BlogPost[]> {
  const list = await getBlogPosts();
  const idx = list.findIndex((p) => p.id === post.id);
  if (idx >= 0) list[idx] = post;
  else list.unshift(post);
  const next = list.slice(0, 200);
  await getStore().set(KEYS.blog, next);
  return next;
}
export async function deleteBlogPost(id: string): Promise<BlogPost[]> {
  const list = (await getBlogPosts()).filter((p) => p.id !== id);
  await getStore().set(KEYS.blog, list);
  return list;
}
