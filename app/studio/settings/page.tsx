import { getSettings } from "@/lib/repo";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const office = await getSettings();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>설정</h1>
          <p>EDM의 마스트헤드·푸터·상담 버튼에 그대로 실리는 정보입니다. 상호·대표·등록번호·연락처와 수신거부 수단이 없으면 발행이 막힙니다.</p>
        </div>
      </div>
      <SettingsForm office={office} />
    </>
  );
}
