"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge, EmptyState, PageHead } from "@/components/ui/Bits";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { adminInquiries as seed, type AdminInquiry } from "@/data/members";
import { relativeDay } from "@/lib/format";

export default function AdminInquiriesPage() {
  return (
    <Suspense>
      <AdminInquiries />
    </Suspense>
  );
}

function AdminInquiries() {
  const toast = useToast();
  const params = useSearchParams();
  const [list, setList] = useState<AdminInquiry[]>(seed);
  const [tab, setTab] = useState<"답변대기" | "답변완료">("답변대기");
  const [focus, setFocus] = useState<AdminInquiry | null>(() => seed.find((q) => q.id === params.get("focus")) ?? null);
  const [answer, setAnswer] = useState("");
  const items = list.filter((q) => q.status === tab);

  return (
    <>
      <PageHead title="문의 관리" desc="회원의 문의·제안·오류 신고입니다. 답변하면 회원의 텔레그램과 대시보드 알림으로 전달됩니다." />
      <div className="tabs" role="tablist">
        {(["답변대기", "답변완료"] as const).map((t) => (
          <button key={t} type="button" role="tab" className={`tab${tab === t ? " is-active" : ""}`} aria-selected={tab === t} onClick={() => setTab(t)}>{t} <span className="n">{list.filter((q) => q.status === t).length}</span></button>
        ))}
      </div>
      <div className="card">
        {items.length === 0 ? (
          <EmptyState icon="message" title={tab === "답변대기" ? "답변 대기 문의가 없습니다" : "답변 완료 문의가 없습니다"} />
        ) : (
          <div className="list">
            {items.map((q) => (
              <button key={q.id} type="button" className="list__item" style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => { setFocus(q); setAnswer(q.answer ?? ""); }}>
                <Badge tone={q.kind === "오류" ? "danger" : q.kind === "제안" ? "admin" : "info"}>{q.kind}</Badge>
                <span className="what">
                  <div className="t">{q.title}</div>
                  <div className="s">{q.member} · {q.office} · {relativeDay(q.createdAt)}{q.answer ? ` · 답변: ${q.answer}` : ""}</div>
                </span>
                <Badge tone={q.status === "답변완료" ? "good" : "warn"} dot>{q.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={!!focus}
        onClose={() => setFocus(null)}
        title={focus?.title}
        footer={focus && (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setFocus(null)}>닫기</button>
            <button type="button" className="btn btn--primary" disabled={answer.trim().length < 5} onClick={() => { setList((xs) => xs.map((x) => (x.id === focus.id ? { ...x, status: "답변완료", answer: answer.trim() } : x))); toast(`${focus.member} 님에게 답변을 보냈습니다.`); setFocus(null); }}>답변 보내기</button>
          </>
        )}
      >
        {focus && (
          <div className="stack" style={{ gap: 16 }}>
            <dl className="kv">
              <dt>회원</dt><dd>{focus.member} · {focus.office}</dd>
              <dt>구분</dt><dd>{focus.kind}</dd>
              <dt>등록</dt><dd>{focus.createdAt}</dd>
            </dl>
            <div className="card" style={{ boxShadow: "none" }}><div className="card__body" style={{ whiteSpace: "pre-line" }}>{focus.body || <span className="muted">내용 없음</span>}</div></div>
            {focus.kind === "오류" && <div className="banner banner--info"><span>이 회원의 최근 발송 실패는 대행사 장애(09-12 12:35~)와 일치합니다. 답변에 장애 공지 링크를 넣으세요.</span></div>}
            <div className="field">
              <label className="label" htmlFor="ans">답변</label>
              <textarea id="ans" className="textarea" style={{ minHeight: 140 }} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="회원이 바로 따라 할 수 있게 화면 이름과 순서를 적어 주세요." />
              <div className="help">답변 후 90일이 지나면 회원 화면에서 삭제될 수 있습니다.</div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
