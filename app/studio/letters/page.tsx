import { getLetters, getSettings } from "@/lib/repo";
import LetterBuilder from "./LetterBuilder";

export const dynamic = "force-dynamic";

export default async function LettersPage() {
  const [letters, office] = await Promise.all([getLetters(), getSettings()]);
  const published = letters
    .filter((l) => l.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return <LetterBuilder office={office} published={published} />;
}
