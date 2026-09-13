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
 *
 * 그런데 "설정됨"도 절반짜리 답이다. 키가 환경 변수에 들어 있는 것과
 * 그 키로 조회가 되는 것은 다르다 — VWorld 는 발급할 때 등록한 도메인이
 * 아니면 거절하고, 공공데이터포털은 서비스별 활용 신청이 승인돼야 열린다.
 * 둘 다 키는 멀쩡한데 조회만 안 되는 상태다. 그래서 한 번 실제로
 * 불러 보는 확인을 따로 뒀다. 호출 한도를 쓰므로 누를 때만 돈다.
 */
export type Integration = {
  key: string;
  label: string;
  /** GET 했을 때 { configured: boolean } 을 돌려주는 주소 */
  endpoint: string;
  /** 설정에 필요한 환경 변수 — 미설정일 때 그대로 보여 준다 */
  env: string;
  /** 실제로 한 번 불러 보는 주소. 없는 연동도 있다. */
  check?: string;
};

export const INTEGRATIONS: Integration[] = [
  { key: "bldrgst", label: "건축물대장", endpoint: "/api/building-register", env: "DATA_GO_KR_API_KEY", check: "/api/building-register?check=1" },
  { key: "vworld", label: "주소·필지 (VWorld)", endpoint: "/api/vworld", env: "VWORLD_API_KEY", check: "/api/vworld?check=1" },
  { key: "billing", label: "정기결제", endpoint: "/api/billing", env: "PORTONE_API_SECRET 또는 TOSS_SECRET_KEY" },
  { key: "files", label: "첨부 파일 저장소", endpoint: "/api/files", env: "S3_ENDPOINT · S3_BUCKET · S3_ACCESS_KEY_ID · S3_SECRET_ACCESS_KEY" },
];

/** 확인 전 · 설정됨 · 미설정 · 확인 실패를 구분한다. "모름"을 "정상"으로 뭉개지 않는다. */
export type ProbeState = "checking" | "on" | "off" | "error";

/** 실제 호출 결과 — 돌고 있거나, 됐거나, 안 됐거나. */
export type LiveState = "running" | { ok: boolean; message: string; hint?: string };

/** 성공했을 때 무엇이 확인됐는지 한 줄로. "성공"만 쓰면 뭘 했는지 알 수 없다. */
function summarize(key: string, data: Record<string, unknown>): string {
  if (key === "vworld") {
    const pnu = typeof data.pnu === "string" ? data.pnu : null;
    return `${data.address ?? "주소"} 조회 성공${pnu ? ` · PNU ${pnu}` : ""}`;
  }
  if (key === "bldrgst") {
    const n = Number(data.totalCount ?? 0);
    return n > 0 ? `십정동 630 대장 ${n}건 확인` : String(data.note ?? "응답 정상");
  }
  return "호출 성공";
}

export function useIntegrationProbe() {
  const [state, setState] = useState<Record<string, ProbeState>>(() =>
    Object.fromEntries(INTEGRATIONS.map((i) => [i.key, "checking" as ProbeState])),
  );
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveState>>({});

  const probe = useCallback(async () => {
    setState(Object.fromEntries(INTEGRATIONS.map((i) => [i.key, "checking" as ProbeState])));
    // 설정이 바뀌었을 수 있으니 지난 호출 결과는 지운다. 낡은 초록불이 제일 나쁘다.
    setLive({});
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

  /** 키가 설정된 연동만 실제로 불러 본다. 없는 키로 부르면 한도만 버린다. */
  const runLive = useCallback(async () => {
    const targets = INTEGRATIONS.filter((i) => i.check && state[i.key] === "on");
    if (targets.length === 0) return;
    setLive(Object.fromEntries(targets.map((i) => [i.key, "running" as LiveState])));
    const results = await Promise.all(
      targets.map(async (i): Promise<[string, LiveState]> => {
        try {
          const res = await fetch(i.check!, { cache: "no-store" });
          const data = (await res.json()) as Record<string, unknown>;
          if (data.ok === true) return [i.key, { ok: true, message: summarize(i.key, data) }];
          return [
            i.key,
            {
              ok: false,
              message: String(data.message ?? "조회하지 못했습니다."),
              hint: typeof data.hint === "string" ? data.hint : undefined,
            },
          ];
        } catch {
          return [i.key, { ok: false, message: "서버에 닿지 못했습니다.", hint: "잠시 뒤 다시 눌러 주세요." }];
        }
      }),
    );
    setLive((prev) => ({ ...prev, ...Object.fromEntries(results) }));
  }, [state]);

  const on = INTEGRATIONS.filter((i) => state[i.key] === "on").length;
  const checking = INTEGRATIONS.some((i) => state[i.key] === "checking");
  const failed = INTEGRATIONS.filter((i) => state[i.key] === "error").length;
  const liveRunning = Object.values(live).some((v) => v === "running");
  const liveTargets = INTEGRATIONS.filter((i) => i.check && state[i.key] === "on").length;
  const liveFailed = Object.values(live).filter((v) => v !== "running" && !v.ok).length;

  return { state, checkedAt, probe, on, checking, failed, total: INTEGRATIONS.length, live, runLive, liveRunning, liveTargets, liveFailed };
}

type Probe = ReturnType<typeof useIntegrationProbe>;

export function IntegrationTile({ probe }: { probe: Probe }) {
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

export function IntegrationList({ probe }: { probe: Probe }) {
  const { state, live } = probe;
  return (
    <div className="list">
      {INTEGRATIONS.map((i) => {
        const s = state[i.key] ?? "checking";
        const l = live[i.key];
        return (
          <div key={i.key} className="list__item">
            <span className="what">
              <div className="t">{i.label}</div>
              <div className="s mono">{s === "on" ? i.endpoint : i.env}</div>
              {l === "running" && <div className="s">실제로 불러 보는 중…</div>}
              {l && l !== "running" && (
                <div className="s" style={{ color: l.ok ? "var(--good)" : "var(--danger)" }}>
                  <Icon name={l.ok ? "check" : "alertTriangle"} size={12} /> {l.message}
                  {!l.ok && l.hint ? ` ${l.hint}` : ""}
                </div>
              )}
            </span>
            <span className="row" style={{ gap: 6 }}>
              {l && l !== "running" && <Badge tone={l.ok ? "good" : "danger"} dot>{l.ok ? "조회됨" : "조회 실패"}</Badge>}
              <Badge tone={TONE[s]} dot={s === "on"}>
                {TEXT[s]}
              </Badge>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 실제 호출 확인 버튼. 부를 대상이 없으면 아예 내놓지 않는다. */
export function LiveCheckButton({ probe }: { probe: Probe }) {
  if (probe.checking || probe.liveTargets === 0) return null;
  return (
    <button type="button" className="btn btn--sm" disabled={probe.liveRunning} onClick={() => void probe.runLive()}>
      <Icon name="globe" size={14} /> {probe.liveRunning ? "불러 보는 중…" : "실제로 불러 보기"}
    </button>
  );
}

export function IntegrationHelp({ probe }: { probe: Probe }) {
  if (probe.checking) return null;

  const anyLive = Object.keys(probe.live).length > 0;
  if (anyLive && !probe.liveRunning) {
    if (probe.liveFailed > 0) {
      return (
        <p className="help">
          <Icon name="alertTriangle" size={12} /> 키는 설정돼 있지만 조회가 되지 않는 연동이 있습니다. 위에 적힌 사유대로 발급처에서
          도메인 등록이나 활용 신청 승인을 확인해 주세요.
        </p>
      );
    }
    return (
      <p className="help">
        <Icon name="check" size={12} /> 실제 조회까지 확인했습니다. 키가 살아 있고 이 도메인에서 허용돼 있습니다.
      </p>
    );
  }

  if (probe.failed > 0) {
    return (
      <p className="help">
        <Icon name="alertTriangle" size={12} /> 확인 실패는 인증키 문제가 아니라 서버가 응답하지 않은 것입니다. 잠시 뒤 다시 확인해 주세요.
      </p>
    );
  }
  if (probe.on === probe.total) {
    return (
      <p className="help">
        네 연동 모두 인증키가 설정돼 있습니다. 키가 실제로 통하는지는 [실제로 불러 보기]로 확인합니다.
      </p>
    );
  }
  return (
    <p className="help">
      미설정 연동은 화면에서 기능이 잠기고 발급 방법을 안내합니다. Vercel 의 Settings → Environment Variables 에 위 변수를 넣고 다시 배포하면 켜집니다.
      설정된 연동이 실제로 조회되는지는 [실제로 불러 보기]로 확인할 수 있습니다.
    </p>
  );
}
