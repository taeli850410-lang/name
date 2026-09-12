"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

type Props = { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode };

/** 우측 슬라이드 패널 — 목록 위 공간을 쓰지 않고 상세·등록 폼을 연다. */
export function Drawer({ open, title, onClose, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer__head">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="닫기">
            <Icon name="x" />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </aside>
    </>
  );
}
