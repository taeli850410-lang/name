"use client";

import { useState } from "react";
import { PageHead, SearchBox } from "@/components/ui/Bits";
import { NoticeAccordion } from "@/components/dashboard/NoticeAccordion";
import { notices } from "@/data/notices";

export default function NoticesPage() {
  const [q, setQ] = useState("");
  const list = notices.filter((n) => n.visible && (!q || n.title.includes(q) || n.body.includes(q)));
  return (
    <div className="content--narrow" style={{ margin: 0 }}>
      <PageHead title="공지사항" desc={`읽지 않은 공지 ${notices.filter((n) => n.unread).length}건 · 등록 후 7일간 NEW 표시`} />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="제목 · 내용 검색" />
        <span className="spacer" />
        <span className="count"><b>{list.length}</b>건</span>
      </div>
      <div className="card"><NoticeAccordion items={list} /></div>
    </div>
  );
}
