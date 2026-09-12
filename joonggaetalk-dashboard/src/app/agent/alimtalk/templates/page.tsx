"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, EmptyState, MoreMenu, PageHead, SearchBox, type Tone } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { KakaoPreview } from "@/components/ui/KakaoPreview";
import { useToast } from "@/components/ui/Toast";
import { templates as seed, VARIABLES, type Template, type TemplateStatus } from "@/data/templates";
import { TODAY } from "@/lib/format";

const TONE: Record<TemplateStatus, Tone> = { 승인: "good", 검수중: "info", 반려: "danger" };
const BUTTONS = ["오시는길", "홈페이지", "네이버부동산", "전화하기", "관심지역 실거래가"];

export default function TemplatesPage() {
  const toast = useToast();
  const [list, setList] = useState<Template[]>(seed);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TemplateStatus | "">("");
  const [selId, setSelId] = useState<string>(seed[0].id);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [del, setDel] = useState<Template | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  const filtered = list.filter((t) => (!q || t.name.includes(q) || t.body.includes(q)) && (!status || t.status === status));
  const sel = list.find((t) => t.id === selId) ?? filtered[0];

  return (
    <>
      <PageHead
        title="알림톡 템플릿"
        desc={`승인 ${list.filter((t) => t.status === "승인").length} · 검수중 ${list.filter((t) => t.status === "검수중").length} · 반려 ${list.filter((t) => t.status === "반려").length} — 승인된 템플릿만 발송에 쓸 수 있습니다.`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "카카오 검수 상태를 새로 확인했습니다. 변경 없음." })}>
              <Icon name="refresh" size={15} /> 검수 상태 새로고침
            </button>
            <div className="rel" ref={menuRef}>
              <button type="button" className="btn btn--primary" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                <Icon name="plus" size={16} /> 템플릿 <Icon name="chevronDown" size={14} />
              </button>
              {menu && (
                <div className="menu" role="menu" style={{ minWidth: 220 }}>
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); setAddOpen(true); }}>
                    <Icon name="edit" size={15} /> 직접 작성
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); toast({ tone: "info", message: "공용 템플릿 7종 중 아직 받지 않은 템플릿이 없습니다." }); }}>
                    <Icon name="layers" size={15} /> 공용 템플릿에서 받기
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); toast({ tone: "info", message: "발송킹 계정의 승인 템플릿을 가져옵니다. (프로토타입)" }); }}>
                    <Icon name="download" size={15} /> 발송킹에서 가져오기
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="이름 또는 내용 검색" />
        <div className="chips" role="group" aria-label="검수 상태">
          {(["승인", "검수중", "반려"] as const).map((s) => (
            <button key={s} type="button" className={`chip${status === s ? " is-on" : ""}`} aria-pressed={status === s} onClick={() => setStatus(status === s ? "" : s)}>
              {s} <span className="n">{list.filter((t) => t.status === s).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="split">
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <EmptyState icon="layers" title="조건에 맞는 템플릿이 없습니다" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>템플릿</th>
                  <th>상태</th>
                  <th>쓰이는 곳</th>
                  <th>등록일</th>
                  <th className="th-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className={`is-clickable${sel?.id === t.id ? " is-selected" : ""}`} onClick={() => setSelId(t.id)}>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="cell-title">{t.name}</span>
                        {t.shared && <Badge tone="outline">공용</Badge>}
                      </div>
                      <div className="cell-sub" style={{ maxWidth: 380, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.body.replace(/\n/g, " ")}
                      </div>
                    </td>
                    <td>
                      <Badge tone={TONE[t.status]} dot>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="muted small">{t.usedBy ?? "—"}</td>
                    <td className="muted num nowrap">{t.createdAt}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button type="button" className="btn btn--sm" onClick={() => { setSelId(t.id); setEditOpen(true); }}>
                          수정
                        </button>
                        <MoreMenu
                          items={[
                            { label: "복사해서 새 템플릿", icon: "copy", onClick: () => { const c = { ...t, id: `t${Date.now()}`, name: `${t.name} (복사)`, status: "검수중" as TemplateStatus, shared: false, usedBy: undefined, createdAt: TODAY }; setList((xs) => [c, ...xs]); setSelId(c.id); toast("복사했습니다. 내용을 고친 뒤 검수를 요청하세요."); } },
                            { label: "지금 발송에 쓰기", icon: "send", onClick: () => (window.location.href = `/agent/alimtalk/send?template=${t.id}`) },
                            { label: "삭제", icon: "trash", danger: true, onClick: () => setDel(t) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card__head">
            <h2>미리보기</h2>
            {sel && (
              <Badge tone={TONE[sel.status]} dot>
                {sel.status}
              </Badge>
            )}
          </div>
          <div className="card__body stack" style={{ gap: 12 }}>
            {sel ? (
              <>
                {sel.status === "반려" && sel.rejectReason && <Banner tone="danger" title="검수 반려" body={sel.rejectReason} />}
                {sel.status === "검수중" && <Banner tone="info" title="카카오 검수 중" body="보통 1~2 영업일이 걸립니다. 승인되면 알림을 보냅니다." />}
                <KakaoPreview body={sel.body} buttons={sel.buttons} sample={{ 고객명: "박지훈", 물건명: "더샵부평 110동 103호", 계약일: "9월 30일(수)", 중도금일: "9월 25일(금)", 잔금일: "9월 30일(수)", 입주일: "10월 1일(목)", 계약만료일: "2028년 9월 30일", 중개사상호: "서연공인중개사사무소", "사무실 전화": "032-000-1234", 물건주소: "인천 부평구 십정동 630", 약속일시: "9월 14일(월) 10:00", 약속장소: "더샵부평 현장", 약속유형: "임장" }} />
                <div className="muted small">변수는 예시 값으로 치환해 보여 줍니다. 실제 발송 시 고객·계약 정보로 바뀝니다.</div>
                <div className="row row--end">
                  <button type="button" className="btn btn--sm" onClick={() => setEditOpen(true)}>
                    <Icon name="edit" size={14} /> 수정
                  </button>
                  {sel.status === "승인" && (
                    <a href={`/agent/alimtalk/send?template=${sel.id}`} className="btn btn--primary btn--sm">
                      <Icon name="send" size={14} /> 이 템플릿으로 발송
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="muted">템플릿을 선택하면 카카오톡에서 보이는 모양을 확인할 수 있습니다.</p>
            )}
          </div>
        </div>
      </div>

      <Drawer open={addOpen || editOpen} onClose={() => { setAddOpen(false); setEditOpen(false); }} title={editOpen ? "템플릿 수정" : "템플릿 작성"}>
        <TemplateForm
          initial={editOpen ? sel : undefined}
          onCancel={() => { setAddOpen(false); setEditOpen(false); }}
          onSave={(t) => {
            if (editOpen && sel) {
              setList((xs) => xs.map((x) => (x.id === sel.id ? { ...x, ...t, status: "검수중" } : x)));
              toast("수정했습니다. 내용이 바뀌어 다시 검수를 요청했습니다.");
            } else {
              const n: Template = { id: `t${Date.now()}`, name: t.name, body: t.body, buttons: t.buttons, status: "검수중", shared: false, createdAt: TODAY };
              setList((xs) => [n, ...xs]);
              setSelId(n.id);
              toast("검수를 요청했습니다. 승인되면 알림을 보냅니다.");
            }
            setAddOpen(false);
            setEditOpen(false);
          }}
        />
      </Drawer>

      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title={`'${del?.name}' 템플릿을 삭제할까요?`}
        description={del?.usedBy ? `자동발송 설정 '${del.usedBy}'에 연결되어 있습니다. 삭제하면 그 시점의 발송이 멈춥니다.` : "삭제된 템플릿은 '삭제된 템플릿 보기'에서 30일간 복구할 수 있습니다."}
        confirmLabel="삭제"
        onConfirm={() => {
          if (del) {
            const d = del;
            setList((xs) => xs.filter((t) => t.id !== d.id));
            toast({ message: `'${d.name}'을(를) 삭제했습니다.`, action: { label: "실행 취소", onClick: () => setList((xs) => [d, ...xs]) } });
          }
          setDel(null);
        }}
      />
    </>
  );
}

function TemplateForm({ initial, onSave, onCancel }: { initial?: Template; onSave: (t: { name: string; body: string; buttons: string[] }) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [buttons, setButtons] = useState<string[]>(initial?.buttons ?? []);
  const [err, setErr] = useState<Record<string, string>>({});
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (v: string) => {
    const el = ref.current;
    const token = `#{${v}}`;
    if (!el) return setBody((b) => b + token);
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  };
  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "템플릿 이름을 입력해 주세요.";
    if (body.trim().length < 10) e.body = "내용을 10자 이상 입력해 주세요.";
    if (/혜택|할인|이벤트/.test(body)) e.body = "'혜택·할인·이벤트' 같은 광고성 문구는 정보성 알림톡으로 승인되지 않습니다.";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ name: name.trim(), body, buttons });
  };

  return (
    <div className="form">
      <div className="field">
        <label className="label" htmlFor="tf-name">템플릿 이름 <span className="req">*</span></label>
        <input id="tf-name" className={`input${err.name ? " is-invalid" : ""}`} placeholder="예: 계약일 안내" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {err.name && <div className="error">{err.name}</div>}
      </div>
      <div className="field">
        <label className="label" htmlFor="tf-body">내용 <span className="req">*</span></label>
        <div className="chips">
          {VARIABLES.map((v) => (
            <button key={v} type="button" className="chip" onClick={() => insert(v)} title={`#{${v}} 넣기`}>
              + {v}
            </button>
          ))}
        </div>
        <textarea id="tf-body" ref={ref} className={`textarea${err.body ? " is-invalid" : ""}`} style={{ minHeight: 160 }} maxLength={1000} placeholder={"안녕하세요 #{고객명}님.\n계약일이 다가왔습니다."} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row row--between">
          {err.body ? <div className="error">{err.body}</div> : <span className="help">변수는 발송 시 실제 값으로 바뀝니다.</span>}
          <span className={`help num${body.length > 900 ? " error" : ""}`}>{body.length} / 1,000자</span>
        </div>
      </div>
      <div className="field">
        <span className="label">버튼 <span className="opt">카카오톡에 표시될 순서대로</span></span>
        <div className="chips">
          {BUTTONS.map((b) => (
            <button key={b} type="button" className={`chip${buttons.includes(b) ? " is-on" : ""}`} aria-pressed={buttons.includes(b)} onClick={() => setButtons(buttons.includes(b) ? buttons.filter((x) => x !== b) : [...buttons, b])}>
              {b}
            </button>
          ))}
        </div>
        <div className="help">오시는길·홈페이지·네이버부동산 버튼의 주소는 나의 정보에 저장된 값을 씁니다.</div>
      </div>
      <div>
        <div className="section-label">미리보기</div>
        <KakaoPreview body={body} buttons={buttons} />
      </div>
      <div className="row row--end">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>취소</button>
        <button type="button" className="btn btn--primary" onClick={submit}>{initial ? "저장하고 재검수 요청" : "검수 요청"}</button>
      </div>
    </div>
  );
}
