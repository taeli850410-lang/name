import bundledMarket from "@/data/market-sample.json";
import { DEFAULT_OFFICE, seedIssues, seedLetters } from "./seed";
import { detectPlace } from "./classify";
import { getStore } from "./store";
import { normalizeRegion } from "./taxonomy";
import { BANNER_MAX, normalizeBanner } from "./banner";
import type { AreaConfig, Banner, BlogPost, InstaSave, Issue, Letter, MarketDoc, Meta, Office, VideoItem } from "./types";

/** 저장소 접근 계층. 컬렉션 단위 문서(issues, letters, settings, market, meta, insta, blog, videos, banners)로 저장합니다. */

const KEYS = { issues: "issues", letters: "letters", settings: "settings", market: "market", meta: "meta", insta: "insta", blog: "blog", videos: "videos", banners: "banners" } as const;

export async function getIssues(): Promise<Issue[]> {
  const store = getStore();
  const list = await store.get<Issue[]>(KEYS.issues);
  // 구버전 저장본의 지역 값(seoul·gyeonggi·anyang)을 현재 4종으로 옮겨 읽습니다
  // place 는 나중에 붙은 필드라 옛 저장본에는 없습니다. 읽을 때 제목에서 채웁니다.
  if (list) return list.map((i) => ({ ...i, region: normalizeRegion(i.region), place: i.place ?? detectPlace(i.title) }));
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

/**
 * 예전 기본값이 그대로 저장돼 있으면 새 기본값으로 넘깁니다.
 *
 * 사무소가 직접 고른 값이 아니라 그때의 기본값이 저장된 것뿐인데, 한번 저장되고 나면
 * 코드에서 기본값을 바꿔도 영영 예전 값이 이깁니다. 사무소가 직접 다른 이름을 넣어 두었으면
 * 그건 건드리지 않습니다 — 정확히 예전 기본값일 때만 넘어갑니다.
 */
const RETIRED_DEFAULTS: Partial<Record<keyof Office, string[]>> = {
  videoBrand: ["REPORT K"],
};

function migrateDefaults(office: Office): Office {
  const next = { ...office };
  for (const [key, retired] of Object.entries(RETIRED_DEFAULTS) as [keyof Office, string[]][]) {
    if (retired.includes(String(next[key] ?? ""))) (next[key] as string) = String(DEFAULT_OFFICE[key] ?? "");
  }
  return next;
}

export async function getSettings(): Promise<Office> {
  const stored = await getStore().get<Partial<Office>>(KEYS.settings);
  return migrateDefaults({ ...DEFAULT_OFFICE, ...(stored ?? {}) });
}

export async function saveSettings(office: Office): Promise<void> {
  await getStore().set(KEYS.settings, office);
}

export async function getLetters(): Promise<Letter[]> {
  const store = getStore();
  const list = await store.get<Letter[]>(KEYS.letters);
  const sample = seedLetters(bundledMarket as MarketDoc);
  if (!list) {
    await store.set(KEYS.letters, sample);
    return sample;
  }
  // 샘플 EDM(demo)은 사무소가 쓴 편지가 아니라 '지금 코드가 무엇을 그리는지' 보여 주는 자리입니다.
  // 저장된 것을 그대로 두면 처음 배포한 날의 샘플이 계속 남습니다 — 영상란이 비어 있는 샘플이
  // 몇 주째 남아서, 영상 기능이 아예 없는 것처럼 보였습니다. 발행한 편지는 건드리지 않습니다.
  return list.map((l) => (l.id === "demo" ? sample[0] : l));
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

/* ── 영상 기사 ── */
export async function getVideos(): Promise<VideoItem[]> {
  return (await getStore().get<VideoItem[]>(KEYS.videos)) ?? [];
}
export async function saveVideos(list: VideoItem[]): Promise<void> {
  await getStore().set(KEYS.videos, list);
}

/* ── 홍보 배너 ── */
/** 저장된 값을 그대로 믿지 않고 한 번 다듬어 돌려줍니다 — 손으로 고친 JSON 이 들어올 수 있습니다 */
export async function getBanners(): Promise<Banner[]> {
  const raw = (await getStore().get<Partial<Banner>[]>(KEYS.banners)) ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, BANNER_MAX).map((b, i) => normalizeBanner(b, `banner-${i + 1}`));
}
export async function saveBanners(list: Banner[]): Promise<void> {
  await getStore().set(KEYS.banners, list.slice(0, BANNER_MAX));
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
