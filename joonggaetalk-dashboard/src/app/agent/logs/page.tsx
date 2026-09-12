"use client";

import { Fragment, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, PageHead, SearchBox, type Tone } from "@/components/ui/Bits";
import { logs, type LogEntry } from "@/data/misc";
import { addDays, formatDateTime, TODAY } from "@/lib/format";

const TONE: Record<LogEntry["action"], Tone> = { 등록: "good", 수정: "info", 삭제: "danger", 발송: "admin", 설정: "neutral", 로그인: "outline" };

/** 작업 로그 — 대량 작업은 한 줄로 묶고 펼쳐서 본다. */
export default function LogsPage() {
  const [q, setQ] = useState("");
  const [days, setDays] = useState(7);
  const [action, setAction] = useState<LogEntry["action"] | "">("");
  const [target, setTarget] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const since = addDays(TODAY, -days);
  const filtered = useMemo(() => logs.filter((l) => l.at.slice(0, 10) >= since && (!action || l.action === action) && (!target || l.target === target) && (!q || l.summary.includes(q))), [since, action, target, q]);

  return (
    <>
      <PageHead title="작업 로그" desc="계정에서 일어난 등록·수정·삭제·발송·설정 변경이 자동 기록됩니다. 보관 기간은 90일입니다." />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="메모에 포함된 단어" />
        <div className="chips" role="group" aria-label="기간">
          {[1, 7, 14, 30].map((d) => (
            <button key={d} type="button" className={`chip${days === d ? " is-on" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d === 1 ? "오늘" : `${d}일`}</button>
          ))}
        </div>
        <select className="select" style={{ width: 130 }} aria-label="분류" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">분류 전체</option>
          {["고객", "물건", "계약", "약속", "알림톡", "자동발송", "계정"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="select" style={{ width: 130 }} aria-label="행위" value={action} onChange={(e) => setAction(e.target.value as LogEntry["action"] | "")}>
          <option value="">행위 전체</option>
          {["등록", "수정", "삭제", "발송", "설정", "로그인"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <span className="spacer" />
        <span className="count"><b>{filtered.length}</b>건</span>
      </div>
      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState icon="list" title="기록이 없습니다" desc="기간을 늘리거나 필터를 바꿔 보세요." />
        ) : (
          <table className="table table--dense">
            <thead><tr><th style={{ width: 36 }}></th><th>시각</th><th>행위</th><th>분류</th><th>내용</th></tr></thead>
            <tbody>
              {filtered.map((l) => {
                const isOpen = open.has(l.id);
                return (
                  <Fragment key={l.id}>
                    <tr className={l.details ? "is-clickable" : ""} onClick={() => l.details && setOpen((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}>
                      <td>{l.details && <Icon name="chevronRight" size={16} className="faint" style={{ transform: isOpen ? "rotate(90deg)" : undefined }} />}</td>
                      <td className="num nowrap">{formatDateTime(l.at)}</td>
                      <td><Badge tone={TONE[l.action]}>{l.action}</Badge></td>
                      <td className="muted">{l.target}</td>
                      <td>
                        {l.summary}
                        {l.count && <Badge tone="outline">{l.count}건 묶음</Badge>}
                        <span className="muted small"> · {l.actor}</span>
                      </td>
                    </tr>
                    {isOpen && l.details && (
                      <tr className="expand-row"><td colSpan={5}><ul style={{ listStyle: "disc", paddingLeft: 18 }} className="small">{l.details.map((d, i) => <li key={i}>{d}</li>)}</ul></td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
