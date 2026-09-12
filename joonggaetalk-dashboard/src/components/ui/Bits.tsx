"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* 배지 — 상태 색은 아이콘·라벨과 함께, 0은 중립 */
export type Tone = "good" | "warn" | "danger" | "info" | "neutral" | "admin" | "outline";
export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <i className="bdot" />}
      {children}
    </span>
  );
}

/* 페이지 머리 */
export function PageHead({ title, desc, actions, help }: { title: string; desc?: ReactNode; actions?: ReactNode; help?: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>
          {title}
          {help && (
            <span className="help" title={help} aria-label={help}>
              ?
            </span>
          )}
        </h1>
        {desc && <p className="desc">{desc}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/* 통계 타일 */
export function StatTile({
  label,
  value,
  unit,
  sub,
  tone,
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: "danger" | "warn" | "good" | "brand" | "admin";
  href?: string;
  icon?: IconName;
}) {
  const body = (
    <>
      <div className="tile__label">
        {icon && <Icon name={icon} size={15} />}
        {label}
      </div>
      <div className="tile__value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="tile__sub">{sub}</div>}
      {href && (
        <span className="tile__arrow">
          <Icon name="chevronRight" size={16} />
        </span>
      )}
    </>
  );
  const cls = `tile${tone ? ` tile--${tone}` : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* 빈 상태 — 아이콘 + 한 문장 + 주요 행동 + 관련 설정 링크 */
export function EmptyState({ icon = "info", title, desc, actions }: { icon?: IconName; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic">
        <Icon name={icon} size={22} />
      </div>
      <div className="t">{title}</div>
      {desc && <div className="d">{desc}</div>}
      {actions && <div className="acts">{actions}</div>}
    </div>
  );
}

/* 페이지네이션 — 한 벌: 전체 n건 · 페이지당 · ‹ 1 2 3 … n › */
export function Pager({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, pages);
  const nums: (number | "…")[] = [];
  const push = (n: number | "…") => nums.push(n);
  if (pages <= 7) for (let i = 1; i <= pages; i++) push(i);
  else {
    push(1);
    if (cur > 3) push("…");
    for (let i = Math.max(2, cur - 1); i <= Math.min(pages - 1, cur + 1); i++) push(i);
    if (cur < pages - 2) push("…");
    push(pages);
  }
  const from = total === 0 ? 0 : (cur - 1) * pageSize + 1;
  const to = Math.min(total, cur * pageSize);
  return (
    <div className="pager">
      <div className="count">
        전체 <b className="num">{total.toLocaleString("en-US")}</b>건 · {from}–{to}
      </div>
      <div className="pager__pages">
        {onPageSize && (
          <select aria-label="페이지당 개수" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}개씩
              </option>
            ))}
          </select>
        )}
        <button type="button" className="pager__btn" disabled={cur <= 1} onClick={() => onPage(cur - 1)} aria-label="이전 페이지">
          <Icon name="chevronLeft" size={16} />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="pager__btn" aria-hidden>
              …
            </span>
          ) : (
            <button key={n} type="button" className={`pager__btn${n === cur ? " is-active" : ""}`} onClick={() => onPage(n)} aria-current={n === cur ? "page" : undefined}>
              {n}
            </button>
          ),
        )}
        <button type="button" className="pager__btn" disabled={cur >= pages} onClick={() => onPage(cur + 1)} aria-label="다음 페이지">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

/* 토글 스위치 — 상태와 행동을 하나로 */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="track" />
      {label && <span>{label}</span>}
    </label>
  );
}

/* 더보기 메뉴 — 위험 행동은 여기로 */
export function MoreMenu({ items, label = "더보기" }: { items: { label: string; icon?: IconName; danger?: boolean; onClick: () => void }[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="rel" ref={ref}>
      <button type="button" className="btn btn--ghost btn--sm btn--icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={it.danger ? "danger" : ""}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon && <Icon name={it.icon} size={15} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* 검색 입력 */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" className="iconbtn" style={{ width: 24, height: 24 }} onClick={() => onChange("")} aria-label="지우기">
          <Icon name="x" size={14} />
        </button>
      )}
    </label>
  );
}

/* 페이지 상단 상태 배너 */
export function Banner({ tone, title, body, actions, icon }: { tone: "danger" | "warn" | "info" | "good"; title: string; body?: ReactNode; actions?: ReactNode; icon?: IconName }) {
  const ic: IconName = icon ?? (tone === "danger" ? "alertTriangle" : tone === "warn" ? "alertCircle" : tone === "good" ? "checkCircle" : "info");
  return (
    <div className={`banner banner--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon name={ic} size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="t">{title}</div>
        {body && <div className="b">{body}</div>}
      </div>
      {actions && <div className="act">{actions}</div>}
    </div>
  );
}

/* 키워드 칩 */
export function Kw({ color, children }: { color: string; children: ReactNode }) {
  return <span className={`kw kw--${color}`}>{children}</span>;
}
