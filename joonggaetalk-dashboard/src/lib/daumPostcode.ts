/**
 * 다음(카카오) 우편번호 서비스 — 주소 검색.
 * 키가 필요 없고 스크립트만 불러오면 된다. 건축물대장 조회에 필요한
 * 법정동코드(bcode)와 지번주소가 여기서 함께 들어온다.
 */

export type PostcodeResult = {
  /** 사용자가 고른 주소 (도로명 또는 지번) */
  address: string;
  roadAddress: string;
  /** 대장 조회는 이 값을 쓴다. 도로명을 골라도 자동 지번이 채워진다. */
  jibunAddress: string;
  /** 법정동코드 10자리 */
  bcode: string;
  sigunguCode: string;
  zonecode: string;
  buildingName: string;
  apartment: boolean;
};

type DaumPostcodeData = {
  address?: string;
  roadAddress?: string;
  jibunAddress?: string;
  autoJibunAddress?: string;
  autoRoadAddress?: string;
  bcode?: string;
  sigunguCode?: string;
  zonecode?: string;
  buildingName?: string;
  apartment?: string;
};

type DaumPostcodeCtor = new (opts: { oncomplete: (d: DaumPostcodeData) => void; onclose?: (state: string) => void }) => { open: () => void };

declare global {
  interface Window {
    daum?: { Postcode?: DaumPostcodeCtor };
  }
}

const SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
let loader: Promise<boolean> | null = null;

/** 스크립트를 한 번만 불러온다. 네트워크가 막힌 환경에서는 false 를 돌려준다. */
export function loadPostcodeScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.daum?.Postcode) return Promise.resolve(true);
  if (loader) return loader;
  loader = new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => resolve(ok && Boolean(window.daum?.Postcode));
    const el = document.createElement("script");
    el.src = SRC;
    el.async = true;
    el.onload = () => done(true);
    el.onerror = () => done(false);
    document.head.appendChild(el);
    window.setTimeout(() => done(false), 7000);
  });
  return loader;
}

/** 검색창을 띄운다. 스크립트를 못 불러왔거나 사용자가 닫으면 null. */
export async function openPostcode(): Promise<PostcodeResult | null> {
  const ok = await loadPostcodeScript();
  if (!ok || !window.daum?.Postcode) return null;
  return new Promise<PostcodeResult | null>((resolve) => {
    let settled = false;
    const finish = (v: PostcodeResult | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    new window.daum!.Postcode!({
      oncomplete: (d) =>
        finish({
          address: d.address ?? "",
          roadAddress: d.roadAddress || d.autoRoadAddress || "",
          jibunAddress: d.jibunAddress || d.autoJibunAddress || "",
          bcode: d.bcode ?? "",
          sigunguCode: d.sigunguCode ?? "",
          zonecode: d.zonecode ?? "",
          buildingName: d.buildingName ?? "",
          apartment: d.apartment === "Y",
        }),
      onclose: () => finish(null),
    }).open();
  });
}
