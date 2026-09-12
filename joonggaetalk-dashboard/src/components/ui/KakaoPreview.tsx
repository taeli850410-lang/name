import type { ReactNode } from "react";

/** 알림톡 미리보기 — 카카오톡 말풍선 모양. 치환변수는 노란 표시로 남긴다. */
export function KakaoPreview({ body, buttons, sender = "서연공인중개사사무소", sample }: { body: string; buttons?: string[]; sender?: string; sample?: Record<string, string> }) {
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
    <div className="bubble-wrap">
      <div className="bubble">
        <div className="head">{sender}</div>
        {parts.length ? parts : <span className="muted">내용을 입력하면 여기에 보입니다.</span>}
        {buttons && buttons.length > 0 && (
          <div className="btns">
            {buttons.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
