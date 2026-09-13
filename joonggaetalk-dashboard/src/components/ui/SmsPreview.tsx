import type { ReactNode } from "react";
import { smsKind } from "@/lib/sms";

/**
 * 문자 미리보기 — 기본 메시지 앱 모양.
 * 알림톡 말풍선과 나란히 놓고 봐야 무엇이 빠지는지 바로 보인다.
 * 채널명 머리도, 버튼도 없다. 그래서 본문이 그 몫까지 해야 한다.
 */
export function SmsPreview({ body, sample, from }: { body: string; sample?: Record<string, string>; from?: string }) {
  const parts: ReactNode[] = [];
  const re = /#\{([^}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    const key = m[1];
    parts.push(
      <span key={i++} className="var" title={`치환변수 ${key}`}>
        {sample?.[key] ?? `#{${key}}`}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));

  return (
    <div className="sms-wrap">
      <div className="sms-meta">
        <span>{from ?? "발신번호"}</span>
        <span className="sms-kind">{smsKind(body)}</span>
      </div>
      <div className="sms-bubble">{parts.length ? parts : <span className="muted">내용을 입력하면 여기에 보입니다.</span>}</div>
    </div>
  );
}
