"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Period } from "@/lib/types";

/**
 * 원본 EDM 스튜디오의 상단 뼈대. 짙은 남색 바 한 줄에
 * 브랜드 · DAILY/WEEKLY/MONTHLY · 이메일/모바일/인스타 카드/블로그 포스팅 · 사무소/메일/PDF·인쇄/카카오톡/링크 · 실시간 뉴스 수집 시각.
 * 그 아래 얇은 줄에 이 서비스에만 있는 인박스·레터 빌더·우리 동네 숫자·설정과 상태 칩을 둡니다.
 */

export interface ChromeLetter {
  id: string;
  period: Period;
  title: string;
  headline: string;
  /** 카카오톡 공유 문구. {{URL}} 자리에 레터 주소가 들어갑니다 */
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
  llmLabel,
}: {
  collectLabel: string | null;
  letters: ChromeLetter[];
  storeLabel: string;
  storePersistent: boolean;
  llmLabel: string | null;
}) {
  const pathname = usePathname() ?? "/studio";
  const sp = useSearchParams();
  const router = useRouter();
  const rawPeriod = sp?.get("period") ?? "";
  const period: Period = rawPeriod === "weekly" || rawPeriod === "monthly" ? rawPeriod : "daily";
  const view = sp?.get("view") === "mobile" ? "mobile" : "email";
  const onBrief = pathname === "/studio/brief";
  const onInsta = pathname.startsWith("/studio/instagram");
  const onBlog = pathname.startsWith("/studio/blog");
  const [toast, setToast] = useState<string | null>(null);
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

  const periodHref = (p: Period) => (onInsta ? `/studio/instagram?period=${p}` : onBlog ? `/studio/blog?period=${p}` : `/studio/brief?period=${p}&view=${view}`);
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
    flash("발행된 고객용 레터가 없습니다. 레터 빌더에서 먼저 발행하세요.");
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
    void copy(url, "고객용 레터 링크를 복사했습니다.");
  }

  const cur = (on: boolean) => (on ? { "aria-current": "true" as const } : {});

  return (
    <>
      <header className="studio-top" ref={headRef}>
        <div className="inner">
          <Link href="/studio/brief" className="chrome-brand">
            REAL ESTATE<small>REPORT ALERT</small>
          </Link>
          <nav className="chrome-seg" aria-label="주기">
            {PERIODS.map((p) => (
              <Link key={p.key} href={periodHref(p.key)} {...cur((onBrief || onInsta || onBlog) && period === p.key)}>
                {p.label}
              </Link>
            ))}
          </nav>
          <nav className="chrome-seg" aria-label="보기">
            <Link href={`/studio/brief?period=${period}&view=email`} {...cur(onBrief && view === "email")}>
              이메일
            </Link>
            <Link href={`/studio/brief?period=${period}&view=mobile`} {...cur(onBrief && view === "mobile")}>
              모바일
            </Link>
            <Link href={`/studio/instagram?period=${period}`} {...cur(onInsta)}>
              인스타 카드
            </Link>
            <Link href={`/studio/blog?period=${period}`} {...cur(onBlog)}>
              블로그 포스팅
            </Link>
          </nav>
          <div className="chrome-acts">
            <Link className="chrome-btn" href="/studio/settings" title="사무소 정보·슬로건·한마디">
              🏢 사무소
            </Link>
            <button className="chrome-btn" onClick={mail} title="최근 발행한 고객용 레터를 메일로 보냅니다">
              ✉ 메일
            </button>
            <button className="chrome-btn" onClick={() => window.print()} title="브라우저 인쇄 대화상자에서 PDF로 저장">
              🖨 PDF·인쇄
            </button>
            <button className="chrome-btn" onClick={kakao} title="최근 발행한 레터의 카카오톡 공유 문구 복사">
              💬 카카오톡
            </button>
            <button className="chrome-btn" onClick={link} title="최근 발행한 레터 링크 복사">
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
            📥 인박스
          </Link>
          <Link href="/studio/letters" {...cur(pathname.startsWith("/studio/letters"))}>
            ✉ 레터 빌더
          </Link>
          <Link href="/studio/data" {...cur(pathname.startsWith("/studio/data"))}>
            📊 우리 동네 숫자
          </Link>
          <Link href="/studio/settings" {...cur(pathname.startsWith("/studio/settings"))}>
            ⚙ 설정
          </Link>
          <div className="chips">
            <span className={`chip ${storePersistent ? "chip-ok" : "chip-warn"}`} title="저장소 상태">
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
