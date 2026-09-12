"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export type ToastTone = "good" | "danger" | "info";
export type ToastInput = { message: string; tone?: ToastTone; action?: { label: string; onClick: () => void }; duration?: number };
type ToastItem = ToastInput & { id: number };

const ToastCtx = createContext<{ toast: (t: ToastInput | string) => void } | null>(null);

/** 성공은 토스트 3초, 되돌릴 수 있는 행동은 토스트 안에 '실행 취소'. 실패·확인만 모달을 쓴다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (input: ToastInput | string) => {
      const t: ToastInput = typeof input === "string" ? { message: input } : input;
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      const ms = t.duration ?? (t.action ? 6000 : 3000);
      window.setTimeout(() => remove(id), ms);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone ?? "good"}`} role="status">
            <span className="ic">
              <Icon name={t.tone === "danger" ? "alertCircle" : t.tone === "info" ? "info" : "checkCircle"} size={18} />
            </span>
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="act"
                onClick={() => {
                  t.action?.onClick();
                  remove(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast는 ToastProvider 안에서만 쓸 수 있습니다.");
  return ctx.toast;
}
