import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LetterView from "@/components/LetterView";
import { letterTitle } from "@/lib/letter";
import { getLetter } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const letter = await getLetter(id);
  if (!letter) return { title: "브리핑을 찾을 수 없습니다" };
  return {
    title: `${letter.office.officeName} · ${letterTitle(letter)}`,
    description: letter.headline,
    robots: { index: false, follow: false },
    openGraph: { title: `${letter.office.officeName} 부동산 브리핑`, description: letter.headline, type: "article" },
  };
}

export default async function LetterPage({ params }: Props) {
  const { id } = await params;
  const letter = await getLetter(id);
  if (!letter || letter.status !== "published") notFound();
  return (
    <main style={{ background: "#e9ecf6", minHeight: "100vh", padding: "16px 0" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px -20px rgba(15,23,42,0.35)" }}>
        <LetterView letter={letter} />
      </div>
    </main>
  );
}
