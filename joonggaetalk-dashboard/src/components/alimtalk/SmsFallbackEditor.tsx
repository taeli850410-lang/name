"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, Switch } from "@/components/ui/Bits";
import { SmsPreview } from "@/components/ui/SmsPreview";
import {
  ALIMTALK_COST,
  fromAlimtalk,
  headroom,
  isOverLimit,
  LMS_LIMIT,
  missingVars,
  renderVars,
  SMS_COST,
  SMS_LIMIT,
  smsBytes,
  smsKind,
  unsupportedChars,
  usedVars,
} from "@/lib/sms";
import type { Template } from "@/data/templates";
import { formatPhone, formatWon } from "@/lib/format";

/**
 * 대체 문자 편집기.
 *
 * 여기서 정해야 하는 건 문구가 아니라 세 가지 사실이다.
 *   - 지금 길이가 SMS(20원)인가 LMS(50원)인가 — 알림톡은 6.5원이다
 *   - 문자로는 무엇이 사라지는가 (채널명·버튼)
 *   - 변수가 다 채워지는가 — 문자는 카카오 검수가 안 봐 준다
 */
export function SmsFallbackEditor({
  template,
  sender,
  senderNumber,
  links,
  sample,
  onChange,
}: {
  template: Template;
  sender: string;
  senderNumber: string;
  links?: Record<string, string>;
  sample: Record<string, string>;
  onChange: (sms: { enabled: boolean; body: string }) => void;
}) {
  const sms = template.sms ?? { enabled: false, body: "" };
  const [draftOpen, setDraftOpen] = useState(false);

  const rendered = useMemo(() => renderVars(sms.body, sample), [sms.body, sample]);
  const bytes = smsBytes(rendered);
  const kind = smsKind(rendered);
  const over = isOverLimit(rendered);
  const left = headroom(rendered);
  const bad = unsupportedChars(sms.body);
  // 알림톡 본문에 없는 변수는 발송 때 채울 값이 없다 — 그대로 고객에게 간다
  const orphanVars = usedVars(sms.body).filter((v) => !usedVars(template.body).includes(v) && sample[v] === undefined);
  const unfilled = missingVars(sms.body, sample);

  const draft = useMemo(() => fromAlimtalk(template.body, { sender, buttons: template.buttons, links }), [template.body, template.buttons, sender, links]);

  const pct = Math.min(100, (bytes / (kind === "SMS" ? SMS_LIMIT : LMS_LIMIT)) * 100);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div className="row" style={{ gap: 6 }}>
            <b>대체 문자</b>
            {sms.enabled ? <Badge tone="good" dot>켜짐</Badge> : <Badge tone="neutral">꺼짐</Badge>}
          </div>
          <div className="help">카카오톡으로 못 받는 고객에게 이 문구가 문자로 나갑니다. 카카오 검수 없이 바로 고칠 수 있습니다.</div>
        </div>
        <Switch
          checked={sms.enabled}
          disabled={!sms.body.trim() || over}
          onChange={(v) => onChange({ ...sms, enabled: v })}
          label="대체발송"
        />
      </div>

      {!sms.body.trim() ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="help">
            아직 대체 문구가 없습니다. 이 템플릿이 카카오톡으로 안 꽂히면 그 고객은 아무것도 못 받습니다.
          </p>
          <div className="row">
            <button type="button" className="btn btn--sm" onClick={() => { onChange({ enabled: false, body: draft.text }); setDraftOpen(true); }}>
              <Icon name="copy" size={14} /> 알림톡 본문에서 초안 만들기
            </button>
          </div>
        </div>
      ) : null}

      <textarea
        className="textarea"
        rows={6}
        aria-label="대체 문자 본문"
        placeholder="카카오톡으로 못 받는 고객에게 나갈 문구"
        value={sms.body}
        onChange={(e) => onChange({ ...sms, body: e.target.value })}
      />

      <div className="stack" style={{ gap: 6 }}>
        <div className={`bytebar${over ? " is-over" : kind === "LMS" ? " is-lms" : ""}`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="row small" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className={over ? "danger" : undefined}>
            <b className="num">{bytes}</b>
            <span className="muted"> / {kind === "SMS" ? SMS_LIMIT : LMS_LIMIT}바이트 · </span>
            <b>{kind}</b>
            <span className="muted"> {formatWon(SMS_COST[kind])}</span>
          </span>
          <span className="muted">
            {over
              ? `LMS 한도를 ${bytes - LMS_LIMIT}바이트 넘겼습니다`
              : kind === "SMS"
                ? `SMS 한도까지 ${left}바이트 남음 (한글 ${Math.floor(left / 2)}자)`
                : `한글 ${Math.floor((LMS_LIMIT - bytes) / 2)}자 더 쓸 수 있음`}
          </span>
        </div>
        <div className="help">
          한글은 한 글자가 2바이트라 90바이트면 45자입니다. 변수가 채워지면 길이가 달라지므로 위 숫자는 예시 값으로 잰 것입니다.
        </div>
      </div>

      {over && <Banner tone="danger" title="이대로는 보낼 수 없습니다" body={`LMS 한도 ${LMS_LIMIT}바이트를 넘었습니다. 문구를 줄이거나 링크를 빼 주세요.`} />}

      {kind === "LMS" && !over && (
        <Banner
          tone="info"
          title={`SMS 한도를 넘어 LMS로 나갑니다 — 건당 ${formatWon(SMS_COST.LMS)}`}
          body={`알림톡 ${ALIMTALK_COST}원의 약 ${Math.round((SMS_COST.LMS / ALIMTALK_COST) * 10) / 10}배입니다. ${Math.ceil((bytes - SMS_LIMIT) / 2)}자를 줄이면 SMS(${formatWon(SMS_COST.SMS)})로 내려갑니다.`}
        />
      )}

      {bad.length > 0 && (
        <Banner
          tone="warn"
          title={`문자로 보낼 수 없는 글자가 있습니다 — ${bad.join(" ")}`}
          body="이모지는 문자 표준(EUC-KR)에 없어 깨져 나가거나 MMS로 바뀝니다. 지워 주세요."
        />
      )}

      {orphanVars.length > 0 && (
        <Banner
          tone="danger"
          title={`알림톡 본문에 없는 변수입니다 — ${orphanVars.map((v) => `#{${v}}`).join(" ")}`}
          body="발송할 때 채울 값이 없어 이 글자 그대로 고객에게 갑니다. 알림톡 본문에도 쓰는 변수만 써 주세요."
        />
      )}

      {unfilled.length > 0 && orphanVars.length === 0 && (
        <p className="help">미리보기에 예시 값이 없는 변수: {unfilled.map((v) => `#{${v}}`).join(", ")} — 발송 시에는 실제 값으로 채워집니다.</p>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <span className="section-label">문자로 받으면 이렇게 보입니다</span>
        <SmsPreview body={sms.body} sample={sample} from={formatPhone(senderNumber)} />
        <div className="help">
          알림톡에 있고 문자에 없는 것: <b>채널명 머리</b>{template.buttons.length > 0 ? <> · <b>버튼 {template.buttons.join("·")}</b></> : null}. 그래서 본문이 보낸 사람을 직접 밝혀야 합니다.
        </div>
      </div>

      {draftOpen && draft.droppedButtons.length > 0 && (
        <Banner
          tone="warn"
          title={`초안으로 옮기지 못한 버튼: ${draft.droppedButtons.join(", ")}`}
          body="주소가 없는 버튼은 문자로 옮길 수 없습니다. 필요하면 본문에 직접 안내를 적어 주세요."
        />
      )}
    </div>
  );
}
