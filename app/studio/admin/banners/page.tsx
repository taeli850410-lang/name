import { getBanners } from "@/lib/repo";
import AdminTabs from "../AdminTabs";
import BannerEditor from "./BannerEditor";

export const dynamic = "force-dynamic";

export default async function BannersPage() {
  const banners = await getBanners();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>배너</h1>
          <p>
            고객용 EDM 과 중개사용 브리핑 맨 아래에 서는 홍보 배너입니다. 영상 기사와 달리 발행 시점에 얼리지 않아서, <b>이미 보낸 링크를 고객이 오늘 열면 오늘 배너가 보입니다.</b> 대신 종료일이 지나면 스스로 사라집니다.
          </p>
        </div>
      </div>
      <AdminTabs />
      <BannerEditor initial={banners} />
    </>
  );
}
