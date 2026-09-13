"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, StatTile } from "@/components/ui/Bits";

/**
 * 외부 연동이 실제로 설정돼 있는지 서버에 물어본다.
 *
 * 예전에는 이 자리에 "4/4 정상"이 글자로 박혀 있었다. 연동을 붙여도 숫자가
 * 그대로라, 키가 하나도 없는 상태에서도 운영자 화면은 초록불이었다.
 * 모니터가 거짓말을 하면 안 보느니만 못하다.
 */
export type Integration = {
  key: string;
  label: string;
  /** GET 했을 때 { configured: boolean } 을 돌려주는 주소 */
  endpoint: string;
  /** 설정에 필요한 환경 변수 — 미설정일 때 그대로 보여 준다 */
  env: string;
};

export const INTEGRATIONS: Integration[] = [
  { key: "bldrgst", label: "건축물대장", endpoint: "/api/building-register", env: "DATA_GO_KR_API_KEY" },
  { key: "vworld", label: "주소·필지 (VWorld)", endpoint: "/api/vworld", env: "VWORLD_API_KEY" },
  { key: "billing", label: "정기결제", endpoint: "/api/billing", env: "PORTONE_API_SECRET 또는 TOSS_SECRET_KEY" },
  { key: "files", label: "첨부 파일 저장소", endpoint: "/api/files", env: "S3_ENDPOINT · S3_BUCKET · S3_ACCESS_KEY_ID · S3_SECRET_ACCESS_KEY" },
];

/** 확인 전 · 설정됨 · 미설정 · 확인 실패를 구분한다. "모름"을 "정상"으로 뭉개지 않는다. */
export type ProbeState = "checking" | "on" | "off" | "error";

export function useIntegrationProbe() {
  const [state, setState] = useState<Record<string, ProbeState>>(() =>
    Object.fromEntries(INTEGRATIONS.map((i) => [i.key, "checking" as ProbeState])),
  );
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const probe = useCallback(async () => {
    setState(Object.fromEntries(INTEGRATIONS.map((i) => [i.key, "checking" as ProbeState])));
    const results = await Promise.all(
      INTEGRATIONS.map(async (i): Promise<[string, ProbeState]> => {
        try {
          const res = await fetch(i.endpoint, { cache: "no-store" });
          if (!res.ok) return [i.key, "error"];
          const data = (await res.json()) as { configured?: boolean };
          return [i.key, data.configured ? "on" : "off"];
        } catch {
          return [i.key, "error"];
        }
      }),
    );
    setState(Object.fromEntries(results));
    setCheckedAt(new Date().toTimeString().slice(0, 5));
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const on = INTEGRATIONS.filter((i) => state[i.key] === "on").length;
  const checking = INTEGRATIONS.some((i) => state[i.key] === "checking");
  const failed = INTEGRATIONS.filter((i) => state[i.key] === "error").length;

  return { state, checkedAt, probe, on, checking, failed, total: INTEGRATIONS.length };
}

export function IntegrationTile({ probe }: { probe: ReturnType<typeof useIntegrationProbe> }) {
  const { on, total, checking, failed, checkedAt } = probe;
  return (
    <StatTile
      label="외부 API"
      icon="globe"
      value={checking ? "확인 중" : `${on}/${total}`}
      tone={checking ? undefined : failed ? "danger" : on === total ? "good" : "warn"}
      sub={
        checking
          ? "연동 상태를 확인하고 있습니다"
          : on === 0
            ? "인증키가 하나도 설정되지 않았습니다"
            : `설정 ${on} · 미설정 ${total - on - failed}${failed ? ` · 확인 실패 ${failed}` : ""}${checkedAt ? ` · 확인 ${checkedAt}` : ""}`
      }
    />
  );
}

const TONE: Record<ProbeState, "good" | "neutral" | "danger" | "warn"> = {
  on: "good",
  off: "neutral",
  error: "danger",
  checking: "warn",
};
const TEXT: Record<ProbeState, string> = { on: "설정됨", off: "미설정", error: "확인 실패", checking: "확인 중" };

export function IntegrationList({ probe }: { probe: ReturnType<typeof useIntegrationProbe> }) {
  const { state } = probe;
  return (
    <div className="list">
      {INTEGRATIONS.map((i) => {
        const s = state[i.key] ?? "checking";
        return (
          <div key={i.key} className="list__item">
            <span className="what">
              <div className="t">{i.label}</div>
              <div className="s mono">{s === "on" ? i.endpoint : i.env}</div>
            </span>
            <Badge tone={TONE[s]} dot={s === "on"}>
              {TEXT[s]}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export function IntegrationHelp({ probe }: { probe: ReturnType<typeof useIntegrationProbe> }) {
  if (probe.checking) return null;
  if (probe.failed > 0) {
    return (
      <p className="help">
        <Icon name="alertTriangle" size={12} /> 확인 실패는 인증키 문제가 아니라 서버가 응답하지 않은 것입니다. 잠시 뒤 다시 확인해 주세요.
      </p>
    );
  }
  if (probe.on === probe.total) return <p className="help">네 연동 모두 인증키가 설정돼 있습니다.</p>;
  return (
    <p className="help">
      미설정 연동은 화면에서 기능이 잠기고 발급 방법을 안내합니다. Vercel 의 Settings → Environment Variables 에 위 변수를 넣고 다시 배포하면 켜집니다.
    </p>
  );
}
