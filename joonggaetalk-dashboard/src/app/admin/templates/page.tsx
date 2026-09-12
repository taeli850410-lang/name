"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MoreMenu, PageHead } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { publicTemplates } from "@/data/members";

export default function PublicTemplatesPage() {
  const toast = useToast();
  const [deploy, setDeploy] = useState<(typeof publicTemplates)[number] | null>(null);
  return (
    <>
      <PageHead title="공용 템플릿" desc="모든 회원이 '공용 템플릿에서 받기'로 가져갈 수 있는 기본 템플릿입니다. 수정하면 기존 회원의 사본은 바뀌지 않으며, 배포를 눌러야 갱신 안내가 나갑니다." actions={<button type="button" className="btn btn--primary" onClick={() => toast({ tone: "info", message: "공용 템플릿 작성 (프로토타입)" })}><Icon name="plus" size={16} /> 공용 템플릿</button>} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>템플릿</th><th className="th-right">사용 회원</th><th>갱신일</th><th className="th-right">관리</th></tr></thead>
          <tbody>
            {publicTemplates.map((t) => (
              <tr key={t.id}>
                <td className="cell-title">{t.name}</td>
                <td className="td-num">{t.users}명</td>
                <td className="num nowrap">{t.updatedAt}</td>
                <td><div className="row-actions"><button type="button" className="btn btn--sm" onClick={() => toast({ tone: "info", message: "수정 (프로토타입)" })}>수정</button><MoreMenu items={[{ label: "회원에게 갱신 배포", icon: "upload", onClick: () => setDeploy(t) }, { label: "미리보기", icon: "eye", onClick: () => toast({ tone: "info", message: "미리보기 (프로토타입)" }) }]} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmModal open={!!deploy} onClose={() => setDeploy(null)} title={`'${deploy?.name}'을(를) ${deploy?.users}명에게 배포합니다`} description="회원의 사본이 새 내용으로 바뀌고 카카오 재검수가 자동으로 요청됩니다. 검수 중에는 그 템플릿의 자동발송이 일시 중단됩니다." confirmLabel="배포" onConfirm={() => { const d = deploy; setDeploy(null); if (d) toast(`${d.users}명에게 배포했습니다. 재검수 결과는 1~2 영업일 뒤 반영됩니다.`); }} />
    </>
  );
}
