"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { DOW_KO, formatKoDate, pad2, TODAY } from "@/lib/format";

export type CalEvent = { date: string; kind: "appt" | "deal" | "send"; title: string; sub?: string; href: string };

const KIND_LABEL = { appt: "약속", deal: "계약 일정", send: "발송" } as const;

/** 일정·계약·발송을 한 캘린더에. 점 대신 건수를 세고, 날짜를 누르면 아래에 목록이 뜬다. */
export function MonthCalendar({ events, initialSelected = TODAY }: { events: CalEvent[]; initialSelected?: string }) {
  const [ym, setYm] = useState(() => initialSelected.slice(0, 7));
  const [sel, setSel] = useState<string | null>(initialSelected);
  const [y, m] = ym.split("-").map(Number);

  const cells = useMemo(() => {
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const out: { iso: string; inMonth: boolean; d: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({ iso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, inMonth: d.getMonth() === m - 1, d: d.getDate() });
      if (i >= 34 && d.getMonth() !== m - 1 && (i + 1) % 7 === 0) break;
    }
    return out;
  }, [y, m]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    events.forEach((e) => map.set(e.date, [...(map.get(e.date) ?? []), e]));
    return map;
  }, [events]);

  const move = (d: number) => {
    const nd = new Date(y, m - 1 + d, 1);
    setYm(`${nd.getFullYear()}-${pad2(nd.getMonth() + 1)}`);
  };
  const selEvents = sel ? byDate.get(sel) ?? [] : [];

  return (
    <div className="cal">
      <div className="cal__head">
        <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => move(-1)} aria-label="이전 달">
          <Icon name="chevronLeft" size={16} />
        </button>
        <h3>
          {y}년 {m}월
        </h3>
        <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => move(1)} aria-label="다음 달">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
      <div className="cal__grid" role="grid">
        {DOW_KO.map((d) => (
          <div key={d} className="cal__dow" role="columnheader">
            {d}
          </div>
        ))}
        {cells.map((c) => {
          const evs = byDate.get(c.iso) ?? [];
          const kinds = Array.from(new Set(evs.map((e) => e.kind)));
          return (
            <button
              key={c.iso}
              type="button"
              role="gridcell"
              className={`cal__day${c.inMonth ? "" : " is-other"}${c.iso === TODAY ? " is-today" : ""}${c.iso === sel ? " is-sel" : ""}`}
              onClick={() => setSel(c.iso)}
              aria-label={`${c.iso} 일정 ${evs.length}건`}
              aria-pressed={c.iso === sel}
            >
              {c.d}
              <span className="cal__marks">
                {kinds.map((k) => (
                  <i key={k} className={`m-${k}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="cal__legend">
        <span>
          <i style={{ background: "var(--warn)" }} />
          약속
        </span>
        <span>
          <i style={{ background: "var(--brand)" }} />
          계약 일정
        </span>
        <span>
          <i style={{ background: "var(--good)" }} />
          발송
        </span>
      </div>
      {sel && (
        <div className="cal__detail">
          <div className="strong">
            {formatKoDate(sel)} <span className="muted">· {selEvents.length}건</span>
          </div>
          {selEvents.length === 0 && <div className="muted">등록된 일정이 없습니다.</div>}
          {selEvents.map((e, i) => (
            <Link key={i} href={e.href} className="row-i link" style={{ color: "inherit" }}>
              <i style={{ background: e.kind === "appt" ? "var(--warn)" : e.kind === "deal" ? "var(--brand)" : "var(--good)" }} />
              <span className="grow">
                <span className="strong">{e.title}</span>
                {e.sub && <span className="muted"> · {e.sub}</span>}
              </span>
              <span className="faint small">{KIND_LABEL[e.kind]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
