import { getBanners, getLetters, getSettings } from "@/lib/repo";
import LetterBuilder from "./LetterBuilder";

export const dynamic = "force-dynamic";

export default async function LettersPage() {
  const [letters, office, banners] = await Promise.all([getLetters(), getSettings(), getBanners()]);
  const published = letters
    .filter((l) => l.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return <LetterBuilder office={office} published={published} banners={banners} />;
}
