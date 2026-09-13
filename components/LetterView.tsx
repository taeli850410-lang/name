import BriefView, { BriefCard } from "@/components/Brief";
import { customerCard, letterToBrief } from "@/lib/brief";
import type { Letter, LetterIssue } from "@/lib/types";

/** 고객용 EDM = 남색 테마 브리핑. 발행 스냅샷(Letter)을 브리핑 모델로 바꿔 공통 렌더러에 넘깁니다. */
export default function LetterView({ letter }: { letter: Letter }) {
  return <BriefView model={letterToBrief(letter)} />;
}

/** 이슈 편집 화면의 고객 카드 미리보기 */
export function LetterIssueCard({ item, index }: { item: LetterIssue; index: number }) {
  return <BriefCard card={customerCard(item, index)} index={index} />;
}
