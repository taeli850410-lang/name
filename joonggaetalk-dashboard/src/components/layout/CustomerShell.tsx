"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { portal } from "@/data/portal";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/customer", label: "홈", icon: "home" },
  { href: "/customer/deal", label: "내 계약", icon: "file" },
  { href: "/customer/market", label: "시세", icon: "trendUp" },
  { href: "/customer/settings", label: "알림 설정", icon: "bell" },
];

/** 고객용 포털 골격 — 알림톡 링크로 여는 모바일 화면. 상단은 중개사 사무소명, 하단은 탭 4개. */
export function CustomerShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="pshell">
      <header className="pshell__top">
        <div className="office">{portal.agent.office}</div>
        <div className="title">
          <span>{title}</span>
          <Link href="/" className="small" style={{ opacity: 0.8, fontWeight: 500 }}>
            역할 선택
          </Link>
        </div>
      </header>
      <div className="pshell__body">{children}</div>
      <nav className="pshell__tabs" aria-label="고객 메뉴">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={pathname === t.href ? "is-active" : ""} aria-current={pathname === t.href ? "page" : undefined}>
            <Icon name={t.icon} size={20} />
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
