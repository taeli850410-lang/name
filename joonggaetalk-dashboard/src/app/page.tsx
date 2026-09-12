import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** 프로토타입 진입 — 세 사용자군의 화면으로 나뉜다. 실제 서비스에서는 로그인 후 역할에 따라 바로 이동한다. */
export default function Landing() {
  return (
    <main className="landing">
      <div className="brandmark" aria-hidden>
        J
      </div>
      <h1>중개톡 대시보드 프로토타입</h1>
      <p className="desc">고객용 · 중개사용 · 운영자용 화면을 역할별로 분리했습니다. 모든 데이터는 예시이며, 기준일은 2026년 9월 12일(토)입니다.</p>
      <div className="roles">
        <Link href="/customer" className="role">
          <span className="ic ic--customer">
            <Icon name="user" size={20} />
          </span>
          <h2>고객용</h2>
          <p>알림톡 링크로 여는 모바일 화면. 내 계약 일정과 D-day, 등기부 안심 알림, 관심지역 시세, 담당 중개사 연락처.</p>
          <span className="go">
            열어 보기 <Icon name="arrowRight" size={16} />
          </span>
        </Link>
        <Link href="/agent" className="role">
          <span className="ic ic--agent">
            <Icon name="building" size={20} />
          </span>
          <h2>중개사용</h2>
          <p>오늘 할 일이 먼저 보이는 대시보드. 고객·물건·계약·약속·등기부 감시와 알림톡 템플릿·자동발송·지금 발송·발송 내역.</p>
          <span className="go">
            열어 보기 <Icon name="arrowRight" size={16} />
          </span>
        </Link>
        <Link href="/admin" className="role">
          <span className="ic ic--admin">
            <Icon name="shield" size={20} />
          </span>
          <h2>운영자용</h2>
          <p>가입 승인·만료 임박·문의 대기 같은 처리할 일, 회원 현황, 발송량, 대행사·등기 감시 프로그램 상태, 시스템 설정.</p>
          <span className="go">
            열어 보기 <Icon name="arrowRight" size={16} />
          </span>
        </Link>
      </div>
      <p className="note">
        <Link href="/login" className="link">
          로그인 화면 보기
        </Link>{" "}
        · 휴대폰번호와 비밀번호 두 칸으로 줄인 안입니다.
      </p>
    </main>
  );
}
