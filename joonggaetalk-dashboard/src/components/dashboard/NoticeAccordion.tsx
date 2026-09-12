"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Bits";
import type { Notice } from "@/data/notices";

export function NoticeAccordion({ items }: { items: Notice[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="acc">
      {items.map((n) => (
        <div key={n.id} className={`acc__item${open === n.id ? " is-open" : ""}`}>
          <button type="button" className="acc__btn" aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? null : n.id)}>
            <span className="chev">
              <Icon name="chevronRight" size={16} />
            </span>
            {n.important && <Badge tone="danger">중요</Badge>}
            <span>{n.title}</span>
            {n.unread && <Badge tone="info">NEW</Badge>}
            <span className="meta">
              {n.author} · {n.createdAt}
            </span>
          </button>
          {open === n.id && <div className="acc__body">{n.body}</div>}
        </div>
      ))}
    </div>
  );
}
