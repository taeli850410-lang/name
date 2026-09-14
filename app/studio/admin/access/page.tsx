import { canStorePassword, storedToken } from "@/lib/authStore";
import AdminTabs from "../AdminTabs";
import AccessForm from "./AccessForm";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const stored = Boolean(await storedToken());
  return (
    <>
      <div className="page-head">
        <div>
          <h1>접근 관리</h1>
          <p>스튜디오에 비밀번호를 겁니다. 여기에는 사무소 등록번호·연락처와 발행·수집 버튼, 그리고 고객에게 나가는 배너가 모여 있습니다.</p>
        </div>
      </div>
      <AdminTabs />
      <AccessForm envPassword={Boolean(process.env.STUDIO_PASSWORD)} stored={stored} canStore={canStorePassword()} />
    </>
  );
}
