"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 관리자 화면의 탭 줄. 일상 업무(Pocket·EDM 빌더·우리 동네 숫자)와 달리
 * 여기 있는 것들은 어쩌다 한 번 만지는 자리라 상단 메뉴를 더 늘리지 않고 한 칸 안에 모읍니다.
 */

const TABS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/studio/admin", label: "현황판", match: (p) => p === "/studio/admin" },
  { href: "/studio/admin/banners", label: "배너", match: (p) => p.startsWith("/studio/admin/banners") },
  { href: "/studio/settings", label: "사무소 정보", match: (p) => p.startsWith("/studio/settings") },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="adm-tabs" aria-label="관리자 메뉴">
      {TABS.map((t) => {
        const on = t.match(pathname);
        return (
          <Link key={t.href} href={t.href} className={`adm-tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
