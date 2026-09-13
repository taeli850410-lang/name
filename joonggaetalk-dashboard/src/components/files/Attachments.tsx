"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, Switch } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { Attachment } from "@/data/files";
import {
  FILE_KINDS,
  KIND_RULES,
  formatBytes,
  retentionState,
  retentionUntil,
  validateUpload,
  type FileKind,
} from "@/lib/storage";
import { formatKoDate, TODAY } from "@/lib/format";

const KIND_ICON: Record<FileKind, "file" | "shield" | "user" | "map"> = {
  계약서: "file",
  확인설명서: "file",
  등기부등본: "shield",
  신분증: "user",
  물건사진: "map",
  기타: "file",
};

/**
 * 첨부 파일 목록과 올리기.
 *
 * 파일은 이 화면에서 저장소로 바로 간다. 서버는 올릴 자리만 내주고,
 * 올라간 뒤에 앞부분을 되읽어 내용이 이름과 맞는지 다시 본다.
 */
export function Attachments({
  scope,
  ownerId,
  items,
  onChange,
}: {
  scope: Attachment["scope"];
  ownerId: string;
  items: Attachment[];
  onChange: (next: Attachment[]) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>(scope === "properties" ? "물건사진" : "계약서");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [del, setDel] = useState<Attachment | null>(null);

  const rule = KIND_RULES[kind];
  const expired = items.filter((a) => retentionState(a.kind, a.uploadedAt, TODAY) === "파기 대상");

  const pick = () => {
    setErr(null);
    fileRef.current?.click();
  };

  const upload = async (file: File) => {
    setErr(null);
    // 브라우저에서 먼저 걸러 준다. 서버도 같은 검사를 다시 한다.
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const v = validateUpload(file.name, file.size, kind, head);
    if (!v.ok) {
      setErr(v.why);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/files?action=upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, ownerId, kind, name: file.name, size: file.size }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.why || data.hint || data.message);
        return;
      }

      // 저장소로 바로 올린다 — 서버를 거치지 않으므로 크기 제한에 걸리지 않는다
      const put = await fetch(data.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) {
        setErr("저장소에 올리지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        return;
      }

      // 서버가 올라간 파일을 되읽어 내용을 확인한다
      const conf = await fetch("/api/files?action=confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: data.key, kind }),
      });
      const confirmed = await conf.json();
      if (!confirmed.ok) {
        setErr(confirmed.why || confirmed.message);
        return;
      }

      onChange([
        {
          id: `f${Date.now()}`,
          scope,
          ownerId,
          kind,
          name: data.name,
          key: data.key,
          bytes: file.size,
          uploadedAt: `${TODAY} 09:00`,
          uploadedBy: "이서연",
          sharedWithCustomer: kind === "계약서" || kind === "확인설명서",
        },
        ...items,
      ]);
      toast({ message: `${data.name} 을(를) 올렸습니다.` });
    } catch {
      setErr("올리지 못했습니다. 인터넷 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select className="select" aria-label="파일 종류" value={kind} onChange={(e) => { setKind(e.target.value as FileKind); setErr(null); }} style={{ width: 150 }}>
          {FILE_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={pick}>
          {busy ? "올리는 중…" : (<><Icon name="upload" size={14} /> 파일 선택</>)}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={rule.accept.map((e) => `.${e}`).join(",")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
        <span className="muted small">{rule.accept.join(", ")} · {formatBytes(rule.maxBytes)}까지</span>
      </div>

      <div className="help">{rule.basis}</div>

      {rule.warn && <Banner tone="warn" icon="alertTriangle" title="꼭 필요한 경우가 아니면 올리지 마세요" body={rule.warn} />}
      {err && <Banner tone="danger" title="올릴 수 없는 파일입니다" body={err} />}

      {expired.length > 0 && (
        <Banner
          tone="danger"
          title={`보존기간이 지난 파일이 ${expired.length}건 있습니다`}
          body="보존기간이 지난 개인정보는 가지고 있는 것 자체가 위반입니다. 확인하고 지워 주세요."
        />
      )}

      {items.length === 0 ? (
        <p className="muted small">아직 올린 파일이 없습니다.</p>
      ) : (
        <div className="filelist">
          {items.map((a) => {
            const state = retentionState(a.kind, a.uploadedAt, TODAY);
            const until = retentionUntil(a.kind, a.uploadedAt);
            return (
              <div key={a.id} className={`fileitem${state === "파기 대상" ? " is-expired" : ""}`}>
                <span className="fileitem__ic">
                  <Icon name={KIND_ICON[a.kind]} size={16} />
                </span>
                <span className="fileitem__body">
                  <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <b>{a.name}</b>
                    <Badge tone="outline">{a.kind}</Badge>
                    {state === "파기 대상" && <Badge tone="danger" dot>파기 대상</Badge>}
                    {a.sharedWithCustomer && <Badge tone="info">고객 공개</Badge>}
                  </span>
                  <span className="muted small">
                    {formatBytes(a.bytes)} · {a.uploadedAt} · {a.uploadedBy}
                    {/* 5년 뒤 날짜라 연도를 빼면 "8월 15일까지"가 올해로 읽힌다 — 지워도 되는 줄 안다 */}
                    {until ? ` · ${formatKoDate(until, true)}까지 보존` : " · 보존 의무 없음"}
                  </span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <a
                    className="btn btn--ghost btn--sm"
                    href={`/api/files?key=${encodeURIComponent(a.key)}`}
                    onClick={(e) => { e.preventDefault(); toast({ tone: "info", message: "저장소가 설정되면 2분간만 유효한 주소로 내려받습니다. (프로토타입)" }); }}
                  >
                    <Icon name="download" size={14} /> 받기
                  </a>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDel(a)} aria-label={`${a.name} 삭제`}>
                    <Icon name="trash" size={14} />
                  </button>
                </span>
                {!KIND_RULES[a.kind].open && (
                  <span className="fileitem__note">
                    <Switch
                      checked={a.sharedWithCustomer}
                      onChange={(v) => onChange(items.map((x) => (x.id === a.id ? { ...x, sharedWithCustomer: v } : x)))}
                      label="고객에게 보이기"
                    />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="help">
        <Icon name="lock" size={12} /> 계약서·신분증은 공개 주소에 두지 않습니다. 받을 때마다 서버가 권한을 확인하고 2분간만 사는 주소를 내줍니다.
      </p>

      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title={del ? `'${del.name}' 을(를) 지울까요?` : ""}
        description={
          del && retentionState(del.kind, del.uploadedAt, TODAY) === "보존 중"
            ? `${KIND_RULES[del.kind].basis} 아직 보존기간이 남아 있습니다. 지우면 되살릴 수 없습니다.`
            : "저장소에서 완전히 지웁니다. 되살릴 수 없습니다."
        }
        confirmLabel="삭제"
        onConfirm={() => {
          const a = del;
          setDel(null);
          if (!a) return;
          onChange(items.filter((x) => x.id !== a.id));
          toast(`'${a.name}' 을(를) 지웠습니다.`);
        }}
      />
    </div>
  );
}
