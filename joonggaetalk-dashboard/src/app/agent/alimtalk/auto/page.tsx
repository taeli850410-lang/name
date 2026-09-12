"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHead, Switch } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { autoRules as seed, templates, type AutoRule } from "@/data/templates";

/** 자동발송 설정 — 표 하나, 저장 하나. 템플릿 없이 '사용'은 켤 수 없다. */
export default function AutoSendPage() {
  const toast = useToast();
  const [rules, setRules] = useState<AutoRule[]>(seed);
  const [saved, setSaved] = useState<AutoRule[]>(seed);
  const approved = templates.filter((t) => t.status === "승인");
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);
  const invalid = rules.filter((r) => r.enabled && !r.templateId);

  const update = (id: string, patch: Partial<AutoRule>) => setRules((xs) => xs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <>
      <PageHead
        title="자동발송 설정"
        desc="관련 시점마다 보낼 알림톡 템플릿과 발송 시점을 정합니다. 각 시점에는 템플릿을 하나만 지정할 수 있고, 사용을 끄면 그 시점의 예약이 만들어지지 않습니다."
        actions={
          <Link href="/agent/alimtalk/templates" className="btn">
            <Icon name="layers" size={15} /> 템플릿 관리
          </Link>
        }
      />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 220 }}>관련 시점</th>
              <th>발송 템플릿</th>
              <th style={{ width: 200 }}>발송 시점</th>
              <th style={{ width: 120 }}>사용</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const bad = r.enabled && !r.templateId;
              return (
                <tr key={r.id}>
                  <td>
                    <div className="cell-title">{r.trigger}</div>
                    {r.hint && <div className="cell-sub">{r.hint}</div>}
                  </td>
                  <td>
                    <select className={`select${bad ? " is-invalid" : ""}`} aria-label={`${r.trigger} 템플릿`} value={r.templateId ?? ""} onChange={(e) => update(r.id, { templateId: e.target.value || undefined })} style={{ maxWidth: 360 }}>
                      <option value="">— 템플릿 선택 —</option>
                      {approved.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {bad && <div className="error mt-8">템플릿을 먼저 선택해야 사용할 수 있습니다.</div>}
                  </td>
                  <td>
                    {r.timingOptions.length > 1 ? (
                      <select className="select" aria-label={`${r.trigger} 발송 시점`} value={r.timing} onChange={(e) => update(r.id, { timing: e.target.value })}>
                        {r.timingOptions.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone="outline">{r.timing}</Badge>
                    )}
                  </td>
                  <td>
                    <Switch checked={r.enabled} onChange={(v) => update(r.id, { enabled: v })} label={r.enabled ? "사용" : "사용 안 함"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="help mt-12">발송 시점의 09:00에 예약됩니다. 이미 예약된 발송은 바뀐 설정을 따르지 않으므로, 바꾼 뒤 발송 내역에서 예정 건을 확인하세요.</p>

      {dirty && (
        <div className="savebar" role="region" aria-label="변경 사항 저장">
          <Icon name="alertCircle" size={16} />
          <span className="s">{invalid.length ? `저장할 수 없습니다 — 템플릿이 없는 시점 ${invalid.length}개` : "저장하지 않은 변경 사항이 있습니다"}</span>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={() => setRules(saved)}>
            되돌리기
          </button>
          <button type="button" className="btn btn--primary" disabled={invalid.length > 0} onClick={() => { setSaved(rules); toast("자동발송 설정을 저장했습니다."); }}>
            저장
          </button>
        </div>
      )}
    </>
  );
}
