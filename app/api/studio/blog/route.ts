import { NextResponse } from "next/server";
import { deleteBlogPost, getBlogPosts, upsertBlogPost } from "@/lib/repo";
import type { BlogPost } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ posts: await getBlogPosts() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<BlogPost> | null;
  if (!body || !body.id || typeof body.body !== "string") return NextResponse.json({ error: "id 와 body 가 필요합니다." }, { status: 400 });
  const now = new Date().toISOString();
  const titleFromBody = body.body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const post: BlogPost = {
    id: String(body.id),
    issueId: String(body.issueId || ""),
    topicLabel: String(body.topicLabel || "").slice(0, 120),
    title: (titleFromBody || String(body.title || "제목 없음")).slice(0, 160),
    body: body.body,
    createdAt: String(body.createdAt || now),
    updatedAt: now,
  };
  return NextResponse.json({ posts: await upsertBlogPost(post), post });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400 });
  return NextResponse.json({ posts: await deleteBlogPost(id) });
}
