"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { adminNav, agentNav, crumbsFor, isActive } from "@/lib/nav";
import { systemStatus } from "@/data/system";
import { notifications } from "@/data/notifications";

type Props = { role: "agent" | "admin"; children: ReactNode };

/**
 * 앱 골격: 좌측 고정 사이드바(현재 위치 강조) + 상단 경로 + 알림.
 * 1024px 미만에서는 사이드바가 서랍으로 바뀐다.
 */
export function AppShell({ role, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const nav = role === "admin" ? adminNav : agentNav;
  const crumbs = crumbsFor(pathname);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!bell) return;
    const onDoc = (e: MouseEvent) => !bellRef.current?.contains(e.target as Node) && setBell(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [bell]);

  const sendingDown = systemStatus.balsongking.status !== "ok";

  return (
    <div className="shell">
      <div className={`backdrop${open ? " is-open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`side${open ? " is-open" : ""}`} aria-label="주 메뉴">
        <div className="side__brand">
          {/* 브랜드를 누르면 첫 화면(역할 선택)으로 — 관례대로 로고가 홈 링크다 */}
          <Link href="/" className="side__brand-link" title="중개톡 메인 화면으로">
            <span className="mark" aria-hidden>
              J
            </span>
            <span className="name">중개톡</span>
          </Link>
          <span className={`role${role === "admin" ? " role--admin" : ""}`}>{role === "admin" ? "운영자" : "중개사"}</span>
        </div>
        <nav className="side__nav">
          {nav.map((g, gi) => (
            <div key={gi} className="side__group">
              {g.label && <div className="side__label">{g.label}</div>}
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={`side__link${isActive(pathname, it.href) ? " is-active" : ""}`} aria-current={isActive(pathname, it.href) ? "page" : undefined}>
                  <Icon name={it.icon} size={17} />
                  <span>{it.label}</span>
                  {it.count ? <span className={`cnt${it.badge === "soft" ? " cnt--soft" : ""}`}>{it.count}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="side__foot">
          <div>
            <span className={`status-dot${sendingDown ? " status-dot--danger" : ""}`} />
            알림톡 발송 {sendingDown ? "장애" : "정상"}
          </div>
          <div>
            <span className="status-dot" />
            등기부 감시 작동 중 · {systemStatus.registry.running}대
          </div>
          {role === "admin" && (
            <Link href="/agent" className="link">
              내 중개사 화면으로 →
            </Link>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="iconbtn burger" onClick={() => setOpen(true)} aria-label="메뉴 열기">
            <Icon name="menu" />
          </button>
          <nav className="crumbs" aria-label="현재 위치">
            <Link href={role === "admin" ? "/admin" : "/agent"}>{role === "admin" ? "운영" : "서연공인중개사사무소"}</Link>
            {crumbs.map((c, i) => (
              <span key={i} className="row" style={{ gap: 6 }}>
                <span className="sep">›</span>
                <span className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>
              </span>
            ))}
          </nav>
          <div className="topbar__right">
            <Link href={role === "admin" ? "/admin/members" : "/agent/customers"} className="iconbtn" aria-label="검색">
              <Icon name="search" />
            </Link>
            <div className="rel" ref={bellRef}>
              <button type="button" className="iconbtn" aria-label={`알림 ${unread}건`} aria-expanded={bell} onClick={() => setBell((v) => !v)}>
                <Icon name="bell" />
                {unread > 0 && <span className="dot" />}
              </button>
              {bell && (
                <div className="popover" role="dialog" aria-label="알림">
                  <div className="popover__head">
                    알림 <span className="muted small">읽지 않음 {unread}</span>
                  </div>
                  {notifications.map((n) => (
                    <Link key={n.id} href={n.href} className="popover__item" onClick={() => setBell(false)}>
                      <span className={`alert-i`} style={{ padding: 0, border: 0 }}>
                        <span className={`ic ic--${n.tone}`}>
                          <Icon name={n.tone === "danger" ? "alertTriangle" : n.tone === "warn" ? "alertCircle" : n.tone === "good" ? "checkCircle" : "info"} size={15} />
                        </span>
                      </span>
                      <span>
                        <div className="t">{n.title}</div>
                        <div className="s">{n.when}</div>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/agent/settings" className="avatar" aria-label="내 정보">
              <span className="circle">서</span>
              <span>이서연</span>
            </Link>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
