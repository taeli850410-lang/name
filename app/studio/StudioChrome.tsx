"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SERVICE_BRAND } from "@/lib/brand";
import type { Period } from "@/lib/types";
import OfficeDialog from "./OfficeDialog";

/**
 * 원본 EDM 스튜디오의 상단 뼈대. 짙은 남색 바 한 줄에
 * 브랜드 · DAILY/WEEKLY/MONTHLY · 이메일/모바일/인스타 카드/블로그 포스팅 · 사무소/메일/PDF·인쇄/카카오톡/링크 · 실시간 뉴스 수집 시각.
 * 그 아래 얇은 줄에 이 서비스에만 있는 Pocket·EDM 빌더·우리 동네 숫자·관리자와 상태 칩을 둡니다.
 * 매일 쓰는 칸은 앞의 셋이고, 어쩌다 만지는 것(현황·배너·사무소 정보)은 관리자 한 칸 안에 모읍니다.
 */

export interface ChromeLetter {
  id: string;
  period: Period;
  title: string;
  headline: string;
  /** 카카오톡 공유 문구. {{URL}} 자리에 EDM 주소가 들어갑니다 */
  share: string;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "DAILY" },
  { key: "weekly", label: "WEEKLY" },
  { key: "monthly", label: "MONTHLY" },
];

export default function StudioChrome({
  collectLabel,
  letters,
  storeLabel,
  storePersistent,
  storeError,
  llmLabel,
}: {
  collectLabel: string | null;
  letters: ChromeLetter[];
  storeLabel: string;
  storePersistent: boolean;
  storeError: string | null;
  llmLabel: string | null;
}) {
  const pathname = usePathname() ?? "/studio";
  const sp = useSearchParams();
  const router = useRouter();
  const rawPeriod = sp?.get("period") ?? "";
  const period: Period = rawPeriod === "weekly" || rawPeriod === "monthly" ? rawPeriod : "daily";
  const view = sp?.get("view") === "mobile" ? "mobile" : "email";
  // 고객용·중개사용은 같은 화면의 두 얼굴입니다. 주기와 이메일·모바일은 어느 쪽에서도 그대로 씁니다
  const audience = sp?.get("audience") === "customer" ? "customer" : "broker";
  const segment = sp?.get("segment") ?? "";
  const onBrief = pathname === "/studio/brief";
  const onInsta = pathname.startsWith("/studio/instagram");
  const onBlog = pathname.startsWith("/studio/blog");
  const [toast, setToast] = useState<string | null>(null);
  const [officeOpen, setOfficeOpen] = useState(false);
  const headRef = useRef<HTMLElement>(null);

  // 상단 바 높이를 --chrome-h 로 알려 줍니다. 문서 액션 바·사이드 패널이 이 값 아래에 붙습니다.
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty("--chrome-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** 브리핑 주소 한 곳에서 만듭니다 — 어느 칸을 눌러도 나머지 선택이 안 풀리게 */
  const briefHref = (o: { period?: Period; view?: string; audience?: string } = {}) => {
    const a = o.audience ?? audience;
    const q = new URLSearchParams({ period: o.period ?? period, view: o.view ?? view });
    if (a === "customer") {
      q.set("audience", "customer");
      if (segment) q.set("segment", segment);
    }
    return `/studio/brief?${q.toString()}`;
  };
  const periodHref = (p: Period) => (onInsta ? `/studio/instagram?period=${p}` : onBlog ? `/studio/blog?period=${p}` : briefHref({ period: p }));
  const letter = letters.find((l) => l.period === period) ?? letters[0] ?? null;

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2400);
  }
  function letterUrl(): string | null {
    return letter ? new URL(`/l/${letter.id}`, window.location.origin).toString() : null;
  }
  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(done);
    } catch {
      window.prompt("복사", text);
    }
  }
  function needLetter() {
    flash("발행된 고객용 EDM이 없습니다. EDM 빌더에서 먼저 발행하세요.");
    router.push("/studio/letters");
  }
  function mail() {
    const url = letterUrl();
    if (!letter || !url) return needLetter();
    const subject = encodeURIComponent(`[${letter.title}] ${letter.headline}`);
    const body = encodeURIComponent(`${letter.headline}\n\n▶ 전체 브리핑 보기\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }
  function kakao() {
    const url = letterUrl();
    if (!letter || !url) return needLetter();
    void copy(letter.share.replace("{{URL}}", url), "카카오톡에 붙여 넣을 공유 문구를 복사했습니다.");
  }
  function link() {
    const url = letterUrl();
    if (!letter || !url) return needLetter();
    void copy(url, "고객용 EDM 링크를 복사했습니다.");
  }

  const cur = (on: boolean) => (on ? { "aria-current": "true" as const } : {});

  return (
    <>
      {officeOpen && <OfficeDialog onClose={() => setOfficeOpen(false)} />}
      <header className="studio-top" ref={headRef}>
        <div className="inner">
          {/* 로고는 메인(고객·중개사 선택 화면)으로. 브리핑은 아래 주기 탭으로 갑니다 */}
          <Link href="/" className="chrome-brand">
            {SERVICE_BRAND.line1}
            <small>{SERVICE_BRAND.line2}</small>
          </Link>
          <div className="chrome-navs">
          <nav className="chrome-seg" aria-label="주기">
            {PERIODS.map((p) => (
              <Link key={p.key} href={periodHref(p.key)} {...cur((onBrief || onInsta || onBlog) && period === p.key)}>
                {p.label}
              </Link>
            ))}
          </nav>
          {/* 중개사용을 보고 있을 때는 「고객용」을 안 내놓습니다 — 사무소가 하루 종일 들여다보는
              화면이라 안 쓰는 칸을 지웁니다. 고객용에서는 둘 다 나와서 중개사용으로 돌아올 수 있고,
              중개사용에서 고객용으로 갈 때는 아래 줄 「✉ EDM 빌더」를 씁니다. */}
          <nav className="chrome-seg" aria-label="보는 사람">
            {audience === "customer" && (
              <Link href={briefHref({ audience: "customer" })} {...cur(onBrief)}>
                고객용
              </Link>
            )}
            <Link href={briefHref({ audience: "broker" })} {...cur(onBrief && audience === "broker")}>
              중개사용
            </Link>
          </nav>
          <nav className="chrome-seg" aria-label="보기">
            <Link href={briefHref({ view: "email" })} {...cur(onBrief && view === "email")}>
              이메일
            </Link>
            <Link href={briefHref({ view: "mobile" })} {...cur(onBrief && view === "mobile")}>
              모바일
            </Link>
            <Link href={`/studio/instagram?period=${period}`} {...cur(onInsta)}>
              인스타 카드
            </Link>
            <Link href={`/studio/blog?period=${period}`} {...cur(onBlog)}>
              블로그 포스팅
            </Link>
          </nav>
          </div>
          <div className="chrome-acts">
            <button className="chrome-btn" onClick={() => setOfficeOpen(true)} title="상호·대표·등록번호·연락처를 이 화면에서 바로 고칩니다">
              🏢 사무소
            </button>
            <button className="chrome-btn" onClick={mail} title="최근 발행한 고객용 EDM을 메일로 보냅니다">
              ✉ 메일
            </button>
            <button className="chrome-btn" onClick={() => window.print()} title="브라우저 인쇄 대화상자에서 PDF로 저장">
              🖨 PDF·인쇄
            </button>
            <button className="chrome-btn" onClick={kakao} title="최근 발행한 EDM의 카카오톡 공유 문구 복사">
              💬 카카오톡
            </button>
            <button className="chrome-btn" onClick={link} title="최근 발행한 EDM 링크 복사">
              🔗 링크
            </button>
          </div>
          <span className={`chrome-status${collectLabel ? "" : " off"}`} title="마지막 수집 시각">
            {collectLabel ? `실시간 뉴스 · ${collectLabel} 수집` : "실시간 뉴스 · 수집 전 (샘플 데이터)"}
          </span>
        </div>
      </header>
      <div className="studio-sub">
        <div className="inner">
          <Link href="/studio" {...cur(pathname === "/studio" || pathname.startsWith("/studio/issues"))}>
            📥 Pocket
          </Link>
          <Link href="/studio/letters" {...cur(pathname.startsWith("/studio/letters"))}>
            ✉ EDM 빌더
          </Link>
          <Link href="/studio/data" {...cur(pathname.startsWith("/studio/data"))}>
            📊 우리 동네 숫자
          </Link>
          <Link href="/studio/admin" {...cur(pathname.startsWith("/studio/admin") || pathname.startsWith("/studio/settings"))}>
            🛠 관리자
          </Link>
          <div className="chips">
            <span className={`chip ${storePersistent ? "chip-ok" : "chip-warn"}`} title={storeError ?? "저장소 상태"}>
              {storeLabel}
            </span>
            <span className={`chip ${llmLabel ? "chip-ok" : "chip-neutral"}`} title="자동 초안">
              {llmLabel ? `자동 초안 · ${llmLabel}` : "자동 초안 꺼짐"}
            </span>
          </div>
        </div>
      </div>
      {toast && (
        <div className="chrome-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
