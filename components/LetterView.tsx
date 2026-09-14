import BriefView, { BriefCard } from "@/components/Brief";
import { customerCard, letterToBrief } from "@/lib/brief";
import type { Banner, Letter, LetterIssue, Office } from "@/lib/types";

/**
 * 고객용 EDM = 남색 테마 브리핑. 발행 스냅샷(Letter)을 브리핑 모델로 바꿔 공통 렌더러에 넘깁니다.
 *
 * 배너와 사무소 정보는 스냅샷이 아니라 지금 값을 받습니다. 편지 본문은 보낸 그날의 기록이어야
 * 하지만, 홍보 배너는 이미 보낸 링크에서도 이번 주 것이 보여야 홍보가 되고, 상호·대표·등록번호·
 * 연락처는 사무소가 지금 누구인지라 옛것이 남으면 고객이 없는 번호로 겁니다. 클라이언트에서도
 * 쓰이는 컴포넌트라 저장소를 직접 못 읽고, 호출하는 쪽이 넣어 줍니다.
 */
export default function LetterView({ letter, banners = [], office }: { letter: Letter; banners?: Banner[]; office?: Office }) {
  return <BriefView model={letterToBrief(letter, banners, Date.now(), office)} />;
}

/** 이슈 편집 화면의 고객 카드 미리보기 */
export function LetterIssueCard({ item, index }: { item: LetterIssue; index: number }) {
  return <BriefCard card={customerCard(item, index)} index={index} />;
}
