import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LetterView from "@/components/LetterView";
import { letterTitle } from "@/lib/letter";
import { getBanners, getLetter, getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [letter, office] = await Promise.all([getLetter(id), getSettings()]);
  if (!letter) return { title: "브리핑을 찾을 수 없습니다" };
  // 제목에 드는 상호도 얼려 둔 것이 아니라 지금 것입니다 — 본문과 같아야 합니다
  const name = office.officeName || letter.office.officeName;
  return {
    title: `${name} · ${letterTitle(letter)}`,
    description: letter.headline,
    robots: { index: false, follow: false },
    openGraph: { title: `${name} 부동산 브리핑`, description: letter.headline, type: "article" },
  };
}

export default async function LetterPage({ params }: Props) {
  const { id } = await params;
  const [letter, banners, office] = await Promise.all([getLetter(id), getBanners(), getSettings()]);
  if (!letter || letter.status !== "published") notFound();
  return (
    <main className="brief-stage page">
      <div className="brief-device">
        <LetterView letter={letter} banners={banners} office={office} />
      </div>
    </main>
  );
}
