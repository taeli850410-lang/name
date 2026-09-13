"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHead } from "@/components/ui/Bits";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { myInquiries, type Inquiry } from "@/data/notices";
import { TODAY } from "@/lib/format";

export default function InquiriesPage() {
  const toast = useToast();
  const [list, setList] = useState<Inquiry[]>(myInquiries);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Inquiry["kind"]>("문의");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (title.trim().length < 2) return setErr("제목을 입력해 주세요.");
    setList((xs) => [{ id: `q${Date.now()}`, kind, title: title.trim(), body, status: "답변대기", createdAt: TODAY, updatedAt: TODAY }, ...xs]);
    setOpen(false);
    setTitle("");
    setBody("");
    setErr("");
    toast("접수했습니다. 답변이 오면 대시보드 알림으로 알려 드립니다.");
  };

  return (
    <div className="content--narrow" style={{ margin: 0 }}>
      <PageHead
        title="문의/제안"
        desc="잘 안 되는 부분은 화면 캡처와 함께 남겨 주세요. 답변이 완료된 건은 90일 뒤 삭제됩니다. 원격 지원이 필요하면 문의 작성 시 '원격 지원 요청'을 고르세요."
        actions={<button type="button" className="btn btn--primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> 새 문의/제안</button>}
      />
      <div className="card">
        <div className="list">
          {list.map((q) => (
            <div key={q.id} className="list__item" style={{ alignItems: "flex-start" }}>
              <Badge tone={q.kind === "오류" ? "danger" : q.kind === "제안" ? "admin" : "info"}>{q.kind}</Badge>
              <span className="what">
                <div className="t">{q.title}</div>
                {q.answer ? <div className="s" style={{ whiteSpace: "normal" }}>답변: {q.answer}</div> : <div className="s">{q.body || "내용 없음"}</div>}
                <div className="faint small">등록 {q.createdAt} · 최근 활동 {q.updatedAt}</div>
              </span>
              <Badge tone={q.status === "답변완료" ? "good" : "warn"} dot>{q.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="새 문의/제안" footer={<><button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>취소</button><button type="button" className="btn btn--primary" onClick={submit}>접수</button></>}>
        <div className="form">
          <div className="field">
            <span className="label">구분</span>
            <div className="seg">
              {(["문의", "제안", "오류"] as const).map((k) => <button key={k} type="button" className={kind === k ? "is-active" : ""} onClick={() => setKind(k)}>{k}</button>)}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="iq-title">제목 <span className="req">*</span></label>
            <input id="iq-title" className={`input${err ? " is-invalid" : ""}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 발송 내역에서 실패 건만 다시 보내고 싶습니다" />
            {err && <div className="error">{err}</div>}
          </div>
          <div className="field">
            <label className="label" htmlFor="iq-body">내용</label>
            <textarea id="iq-body" className="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="어떤 화면에서, 무엇을 했을 때, 어떻게 됐는지" />
          </div>
          <div className="row">
            <button type="button" className="btn btn--sm" onClick={() => toast({ tone: "info", message: "캡처 첨부 (프로토타입)" })}><Icon name="upload" size={14} /> 화면 캡처 첨부</button>
            <label className="check"><input type="checkbox" /> 원격 지원 요청 (RustDesk ID를 함께 남겨 주세요)</label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
