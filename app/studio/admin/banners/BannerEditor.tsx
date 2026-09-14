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
import { IMAGE_SOURCE_MAX, IMAGE_BASE64_MAX, IMAGE_WIDTH, imageIdOf } from "@/lib/bannerImage";
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
  // 양쪽에 겁니다. 사무소가 배너를 만들면 자기 브리핑 맨 아래에서도 보여야 무엇이 나가는지 압니다
  where: ["customer", "broker"],
  // 광고 표시는 꺼 둡니다. 상담 안내처럼 광고가 아닌 것이 더 많고, 켜면 (광고) 딱지가 붙습니다
  isAd: false,
  startAt: null,
  endAt: null,
  enabled: true,
  order,
});


/**
 * 고른 파일을 배너에 쓸 만한 크기로 줄여 data: 한 줄로 바꿉니다.
 *
 * 요즘 폰 사진은 4000px 에 8MB 라 그대로 올리면 저장소가 안 받습니다. 그래서 **올리기 전에
 * 브라우저에서** 가로 1200px 로 줄입니다. 서버는 줄이는 일을 하지 않습니다 — 그쪽에서 하려면
 * 라이브러리가 하나 더 붙는데, 여기서 이미 끝나 있습니다.
 *
 * webp 부터 넣어 봅니다. 가장 작고 투명한 부분도 살아 있습니다. 브라우저가 webp 를 못 만들면
 * toBlob 이 알아서 png 를 돌려주고, 그것도 크면 마지막으로 jpeg 까지 내려갑니다.
 */
const ENCODE: [string, number][] = [
  ["image/webp", 0.85],
  ["image/webp", 0.7],
  ["image/png", 1],
  ["image/jpeg", 0.82],
];

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(new Error("파일을 읽지 못했습니다."));
    r.readAsDataURL(blob);
  });
}

async function shrink(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("그림 파일이 아닙니다. JPG · PNG · WebP 를 고르세요.");
  if (file.size > IMAGE_SOURCE_MAX) throw new Error("파일이 너무 큽니다. 20MB 아래로 줄여서 올려 주세요.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const el = new Image();
      el.onload = () => ok(el);
      el.onerror = () => fail(new Error("그림을 열지 못했습니다. 다른 파일로 해 보세요."));
      el.src = objectUrl;
    });

    const scale = Math.min(1, IMAGE_WIDTH / (img.naturalWidth || IMAGE_WIDTH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서는 그림을 줄이지 못합니다. 그림 주소를 붙여넣어 주세요.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let last = "";
    for (const [type, quality] of ENCODE) {
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
      if (!blob) continue;
      const url = await readAsDataUrl(blob);
      last = url;
      if (url.length - url.indexOf(",") - 1 <= IMAGE_BASE64_MAX) return url;
    }
    if (last) throw new Error("줄여도 그림이 너무 큽니다. 더 단순한 그림으로 올려 주세요.");
    throw new Error("그림을 바꾸지 못했습니다. 다른 파일로 해 보세요.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
  const [up, setUp] = useState<{ busy: boolean; err: string | null }>({ busy: false, err: null });

  const cur = at >= 0 && at < list.length ? list[at] : null;
  const problems = useMemo(() => (cur ? validateBanner(cur) : []), [cur]);
  /** 우리가 받아 둔 그림인가. 그러면 주소 칸을 보여 줄 이유가 없습니다 — 주소가 우리 내부 주소입니다 */
  const uploaded = cur ? imageIdOf(cur.imageUrl) !== null : false;

  const patch = (p: Partial<Banner>) => {
    if (at < 0) return;
    setList((prev) => prev.map((b, i) => (i === at ? { ...b, ...p } : b)));
    setMsg(null);
  };

  /**
   * 파일을 고르면 줄여서 올리고, 돌려받은 주소를 그림 칸에 넣습니다.
   *
   * 배너를 아직 저장하지 않았어도 그림은 먼저 올라갑니다 — 그래야 미리보기로 확인하고
   * 저장할지 정할 수 있습니다. 저장하지 않고 나가면 다음 저장 때 딸린 그림도 같이 비워집니다.
   */
  const pickFile = async (file: File | undefined) => {
    if (!file || !cur) return;
    setUp({ busy: true, err: null });
    setMsg(null);
    try {
      const dataUrl = await shrink(file);
      const res = await fetch("/api/studio/banners/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cur.id, dataUrl }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "그림을 올리지 못했습니다.");
      patch({ imageUrl: data.url });
      setUp({ busy: false, err: null });
    } catch (e) {
      setUp({ busy: false, err: (e as Error).message });
    }
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
              <label htmlFor="bn-file">그림 <span className="bn-count">안 넣어도 됩니다</span></label>
              <div className="bn-img">
                {cur.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className="bn-img-thumb" src={cur.imageUrl} alt="" />
                )}
                <div className="bn-img-acts">
                  <label className={`btn btn-sm${up.busy ? " is-busy" : ""}`} htmlFor="bn-file">
                    {up.busy ? "올리는 중…" : cur.imageUrl ? "다른 그림으로" : "파일 올리기"}
                  </label>
                  <input
                    id="bn-file"
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={up.busy}
                    onChange={(e) => {
                      void pickFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {cur.imageUrl && (
                    <button className="btn btn-sm btn-danger" type="button" disabled={up.busy} onClick={() => { patch({ imageUrl: "" }); setUp({ busy: false, err: null }); }}>
                      그림 빼기
                    </button>
                  )}
                  <span className="bn-hint">
                    {uploaded ? "올린 그림입니다." : "JPG · PNG · WebP. 크면 알아서 가로 1200px 로 줄여 올립니다."}
                  </span>
                </div>
              </div>
              {up.err && <p className="hint bn-badhint">{up.err}</p>}

              {!uploaded && (
                <div className="bn-img-url">
                  <label htmlFor="bn-img">또는 그림 주소 붙여넣기</label>
                  <input id="bn-img" value={cur.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} placeholder="https://… .jpg" />
                  <ImageProbe key={cur.imageUrl} url={cur.imageUrl} />
                </div>
              )}

              <p className="hint">
                그림은 제목 위, 카드 위쪽을 꽉 채웁니다. 버튼 주소를 넣어 두면 그림을 눌러도 같은 곳으로 갑니다.
                직접 만드실 때는 <b>가로 1200px</b>, 높이는 <b>1200×600</b> 이나 <b>1200×400</b> 이 무난합니다.
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
                  상담 안내가 아니라 <b>광고</b>에 가까운 내용이면 <b>광고로 표시</b>를 켜세요. 고객용 EDM 에 작게 <b>(광고)</b> 한 마디만 붙습니다(중개사용에는 안 붙습니다). 정보통신망법이 광고성 정보에 요구하는 표기입니다.
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
