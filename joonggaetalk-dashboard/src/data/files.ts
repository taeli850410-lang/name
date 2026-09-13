/**
 * 계약·물건에 붙은 첨부 파일.
 *
 * 파일 자체는 저장소에 있고 여기에는 그 자리(key)와 설명만 둔다.
 * key 에는 파일 이름이 들어가지 않는다 — 주소만 새어도 내용을 짐작하게 하지 않으려고.
 */
import type { FileKind } from "@/lib/storage";

export type Attachment = {
  id: string;
  /** 어디에 붙은 파일인지 — deals/d1, properties/p1 */
  scope: "deals" | "properties";
  ownerId: string;
  kind: FileKind;
  /** 보여 줄 이름 (원래 파일 이름) */
  name: string;
  /** 저장소 안의 자리 */
  key: string;
  bytes: number;
  uploadedAt: string;
  uploadedBy: string;
  /** 고객용 화면에서도 보이는가. 계약서는 보통 보여 주고 신분증은 절대 아니다. */
  sharedWithCustomer: boolean;
};

export const attachments: Attachment[] = [
  {
    id: "f1",
    scope: "deals",
    ownerId: "d1",
    kind: "계약서",
    name: "더샵부평 110동 103호 전세계약서.pdf",
    key: "deals/d1/Kd8vQ2mB7pLr.pdf",
    bytes: 2_412_000,
    uploadedAt: "2026-08-15 17:20",
    uploadedBy: "이서연",
    sharedWithCustomer: true,
  },
  {
    id: "f2",
    scope: "deals",
    ownerId: "d1",
    kind: "확인설명서",
    name: "중개대상물 확인설명서.pdf",
    key: "deals/d1/9xTbN4wQ1zRc.pdf",
    bytes: 890_000,
    uploadedAt: "2026-08-15 17:22",
    uploadedBy: "이서연",
    sharedWithCustomer: true,
  },
  {
    id: "f3",
    scope: "deals",
    ownerId: "d1",
    kind: "등기부등본",
    name: "등기사항전부증명서_십정동630.pdf",
    key: "deals/d1/Lm3pR8kT5vWy.pdf",
    bytes: 310_000,
    uploadedAt: "2026-08-14 10:05",
    uploadedBy: "시스템 (등기부 감시)",
    sharedWithCustomer: false,
  },
  {
    // 보존기간(3개월)이 지난 신분증 — 화면에서 파기 대상으로 잡힌다
    id: "f4",
    scope: "deals",
    ownerId: "d1",
    kind: "신분증",
    name: "임차인 신분증.jpg",
    key: "deals/d1/Qz7hJ2nD6sFg.jpg",
    bytes: 1_150_000,
    uploadedAt: "2026-05-20 09:40",
    uploadedBy: "이서연",
    sharedWithCustomer: false,
  },
  {
    id: "f5",
    scope: "deals",
    ownerId: "d2",
    kind: "계약서",
    name: "청라 한양수자인 매매계약서.pdf",
    key: "deals/d2/Vb5cX9mK3tYu.pdf",
    bytes: 3_050_000,
    uploadedAt: "2026-08-31 16:10",
    uploadedBy: "이서연",
    sharedWithCustomer: true,
  },
  {
    id: "f6",
    scope: "properties",
    ownerId: "p1",
    kind: "물건사진",
    name: "거실.jpg",
    key: "properties/p1/Ht2sL7bV4nQx.jpg",
    bytes: 1_820_000,
    uploadedAt: "2026-08-02 14:33",
    uploadedBy: "이서연",
    sharedWithCustomer: true,
  },
];

export function attachmentsOf(scope: Attachment["scope"], ownerId: string): Attachment[] {
  return attachments.filter((a) => a.scope === scope && a.ownerId === ownerId);
}
