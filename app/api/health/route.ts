import { NextResponse } from "next/server";
import { studioProtected } from "@/lib/auth";
import { llmEnabled } from "@/lib/enrich";
import { getMeta, getVideos } from "@/lib/repo";
import { storeEnvNames, storeStatus } from "@/lib/store";
import { videoWeigh } from "@/lib/brief";
import { isClipVideo, pickVideos } from "@/lib/channels";
import { clamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const [meta, store, videos] = await Promise.all([getMeta(), storeStatus(), getVideos()]);
  // 영상란이 왜 그 영상을 골랐는지 — 담긴 편수, 채널별 분포, 중개사용으로 뽑힌 세 편
  const byChannel: Record<string, number> = {};
  for (const v of videos) byChannel[v.channel] = (byChannel[v.channel] ?? 0) + 1;
  const picked = pickVideos(videos, "daily", 3, Date.now(), videoWeigh(["공인중개사"])).map((v) => ({
    ch: v.channel,
    topic: v.topic,
    at: v.publishedAt,
    title: clamp(v.title, 40),
  }));
  // 저장된 것 전부 — 어느 채널의 어떤 편이 쇼츠로 잡혔는지 한눈에 보려고
  const all = videos.map((v) => ({
    ch: v.channel,
    cid: v.channelId.slice(-6),
    topic: v.topic,
    at: v.publishedAt.slice(5, 16),
    len: v.summary.trim().length,
    clip: isClipVideo(v),
    title: clamp(v.title, 34),
  }));
  return NextResponse.json({
    ok: true,
    // production | preview | development — 변수의 환경 체크와 맞춰 볼 값입니다
    env: process.env.VERCEL_ENV ?? "local",
    store: store.kind,
    persistent: store.persistent,
    storeError: store.error,
    storeVars: storeEnvNames(),
    studioProtected: studioProtected(),
    llm: llmEnabled(),
    videos: { stored: videos.length, byChannel, picked, all },
    lastCollectAt: meta.lastCollectAt,
    lastMarketAt: meta.lastMarketAt,
  });
}
