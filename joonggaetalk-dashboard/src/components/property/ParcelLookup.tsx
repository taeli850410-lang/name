"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner } from "@/components/ui/Bits";
import { landValue, pnuToJibunText, type GeocodeHit, type Parcel, type VworldErrorCode, type VworldSnapshot, type Zoning } from "@/lib/vworld";
import type { RegisterKey } from "@/lib/bldrgst";
import { formatNumber, TODAY } from "@/lib/format";

type Resolved = GeocodeHit & { parcel: Parcel | null; zoning: Zoning | null; fellBack?: boolean; demo?: boolean; demoAddress?: string };
type Failure = { code: VworldErrorCode; message: string; hint: string };

/**
 * 주소 → 좌표·필지 (VWorld).
 * 도로명주소만 있어도 좌표로 지번을 되짚어 건축물대장 조회 키까지 만들어 준다.
 */
export function ParcelLookup({
  address,
  areaM2,
  saved,
  onResolved,
  onSave,
}: {
  address: string;
  areaM2?: number;
  saved?: VworldSnapshot;
  /** 조회에 성공하면 바로 불린다 — 부모가 대장 조회 키를 이어받는다 */
  onResolved?: (r: { bjdCode: string | null; jibunAddress: string; registerKey: RegisterKey | null; point: { lon: number; lat: number } }) => void;
  onSave?: (snapshot: VworldSnapshot) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Resolved | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = async (demo: boolean) => {
    setLoading(true);
    setFailure(null);
    setResult(null);
    try {
      const res = demo
        ? await fetch("/api/vworld?demo=1")
        : await fetch("/api/vworld", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      const data = await res.json();
      if (!data.ok) {
        setFailure({ code: data.code, message: data.message, hint: data.hint });
      } else {
        setResult(data as Resolved);
        onResolved?.({
          bjdCode: data.bjdCode ?? null,
          jibunAddress: data.parcel?.address || data.address || "",
          registerKey: data.registerKey ?? null,
          point: data.point,
        });
      }
    } catch {
      setFailure({ code: "UPSTREAM", message: "조회 요청을 보내지 못했습니다.", hint: "인터넷 연결을 확인하고 다시 시도해 주세요." });
    } finally {
      setLoading(false);
    }
  };

  const shown = result ?? (saved ? toShown(saved) : null);
  const value = shown ? landValue(shown.parcel?.landPrice ?? null, areaM2) : null;

  return (
    <div className="br">
      <div className="br__head">
        <div>
          <span className="br__title">
            <Icon name="mapPin" size={15} /> 주소·필지
          </span>
          <div className="help">주소를 좌표와 지번으로 바꾸고 지목·용도지역·공시지가를 확인합니다.</div>
        </div>
        <button type="button" className="btn btn--sm" disabled={!address.trim() || loading} onClick={() => run(false)}>
          {loading ? "조회 중…" : (
            <>
              <Icon name="search" size={14} /> 필지 조회
            </>
          )}
        </button>
      </div>

      {!address.trim() && (
        <p className="help row" style={{ gap: 8 }}>
          주소를 입력하거나 검색해 주세요. 도로명주소만 있어도 지번을 찾아냅니다.
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => run(true)}>
            예시 응답 보기
          </button>
        </p>
      )}

      {failure && (
        <div className="mt-8">
          <Banner
            tone={failure.code === "NOT_FOUND" ? "warn" : "danger"}
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

      {shown && (
        <div className="br__body">
          <div className="br__bar">
            <div className="row" style={{ gap: 8 }}>
              <b>{shown.parcel?.address || shown.address}</b>
              {shown.demo && <Badge tone="warn">예시</Badge>}
              {saved && !result && <Badge tone="outline">저장됨</Badge>}
            </div>
            <a className="link small" href={`https://map.kakao.com/link/map/${encodeURIComponent(shown.address)},${shown.point.lat},${shown.point.lon}`} target="_blank" rel="noreferrer">
              지도에서 보기 <Icon name="external" size={12} />
            </a>
          </div>

          {shown.demo && <p className="help">인증키가 없어 예시를 보여 주고 있습니다. 아래 값은 {shown.demoAddress}의 실제 응답이며, 지금 입력 중인 주소와는 관계가 없습니다.</p>}
          {shown.fellBack && <p className="help">지번으로 찾지 못해 도로명으로 다시 조회했습니다.</p>}
          {shown.type === "road" && shown.parcel && <p className="help">도로명주소로 찾은 좌표에서 지번을 되짚었습니다. 지번은 {shown.parcel.address} 입니다.</p>}

          <dl className="br__grid">
            <Row k="지목" v={shown.parcel?.jimok || "확인 안 됨"} />
            <Row k="용도지역" v={shown.zoning?.name || "확인 안 됨"} sub={shown.zoning?.year ? `${shown.zoning.year}년 결정` : undefined} />
            <Row k="지번" v={shown.parcel ? pnuToJibunText(shown.parcel.pnu) || shown.parcel.jibun : shown.number || "—"} />
            <Row k="좌표" v={`${shown.point.lat.toFixed(6)}, ${shown.point.lon.toFixed(6)}`} />
            <Row k="공시지가" v={shown.parcel?.landPrice ? `${formatNumber(shown.parcel.landPrice.wonPerSqm)}원/㎡` : "확인 안 됨"} sub={shown.parcel?.landPrice?.asOf ? `${shown.parcel.landPrice.asOf} 기준` : undefined} />
            <Row
              k="토지가액"
              v={value ? `${formatNumber(Math.round(value / 10000))}만원` : "면적 입력 시 산출"}
              sub={value ? "공시지가 × 면적" : undefined}
            />
          </dl>

          {shown.pnu && (
            <p className="help">
              PNU <span className="mono">{shown.pnu}</span>
              {shown.registerKey ? " · 이 값으로 위 [대장 조회]를 바로 쓸 수 있습니다." : ""}
            </p>
          )}
          {!shown.parcel && <p className="help">연속지적도에서 필지를 찾지 못했습니다. 좌표는 맞지만 지적 경계가 갱신 중일 수 있습니다.</p>}

          {onSave && !shown.demo && (
            <div className="row row--end mt-8">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() =>
                  onSave({
                    fetchedAt: TODAY,
                    point: shown.point,
                    address: shown.parcel?.address || shown.address,
                    pnu: shown.pnu,
                    parcel: shown.parcel,
                    zoning: shown.zoning,
                  })
                }
              >
                <Icon name="check" size={14} /> 물건에 저장
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function toShown(s: VworldSnapshot): Resolved {
  return {
    type: "parcel",
    point: s.point,
    address: s.address,
    pnu: s.pnu,
    bjdCode: s.pnu ? s.pnu.slice(0, 10) : null,
    registerKey: null,
    sido: "",
    sigungu: "",
    dong: "",
    number: "",
    detail: "",
    parcel: s.parcel,
    zoning: s.zoning,
    demo: s.demo,
  };
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
