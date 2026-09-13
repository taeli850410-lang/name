import type { IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName; badge?: "danger" | "soft"; count?: number };
export type NavGroup = { label?: string; items: NavItem[] };

/** 중개사용 메뉴 — 6개 그룹, 현재 위치는 경로 접두로 판단 */
export const agentNav: NavGroup[] = [
  { items: [{ href: "/agent", label: "대시보드", icon: "home" }] },
  {
    label: "핵심 업무",
    items: [
      { href: "/agent/customers", label: "고객", icon: "users" },
      { href: "/agent/properties", label: "물건", icon: "building" },
      { href: "/agent/deals", label: "계약", icon: "file" },
      { href: "/agent/appointments", label: "약속", icon: "calendar", badge: "soft", count: 2 },
      { href: "/agent/registry", label: "등기부 감시", icon: "shield" },
    ],
  },
  {
    label: "알림톡",
    items: [
      { href: "/agent/alimtalk/templates", label: "템플릿", icon: "layers" },
      { href: "/agent/alimtalk/auto", label: "자동발송 설정", icon: "settings" },
      { href: "/agent/alimtalk/campaigns", label: "정기 발송", icon: "repeat" },
      { href: "/agent/alimtalk/send", label: "지금 발송", icon: "send" },
      { href: "/agent/alimtalk/history", label: "발송 내역", icon: "clock", badge: "danger", count: 30 },
    ],
  },
  {
    label: "내 계정",
    items: [
      { href: "/agent/settings", label: "나의 정보", icon: "user" },
      { href: "/agent/billing", label: "이용권", icon: "card" },
      { href: "/agent/logs", label: "작업 로그", icon: "list" },
    ],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/agent/notices", label: "공지사항", icon: "megaphone", badge: "soft", count: 2 },
      { href: "/agent/karma", label: "채널 품앗이", icon: "heart", badge: "danger", count: 1 },
      { href: "/agent/inquiries", label: "문의/제안", icon: "message" },
      { href: "/agent/links", label: "유익한 사이트", icon: "bookmark" },
    ],
  },
];

/** 운영자 메뉴 */
export const adminNav: NavGroup[] = [
  { items: [{ href: "/admin", label: "운영 대시보드", icon: "home" }] },
  {
    label: "운영",
    items: [
      { href: "/admin/members", label: "회원 관리", icon: "users", badge: "danger", count: 3 },
      { href: "/admin/inquiries", label: "문의 관리", icon: "message", badge: "danger", count: 2 },
      { href: "/admin/notices", label: "공지 관리", icon: "megaphone" },
      { href: "/admin/templates", label: "공용 템플릿", icon: "layers" },
    ],
  },
  {
    label: "시스템",
    items: [
      { href: "/admin/monitor", label: "서버·연동 상태", icon: "monitor", badge: "danger", count: 1 },
      { href: "/admin/settings", label: "시스템 설정", icon: "settings" },
    ],
  },
];

const labels: Record<string, string> = {
  "/agent": "대시보드",
  "/agent/customers": "고객",
  "/agent/properties": "물건",
  "/agent/deals": "계약",
  "/agent/appointments": "약속",
  "/agent/registry": "등기부 감시",
  "/agent/alimtalk": "알림톡",
  "/agent/alimtalk/templates": "템플릿",
  "/agent/alimtalk/auto": "자동발송 설정",
  "/agent/alimtalk/campaigns": "정기 발송",
  "/agent/alimtalk/send": "지금 발송",
  "/agent/alimtalk/history": "발송 내역",
  "/agent/settings": "나의 정보",
  "/agent/billing": "이용권",
  "/agent/logs": "작업 로그",
  "/agent/notices": "공지사항",
  "/agent/karma": "채널 품앗이",
  "/agent/inquiries": "문의/제안",
  "/agent/links": "유익한 사이트",
  "/admin": "운영 대시보드",
  "/admin/members": "회원 관리",
  "/admin/inquiries": "문의 관리",
  "/admin/notices": "공지 관리",
  "/admin/templates": "공용 템플릿",
  "/admin/monitor": "서버·연동 상태",
  "/admin/settings": "시스템 설정",
};

/** 경로 → 빵부스러기 ["알림톡", "발송 내역"] */
export function crumbsFor(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const out: string[] = [];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    if (acc === "/agent" || acc === "/admin") continue;
    if (labels[acc]) out.push(labels[acc]);
  }
  return out;
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/agent" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
