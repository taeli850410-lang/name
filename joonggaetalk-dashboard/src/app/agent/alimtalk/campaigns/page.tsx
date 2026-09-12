"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Banner, EmptyState, MoreMenu, PageHead, Switch } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { campaigns as seed, templates, templateById, type Campaign } from "@/data/templates";
import { systemStatus } from "@/data/system";
import { formatDateTime, formatWon } from "@/lib/format";

export default function CampaignsPage() {
  const toast = useToast();
  const [list, setList] = useState<Campaign[]>(seed);
  const [runNow, setRunNow] = useState<Campaign | null>(null);
  const [del, setDel] = useState<Campaign | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const vendorDown = systemStatus.balsongking.status !== "ok";

  return (
    <>
      <PageHead
        title="정기 발송"
        desc="매주·매월·N일마다 조건에 맞는 고객에게 자동으로 보냅니다. 수신을 거부한 고객은 자동으로 제외됩니다."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={16} /> 정기 발송 등록
          </button>
        }
      />
      {vendorDown && <div className="mb-16"><Banner tone="warn" title="대행사 장애로 지금 보내면 실패합니다" body="예약된 정기 발송은 복구 후 자동으로 나갑니다. '지금 보내기'는 복구 뒤에 쓰세요." /></div>}

      <div className="table-wrap">
        {list.length === 0 ? (
          <EmptyState icon="repeat" title="등록된 정기 발송이 없습니다" desc="관심지역 실거래가처럼 주기적으로 보낼 내용을 등록해 두면 매번 고르지 않아도 됩니다." actions={<button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>정기 발송 등록</button>} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>템플릿</th>
                <th>주기</th>
                <th className="th-right">대상</th>
                <th>다음 발송</th>
                <th>사용</th>
                <th className="th-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="cell-title">{c.name}</td>
                  <td>
                    <Link href="/agent/alimtalk/templates" className="link">
                      {templateById(c.templateId)?.name}
                    </Link>
                  </td>
                  <td className="nowrap">{c.schedule}</td>
                  <td className="td-num nowrap">
                    {c.targets}명 <span className="muted small">· 거부 {c.optOut}</span>
                  </td>
                  <td className="num nowrap">
                    {c.enabled ? formatDateTime(c.nextRun) : <span className="muted">—</span>}
                    {c.lastRun && <div className="cell-sub">마지막 {formatDateTime(c.lastRun)}</div>}
                  </td>
                  <td>
                    <Switch checked={c.enabled} onChange={(v) => { setList((xs) => xs.map((x) => (x.id === c.id ? { ...x, enabled: v } : x))); toast(v ? `'${c.name}'을(를) 켰습니다. 다음 발송 ${formatDateTime(c.nextRun)}` : `'${c.name}'을(를) 껐습니다. 예약이 취소됩니다.`); }} label={c.enabled ? "켜짐" : "꺼짐"} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn--sm" onClick={() => toast({ tone: "info", message: "정기 발송 수정 (프로토타입)" })}>
                        수정
                      </button>
                      <MoreMenu items={[{ label: "지금 한 번 보내기", icon: "play", onClick: () => setRunNow(c) }, { label: "발송 내역 보기", icon: "clock", onClick: () => (window.location.href = "/agent/alimtalk/history") }, { label: "삭제", icon: "trash", danger: true, onClick: () => setDel(c) }]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!runNow}
        onClose={() => setRunNow(null)}
        title={`'${runNow?.name}'을(를) 지금 한 번 보냅니다`}
        description="정기 일정과 별개로 지금 대상 전원에게 발송합니다. 5분 뒤 발송으로 예약되며 그 안에 취소할 수 있습니다."
        summary={runNow ? [{ k: "템플릿", v: templateById(runNow.templateId)?.name }, { k: "대상", v: `${runNow.targets - runNow.optOut}명 (거부 ${runNow.optOut}명 제외)` }, { k: "예상 비용", v: formatWon((runNow.targets - runNow.optOut) * 6.5) }, { k: "발송 시점", v: "5분 뒤" }] : undefined}
        confirmLabel={runNow ? `${runNow.targets - runNow.optOut}명에게 5분 뒤 발송` : "발송"}
        onConfirm={() => { const c = runNow; setRunNow(null); if (c) toast({ message: `'${c.name}' ${c.targets - c.optOut}명 · 5분 뒤 발송 예약`, action: { label: "발송 취소", onClick: () => toast({ tone: "info", message: "예약을 취소했습니다." }) } }); }}
      />
      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title={`'${del?.name}' 정기 발송을 삭제할까요?`}
        description="다음 발송 예약이 취소되고, 지난 발송 내역은 남습니다."
        confirmLabel="삭제"
        onConfirm={() => { if (del) { const d = del; setList((xs) => xs.filter((x) => x.id !== d.id)); toast({ message: `'${d.name}'을(를) 삭제했습니다.`, action: { label: "실행 취소", onClick: () => setList((xs) => [...xs, d]) } }); } setDel(null); }}
      />

      <Drawer open={newOpen} onClose={() => setNewOpen(false)} title="정기 발송 등록">
        <NewCampaign onCancel={() => setNewOpen(false)} onSave={(c) => { setList((xs) => [...xs, c]); setNewOpen(false); toast(`'${c.name}'을(를) 등록했습니다. 다음 발송 ${formatDateTime(c.nextRun)}`); }} />
      </Drawer>
    </>
  );
}

function NewCampaign({ onSave, onCancel }: { onSave: (c: Campaign) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [period, setPeriod] = useState<"매주" | "매월" | "N일">("매주");
  const [dow, setDow] = useState("월요일");
  const [dom, setDom] = useState("1");
  const [n, setN] = useState("14");
  const [time, setTime] = useState("09:00");
  const [err, setErr] = useState<Record<string, string>>({});
  const approved = templates.filter((t) => t.status === "승인");
  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "이름을 입력해 주세요.";
    if (!templateId) e.t = "템플릿을 선택해 주세요.";
    setErr(e);
    if (Object.keys(e).length) return;
    const schedule = period === "매주" ? `매주 ${dow} ${time}` : period === "매월" ? `매월 ${dom}일 ${time}` : `${n}일마다 ${time}`;
    onSave({ id: `cp${Date.now()}`, name: name.trim(), templateId, schedule, targets: 188, optOut: 6, nextRun: `2026-09-14 ${time}`, enabled: true });
  };
  return (
    <div className="form">
      <div className="field">
        <label className="label" htmlFor="nc-name">이름 <span className="req">*</span></label>
        <input id="nc-name" className={`input${err.name ? " is-invalid" : ""}`} placeholder="예: 매주 시세 안내" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {err.name && <div className="error">{err.name}</div>}
      </div>
      <div className="field">
        <label className="label" htmlFor="nc-t">템플릿 <span className="req">*</span></label>
        <select id="nc-t" className={`select${err.t ? " is-invalid" : ""}`} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">승인된 템플릿 중 선택</option>
          {approved.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {err.t && <div className="error">{err.t}</div>}
      </div>
      <div className="field">
        <span className="label">주기</span>
        <div className="seg">
          {(["매주", "매월", "N일"] as const).map((p) => (
            <button key={p} type="button" className={period === p ? "is-active" : ""} onClick={() => setPeriod(p)}>{p === "N일" ? "N일마다" : p}</button>
          ))}
        </div>
      </div>
      <div className="form-grid-2">
        {period === "매주" && (
          <div className="field">
            <label className="label" htmlFor="nc-dow">요일</label>
            <select id="nc-dow" className="select" value={dow} onChange={(e) => setDow(e.target.value)}>
              {["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        )}
        {period === "매월" && (
          <div className="field">
            <label className="label" htmlFor="nc-dom">날짜</label>
            <select id="nc-dom" className="select" value={dom} onChange={(e) => setDom(e.target.value)}>
              {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        )}
        {period === "N일" && (
          <div className="field">
            <label className="label" htmlFor="nc-n">간격(일)</label>
            <input id="nc-n" className="input" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="nc-time">시간</label>
          <input id="nc-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="card" style={{ boxShadow: "none" }}>
        <div className="card__body small">
          <div className="strong mb-8">대상</div>
          알림톡 수신에 동의한 고객 전체 <b>182명</b> (거부 6명 제외). 조건을 좁히려면 저장 후 '수정'에서 관심유형·지역 필터를 추가하세요.
        </div>
      </div>
      <div className="row row--end">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>취소</button>
        <button type="button" className="btn btn--primary" onClick={submit}>등록</button>
      </div>
    </div>
  );
}
