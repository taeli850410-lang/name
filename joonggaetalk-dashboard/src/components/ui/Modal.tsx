"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

/** ESC로 닫히고, 열릴 때 첫 버튼에 포커스가 간다. 배경 클릭은 닫기(위험 행동 확인은 버튼으로만). */
export function Modal({ open, title, onClose, children, footer, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>("button, [href], input, select, textarea");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " modal--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <div className="modal__head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="닫기">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

type ConfirmProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  summary?: { k: string; v: ReactNode }[];
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** 확인 모달 규칙: 제목에 대상과 수량, 요약에 결과와 비용, 주요 버튼은 동사. */
export function ConfirmModal({ open, title, description, summary, confirmLabel, cancelLabel = "취소", danger, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && <p>{description}</p>}
      {summary && (
        <div className="summary">
          {summary.map((s) => (
            <div key={s.k} style={{ display: "contents" }}>
              <span className="k">{s.k}</span>
              <span>{s.v}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
