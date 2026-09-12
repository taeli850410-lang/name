"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, MoreMenu, PageHead, Switch } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { notices as seed, type Notice } from "@/data/notices";
import { TODAY } from "@/lib/format";

export default function AdminNoticesPage() {
  const toast = useToast();
  const [list, setList] = useState<Notice[]>(seed);
  const [edit, setEdit] = useState<Notice | null>(null);
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<Notice | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", important: false, visible: true });

  const openNew = () => { setDraft({ title: "", body: "", important: false, visible: true }); setCreating(true); };
  const openEdit = (n: Notice) => { setDraft({ title: n.title, body: n.body, important: !!n.important, visible: n.visible }); setEdit(n); };
  const save = () => {
    if (draft.title.trim().length < 2) return toast({ tone: "danger", message: "제목을 입력해 주세요." });
    if (edit) { setList((xs) => xs.map((x) => (x.id === edit.id ? { ...x, ...draft } : x))); toast("공지를 수정했습니다."); }
    else { setList((xs) => [{ id: `no${Date.now()}`, ...draft, author: "중개톡 운영팀", createdAt: TODAY, unread: true }, ...xs]); toast("공지를 등록했습니다. 7일간 NEW 표시됩니다."); }
    setEdit(null); setCreating(false);
  };

  return (
    <>
      <PageHead title="공지 관리" desc="회원 대시보드 상단과 공지사항 화면에 노출됩니다. '중요'로 표시하면 발송 화면 상단 배너에도 연결됩니다." actions={<button type="button" className="btn btn--primary" onClick={openNew}><Icon name="plus" size={16} /> 공지 작성</button>} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>제목</th><th>내용</th><th>등록일</th><th>노출</th><th className="th-right">관리</th></tr></thead>
          <tbody>
            {list.map((n) => (
              <tr key={n.id}>
                <td><div className="row" style={{ gap: 6 }}>{n.important && <Badge tone="danger">중요</Badge>}<span className="cell-title">{n.title}</span>{n.unread && <Badge tone="info">NEW</Badge>}</div></td>
                <td className="muted small" style={{ maxWidth: 380, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.body.replace(/\n/g, " ")}</td>
                <td className="num nowrap">{n.createdAt}</td>
                <td><Switch checked={n.visible} onChange={(v) => { setList((xs) => xs.map((x) => (x.id === n.id ? { ...x, visible: v } : x))); toast(v ? "노출했습니다." : "숨겼습니다."); }} label={n.visible ? "노출" : "숨김"} /></td>
                <td><div className="row-actions"><button type="button" className="btn btn--sm" onClick={() => openEdit(n)}>수정</button><MoreMenu items={[{ label: "삭제", icon: "trash", danger: true, onClick: () => setDel(n) }]} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={creating || !!edit} onClose={() => { setCreating(false); setEdit(null); }} title={edit ? "공지 수정" : "공지 작성"} footer={<><button type="button" className="btn btn--ghost" onClick={() => { setCreating(false); setEdit(null); }}>취소</button><button type="button" className="btn btn--primary" onClick={save}>{edit ? "저장" : "등록"}</button></>}>
        <div className="form">
          <div className="field"><label className="label" htmlFor="no-title">제목 <span className="req">*</span></label><input id="no-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus /></div>
          <div className="field"><label className="label" htmlFor="no-body">내용</label><textarea id="no-body" className="textarea" style={{ minHeight: 200 }} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="회원이 무엇을 해야 하는지(또는 안 해도 되는지)를 첫 줄에 쓰세요." /><div className="help">굵기·색·링크를 넣을 수 있습니다. 링크는 새 탭에서 열립니다.</div></div>
          <label className="check"><input type="checkbox" checked={draft.important} onChange={(e) => setDraft({ ...draft, important: e.target.checked })} /> 중요 공지 (장애·중단 안내 — 발송 화면 배너와 연결)</label>
          <label className="check"><input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} /> 바로 노출</label>
        </div>
      </Drawer>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} danger title={`'${del?.title}' 공지를 삭제할까요?`} description="회원 화면에서 즉시 사라집니다." confirmLabel="삭제" onConfirm={() => { if (del) { const d = del; setList((xs) => xs.filter((x) => x.id !== d.id)); toast({ message: "삭제했습니다.", action: { label: "실행 취소", onClick: () => setList((xs) => [d, ...xs]) } }); } setDel(null); }} />
    </>
  );
}
