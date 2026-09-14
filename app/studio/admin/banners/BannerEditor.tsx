"use client";

import { useMemo, useState } from "react";
import {
  BANNER_MAX,
  BANNER_PLACES,
  BANNER_TONES,
  BODY_MAX,
  CTA_MAX,
  PLACE_LABEL,
  TITLE_MAX,
  TONE_LABEL,
  bannerState,
  isSafeImageUrl,
  validateBanner,
} from "@/lib/banner";
import type { Banner, BannerPlace, BannerTone } from "@/lib/types";

/**
 * 배너 편집. 왼쪽 목록에서 한 장을 고르고 오른쪽에서 고칩니다.
 *
 * 발행 버튼은 없습니다 — 저장하면 곧바로 나갑니다. 그래서 저장 버튼 옆에
 * "이미 보낸 링크에도 바로 반영됩니다"를 계속 띄워 둡니다.
 */

const EMPTY = (order: number): Banner => ({
  id: `b${Date.now().toString(36)}`,
  title: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  imageUrl: "",
  tone: "navy",
  where: ["customer"],
  isAd: true,
  startAt: null,
  endAt: null,
  enabled: true,
  order,
});

/**
 * 그림 주소가 실제로 열리는지 눌러 봅니다.
 *
 * 주소만 검사하면 오타나 막아 둔 주소를 못 잡습니다. 그래서 한 장 불러 보고 결과를 적습니다.
 * 주소가 바뀌면 key 로 이 조각을 새로 달아 상태가 저절로 초기화됩니다.
 */
function ImageProbe({ url }: { url: string }) {
  const [state, setState] = useState<"load" | "ok" | "bad">("load");
  if (!url.trim()) return null;
  if (!isSafeImageUrl(url)) {
    return <p className="hint bn-badhint">그림 주소는 http 나 https 로 시작해야 합니다.</p>;
  }
  // 미리보기가 같은 그림을 이미 받아 뒀으면 onLoad 가 손 붙기 전에 끝나 버립니다.
  // 그러면 "불러오는 중…" 에서 안 움직입니다 — 그래서 끝났는지 직접 확인합니다.
  const settle = (el: HTMLImageElement | null) => {
    if (el?.complete) setState(el.naturalWidth > 0 ? "ok" : "bad");
  };
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" hidden ref={settle} onLoad={() => setState("ok")} onError={() => setState("bad")} />
      {state === "load" && <p className="hint">그림을 불러오는 중…</p>}
      {state === "ok" && <p className="hint bn-okhint">그림을 불러왔습니다. 아래 미리보기로 확인하세요.</p>}
      {state === "bad" && (
        <p className="hint bn-badhint">
          이 주소에서 그림이 안 열립니다. 주소가 맞는지, 로그인 없이 누구나 볼 수 있는 주소인지 확인하세요.
        </p>
      )}
    </>
  );
}

function Preview({ b, place }: { b: Banner; place: BannerPlace }) {
  const forCustomer = place === "customer";
  return (
    <div className="bn-prev">
      <div className="bn-prev-h">{PLACE_LABEL[place]}</div>
      <div className={`promo promo-${b.tone}`}>
        {b.imageUrl && isSafeImageUrl(b.imageUrl) && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="promo-img" src={b.imageUrl} alt="" />
        )}
        <p className="promo-t">{b.title || "제목이 들어갑니다"}</p>
        {b.body && <p className="promo-b">{b.body}</p>}
        {b.ctaUrl && b.ctaLabel && <span className="promo-btn">{b.ctaLabel}</span>}
        {forCustomer && b.isAd && <span className="promo-ad">(광고) 수신거부는 아래 안내를 확인하세요.</span>}
        {!forCustomer && (
          <span className="promo-note">
            {b.where.includes("customer")
              ? "고객용 EDM 에도 함께 나가는 배너입니다. 관리자 → 배너에서 고칠 수 있습니다."
              : "중개사용 브리핑에만 나오는 배너입니다. 고객에게는 나가지 않습니다."}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BannerEditor({ initial }: { initial: Banner[] }) {
  const [list, setList] = useState<Banner[]>(initial);
  const [at, setAt] = useState(initial.length ? 0 : -1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const cur = at >= 0 && at < list.length ? list[at] : null;
  const problems = useMemo(() => (cur ? validateBanner(cur) : []), [cur]);

  const patch = (p: Partial<Banner>) => {
    if (at < 0) return;
    setList((prev) => prev.map((b, i) => (i === at ? { ...b, ...p } : b)));
    setMsg(null);
  };

  const add = () => {
    if (list.length >= BANNER_MAX) return;
    setList((prev) => [...prev, EMPTY(prev.length)]);
    setAt(list.length);
    setMsg(null);
  };

  const remove = () => {
    if (at < 0) return;
    setList((prev) => prev.filter((_, i) => i !== at));
    setAt((a) => Math.min(a, list.length - 2));
    setMsg(null);
  };

  const move = (d: -1 | 1) => {
    const to = at + d;
    if (at < 0 || to < 0 || to >= list.length) return;
    setList((prev) => {
      const next = [...prev];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
    setAt(to);
    setMsg(null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banners: list }),
      });
      const data = (await res.json()) as { banners?: Banner[]; error?: string };
      if (!res.ok) {
        setMsg({ kind: "bad", text: data.error ?? "저장하지 못했습니다." });
        return;
      }
      if (data.banners) setList(data.banners);
      setMsg({ kind: "ok", text: "저장했습니다. 이미 보낸 링크에도 반영됐습니다." });
    } catch (e) {
      setMsg({ kind: "bad", text: `저장하지 못했습니다 — ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const togglePlace = (p: BannerPlace) => {
    if (!cur) return;
    patch({ where: cur.where.includes(p) ? cur.where.filter((x) => x !== p) : [...cur.where, p] });
  };

  return (
    <div className="bn">
      <div className="bn-list">
        <div className="bn-list-h">
          <span>배너 {list.length}장</span>
          <button className="btn btn-sm" type="button" onClick={add} disabled={list.length >= BANNER_MAX}>
            + 새 배너
          </button>
        </div>
        {list.length === 0 ? (
          <p className="adm-empty" style={{ padding: "14px 15px" }}>
            아직 배너가 없습니다. <b>+ 새 배너</b>를 눌러 한 장 만들어 보세요.
          </p>
        ) : (
          list.map((b, i) => {
            const st = bannerState(b);
            return (
              <button key={b.id} type="button" className={`bn-item${i === at ? " on" : ""}`} onClick={() => setAt(i)}>
                <span className="bn-item-t">{b.title || "(제목 없음)"}</span>
                <span className={`bn-item-s bn-${st.tone}`}>{st.label}</span>
                <span className="bn-item-w">{b.where.map((w) => PLACE_LABEL[w]).join(" · ") || "노출 안 함"}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="bn-edit">
        {!cur ? (
          <p className="adm-empty">왼쪽에서 배너를 고르거나 새로 만드세요.</p>
        ) : (
          <>
            <div className="bn-rowbtns">
              <button className="btn btn-sm" type="button" onClick={() => move(-1)} disabled={at <= 0}>
                ↑ 위로
              </button>
              <button className="btn btn-sm" type="button" onClick={() => move(1)} disabled={at >= list.length - 1}>
                ↓ 아래로
              </button>
              <button className="btn btn-sm btn-danger" type="button" onClick={remove}>
                삭제
              </button>
              <span className="bn-hint">기간이 겹치면 위에 있는 배너가 나갑니다.</span>
            </div>

            <div className="field">
              <label htmlFor="bn-title">제목 <span className="bn-count">{cur.title.length}/{TITLE_MAX}</span></label>
              <input id="bn-title" value={cur.title} maxLength={TITLE_MAX} onChange={(e) => patch({ title: e.target.value })} placeholder="전세 계약 앞두고 계신가요?" />
            </div>

            <div className="field">
              <label htmlFor="bn-body">본문 <span className="bn-count">{cur.body.length}/{BODY_MAX}</span></label>
              <textarea id="bn-body" value={cur.body} maxLength={BODY_MAX} rows={3} onChange={(e) => patch({ body: e.target.value })} placeholder="등기부·보증보험 가입 가능 여부까지 계약 전에 함께 확인해 드립니다." />
            </div>

            <div className="bn-two">
              <div className="field">
                <label htmlFor="bn-ctal">버튼 글자 <span className="bn-count">{cur.ctaLabel.length}/{CTA_MAX}</span></label>
                <input id="bn-ctal" value={cur.ctaLabel} maxLength={CTA_MAX} onChange={(e) => patch({ ctaLabel: e.target.value })} placeholder="☏ 010-0000-0000" />
              </div>
              <div className="field">
                <label htmlFor="bn-ctau">버튼 주소</label>
                <input id="bn-ctau" value={cur.ctaUrl} onChange={(e) => patch({ ctaUrl: e.target.value })} placeholder="tel:01000000000" />
                <p className="hint">http · https · tel: · mailto: 만 넣을 수 있습니다.</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="bn-img">그림 주소 <span className="bn-count">안 넣어도 됩니다</span></label>
              <input id="bn-img" value={cur.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} placeholder="https://… .jpg" />
              <ImageProbe key={cur.imageUrl} url={cur.imageUrl} />
              <p className="hint">
                <b>가로 1200px</b> 로 만드세요. 화면에는 600px 로 줄어 들어가고, 두 배로 만들어야 휴대폰에서 안 뿌옇습니다.
                높이는 <b>1200×600</b> 이나 <b>1200×400</b> 이 무난합니다. 그림은 제목 위에 얹히고, 버튼 주소를 넣어 두면 그림을 눌러도 같은 곳으로 갑니다.
              </p>
            </div>

            <div className="bn-two">
              <div className="field">
                <label htmlFor="bn-tone">색</label>
                <select id="bn-tone" value={cur.tone} onChange={(e) => patch({ tone: e.target.value as BannerTone })}>
                  {BANNER_TONES.map((t) => (
                    <option key={t} value={t}>
                      {TONE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="bn-start">노출 기간</label>
                <div className="bn-dates">
                  <input id="bn-start" type="date" value={cur.startAt ?? ""} onChange={(e) => patch({ startAt: e.target.value || null })} />
                  <span aria-hidden="true">–</span>
                  <input id="bn-end" type="date" value={cur.endAt ?? ""} aria-label="노출 종료일" onChange={(e) => patch({ endAt: e.target.value || null })} />
                </div>
                <p className="hint">비우면 제한이 없습니다. 종료일을 넣으면 그날이 지나 스스로 사라집니다.</p>
              </div>
            </div>

            <div className="bn-two">
              <div className="field">
                <label>노출할 곳</label>
                <div className="bn-checks">
                  {BANNER_PLACES.map((p) => (
                    <label key={p} className="bn-check" htmlFor={`bn-where-${p}`}>
                      <input id={`bn-where-${p}`} type="checkbox" checked={cur.where.includes(p)} onChange={() => togglePlace(p)} />
                      {PLACE_LABEL[p]}
                    </label>
                  ))}
                </div>
                <p className="hint">
                  {cur.where.includes("broker")
                    ? "중개사용 브리핑 맨 아래, 사무소 정보 바로 위에 섭니다."
                    : "중개사용 브리핑에는 안 나옵니다 — 나오게 하려면 «중개사용 브리핑»을 켜세요."}
                </p>
              </div>
              <div className="field">
                <label>상태</label>
                <div className="bn-checks">
                  <label className="bn-check" htmlFor="bn-enabled">
                    <input id="bn-enabled" type="checkbox" checked={cur.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                    켜기
                  </label>
                  <label className="bn-check" htmlFor="bn-isad">
                    <input id="bn-isad" type="checkbox" checked={cur.isAd} onChange={(e) => patch({ isAd: e.target.checked })} />
                    광고로 표시
                  </label>
                </div>
                <p className="hint">
                  사무소를 홍보하는 내용이면 <b>광고로 표시</b>를 켜 두세요. 고객용 EDM 에 <b>(광고)</b> 표기가 붙습니다. 중개사용 브리핑에는 붙지 않습니다.
                </p>
              </div>
            </div>

            {problems.length > 0 && (
              <div className="alert alert-warn">
                {problems.map((m, i) => (
                  <div key={i}>{m}</div>
                ))}
              </div>
            )}

            <div className="bn-prevs">
              {cur.where.includes("customer") && <Preview b={cur} place="customer" />}
              {cur.where.includes("broker") && <Preview b={cur} place="broker" />}
              {cur.where.length === 0 && <p className="adm-empty">노출할 곳을 고르면 여기에 미리보기가 나옵니다.</p>}
            </div>
          </>
        )}

        <div className="bn-save">
          <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
          <span className="bn-hint">저장하면 이미 보낸 EDM 링크에도 바로 반영됩니다.</span>
        </div>
        {msg && <div className={`alert ${msg.kind === "ok" ? "alert-ok" : "alert-warn"}`} style={{ whiteSpace: "pre-line" }}>{msg.text}</div>}
      </div>
    </div>
  );
}
