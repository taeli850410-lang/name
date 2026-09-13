"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner } from "@/components/ui/Bits";
import { buildingAge, formatRegisterDate, parkingPerHousehold, pickDong, toFormPatch, type RegisterDong, type RegisterErrorCode, type RegisterSnapshot } from "@/lib/bldrgst";
import { formatNumber, TODAY } from "@/lib/format";

export type { RegisterSnapshot };

type Source = { bcode: string; jibunAddress: string; sigunguCode?: string };

type Result = { dongs: RegisterDong[]; totalCount: number; truncated: boolean; demo?: boolean; demoAddress?: string };
type Failure = { code: RegisterErrorCode; message: string; hint: string };

/**
 * 건축물대장 조회 — 주소가 정해진 뒤에 쓴다.
 * 조회는 서버 라우트(/api/building-register)가 하고, 인증키는 브라우저로 내려오지 않는다.
 */
export function RegisterLookup({
  source,
  dongHint,
  onApply,
  applyLabel = "이 내용으로 채우기",
}: {
  source: Source | null;
  dongHint?: string;
  onApply?: (patch: ReturnType<typeof toFormPatch>, snapshot: RegisterSnapshot) => void;
  applyLabel?: string;
}) {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [picked, setPicked] = useState<string>("");

  const run = async (demo: boolean) => {
    setState("loading");
    setFailure(null);
    setResult(null);
    try {
      const res = demo
        ? await fetch("/api/building-register?demo=1")
        : await fetch("/api/building-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bcode: source?.bcode, sigunguCode: source?.sigunguCode, jibunAddress: source?.jibunAddress }),
          });
      const data = await res.json();
      if (!data.ok) {
        setFailure({ code: data.code, message: data.message, hint: data.hint });
      } else {
        const dongs: RegisterDong[] = data.dongs ?? [];
        setResult({ dongs, totalCount: data.totalCount, truncated: data.truncated, demo: data.demo, demoAddress: data.demoAddress });
        setPicked(pickDong(dongs, dongHint)?.dongNm ?? dongs[0]?.dongNm ?? "");
      }
    } catch {
      setFailure({ code: "UPSTREAM", message: "조회 요청을 보내지 못했습니다.", hint: "인터넷 연결을 확인하고 다시 시도해 주세요." });
    } finally {
      setState("idle");
    }
  };

  const dong = result?.dongs.find((d) => d.dongNm === picked) ?? result?.dongs[0];
  const mains = result?.dongs.filter((d) => d.main) ?? [];

  return (
    <div className="br">
      <div className="br__head">
        <div>
          <span className="br__title">
            <Icon name="building" size={15} /> 건축물대장
          </span>
          <div className="help">면적·용도·층수·사용승인일을 국토교통부 대장에서 그대로 가져옵니다.</div>
        </div>
        <button type="button" className="btn btn--sm" disabled={!source || state === "loading"} onClick={() => run(false)}>
          {state === "loading" ? "조회 중…" : (
            <>
              <Icon name="search" size={14} /> 대장 조회
            </>
          )}
        </button>
      </div>

      {!source && (
        <p className="help row" style={{ gap: 8 }}>
          주소를 먼저 검색해 주세요. 검색 결과의 법정동코드로 대장을 찾습니다.
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => run(true)}>
            예시 응답 보기
          </button>
        </p>
      )}

      {failure && (
        <div className="mt-8">
          <Banner
            tone={failure.code === "NO_DATA" ? "warn" : "danger"}
            title={failure.message}
            body={failure.hint}
            actions={
              failure.code === "NO_KEY" ? (
                <button type="button" className="btn btn--sm" onClick={() => run(true)}>
                  예시 응답 보기
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {result && dong && (
        <div className="br__body">
          <div className="br__bar">
            <div className="row" style={{ gap: 8 }}>
              <b>{dong.bldNm || "이름 없음"}</b>
              {result.demo && <Badge tone="warn">예시</Badge>}
              <span className="muted small">
                주건축물 {mains.length}개
                {result.truncated ? ` · 전체 ${formatNumber(result.totalCount)}개 중 ${result.dongs.length}개 조회` : ""}
              </span>
            </div>
            {result.dongs.length > 1 && (
              <label className="row small" style={{ gap: 6 }}>
                동
                <select className="select" style={{ width: 170, height: 32 }} value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="동 선택">
                  {result.dongs.map((d) => (
                    <option key={d.dongNm} value={d.dongNm}>
                      {d.dongNm || "(동 없음)"}
                      {d.main ? "" : " · 부속"}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {result.demo && <p className="help">인증키가 없어 예시를 보여 주고 있습니다. 아래 값은 {result.demoAddress}의 실제 대장 응답이며, 지금 입력 중인 주소와는 관계가 없습니다.</p>}

          <dl className="br__grid">
            <Row k="주용도" v={dong.etcPurps || dong.mainPurps} />
            <Row k="구조" v={dong.strct} />
            <Row k="층수" v={`지상 ${dong.grndFlrCnt}층${dong.ugrndFlrCnt ? ` · 지하 ${dong.ugrndFlrCnt}층` : ""}`} />
            <Row k="세대·호수" v={[dong.hhldCnt && `${formatNumber(dong.hhldCnt)}세대`, dong.fmlyCnt && `${dong.fmlyCnt}가구`, dong.hoCnt && `${dong.hoCnt}호`].filter(Boolean).join(" · ") || "기재 없음"} />
            <Row k="연면적" v={`${formatNumber(Math.round(dong.totArea * 100) / 100)}㎡`} sub={dong.gathered ? "동 전체" : undefined} />
            <Row k="대지면적" v={dong.platArea ? `${formatNumber(Math.round(dong.platArea * 100) / 100)}㎡` : "기재 없음"} />
            <Row
              k="사용승인"
              v={formatRegisterDate(dong.useAprDay) || "기재 없음"}
              sub={(() => {
                const age = buildingAge(dong.useAprDay, TODAY);
                return age === null ? undefined : `${age}년차`;
              })()}
            />
            <Row k="내진" v={dong.quake || "기재 없음"} />
            <Row
              k="주차"
              v={dong.parkingTotal ? `${dong.parkingTotal}대` : "대장에 기재 없음"}
              sub={(() => {
                const p = parkingPerHousehold(dong);
                return p === null ? (dong.parkingTotal ? undefined : "단지는 총괄표제부에 실립니다") : `세대당 ${p}대`;
              })()}
            />
            <Row k="승강기" v={dong.elevator ? `${dong.elevator}대` : "기재 없음"} />
          </dl>

          {dong.gathered && <p className="help">집합건물이라 연면적은 동 전체 면적입니다. 호별 전용면적은 채우지 않으니 등기부나 분양계약서에서 확인해 주세요.</p>}

          {onApply && (
            <div className="row row--end mt-8">
              <button type="button" className="btn btn--primary btn--sm" onClick={() => onApply(toFormPatch(dong), { fetchedAt: TODAY, demo: result.demo, dong })}>
                <Icon name="check" size={14} /> {applyLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="br__row">
      <dt>{k}</dt>
      <dd>
        {v}
        {sub && <span className="muted small"> · {sub}</span>}
      </dd>
    </div>
  );
}

/** 저장된 대장 스냅샷을 읽기 전용으로 보여 준다 (물건 상세). */
export function RegisterSummary({ snapshot }: { snapshot: RegisterSnapshot }) {
  const d = snapshot.dong;
  const age = buildingAge(d.useAprDay, TODAY);
  return (
    <div className="br">
      <div className="br__bar">
        <div className="row" style={{ gap: 8 }}>
          <b>{d.bldNm || "이름 없음"}</b>
          {d.dongNm && <Badge tone="outline">{d.dongNm}</Badge>}
          {snapshot.demo && <Badge tone="warn">예시</Badge>}
        </div>
        <span className="muted small">{snapshot.fetchedAt} 조회</span>
      </div>
      <dl className="br__grid">
        <Row k="주용도" v={d.etcPurps || d.mainPurps} />
        <Row k="구조" v={d.strct} />
        <Row k="층수" v={`지상 ${d.grndFlrCnt}층${d.ugrndFlrCnt ? ` · 지하 ${d.ugrndFlrCnt}층` : ""}`} />
        <Row k="사용승인" v={formatRegisterDate(d.useAprDay) || "기재 없음"} sub={age === null ? undefined : `${age}년차`} />
      </dl>
    </div>
  );
}
