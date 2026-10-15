// 카드뉴스 HTML 의 data-a / data-ac 표시를 읽어 영상 프레임용 등장 애니메이션을 건다.
//   data-a="방식 시작 길이"          그 요소 하나
//   data-ac="방식 시작 길이 간격"    자식마다 간격만큼 늦게
//   data-hold="초" (.card)           그 장이 화면에 머무는 시간
// 방식: up · fade · pop · growX · growY · mark(형광펜) · count(data-to, data-fmt: pct1·eok1·int·eok)
// shorts.js 가 주입한 뒤 __setup() → __show(id) → __seek(id, t) 순으로 부른다.
(() => {
  const LEAD = 0.5; // 앞 장과 겹쳐 넘어가는 동안은 비워 두고, 넘어간 뒤에 내용이 올라오게 한다

  const css = document.createElement("style");
  css.textContent = `
    body.video { padding: 0; gap: 0; display: block; background: #000; }
    body.video .card { position: absolute; left: 0; top: 0; visibility: hidden; }
    body.video .card.on { visibility: visible; }
    body.video .thumb { display: none; }`;
  document.head.appendChild(css);

  const clamp = v => Math.max(0, Math.min(1, v));
  const outCubic = p => 1 - Math.pow(1 - p, 3);
  const outBack = p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const FMT = {
    pct1: v => `${v.toFixed(1)}%`,
    eok1: v => `${v.toFixed(1)}억`,
    int: v => Math.round(v).toLocaleString("ko-KR"),
    eok: v => { v = Math.round(v); const e = Math.floor(v / 10000), m = v % 10000; return `${e ? e + "억 " : ""}${m.toLocaleString("ko-KR")}만`; },
  };

  function apply(el, kind, p) {
    const e = outCubic(p);
    switch (kind) {
      case "up":    el.style.opacity = e; el.style.transform = `translateY(${(1 - e) * 30}px)`; break;
      case "fade":  el.style.opacity = e; break;
      case "pop":   el.style.opacity = clamp(p * 2.5); el.style.transform = `scale(${0.4 + 0.6 * outBack(p)})`; break;
      case "growX": el.style.transform = `scaleX(${e})`; break;
      case "growY": el.style.transform = `scaleY(${e})`; break;
      case "mark":  el.style.backgroundSize = `${e * 100}% 100%`; break;
      case "count": el.textContent = FMT[el.dataset.fmt](Number(el.dataset.to) * e); break;
    }
  }

  function prepare(el, kind) {
    if (kind === "pop" || kind === "growX" || kind === "growY") {
      el.style.transformBox = "fill-box";
      el.style.transformOrigin = kind === "growX" ? "left center" : kind === "growY" ? "center bottom" : "center";
      if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
    }
    if (kind === "mark") el.style.backgroundRepeat = "no-repeat";
  }

  const tracks = {};

  function compile(card) {
    const steps = [];
    const push = (el, spec, i = 0) => {
      const [kind, start, dur, gap = 0] = spec.trim().split(/\s+/);
      prepare(el, kind);
      steps.push({ el, kind, s: LEAD + Number(start) + i * Number(gap), dur: Number(dur) });
    };
    card.querySelectorAll("[data-a]").forEach(el => push(el, el.dataset.a));
    card.querySelectorAll("[data-ac]").forEach(el => [...el.children].forEach((c, i) => push(c, el.dataset.ac, i)));
    const end = Math.max(0, ...steps.map(s => s.s + s.dur));
    return { steps, anim: end + 0.3 };
  }

  window.__setup = () => {
    document.body.classList.add("video");
    const cards = [...document.querySelectorAll(".card")];
    for (const card of cards) tracks[card.id] = compile(card);
    return cards.map(c => ({ id: c.id, anim: tracks[c.id].anim, hold: Number(c.dataset.hold || 6) }));
  };

  window.__show = id => {
    document.querySelectorAll(".card").forEach(n => n.classList.toggle("on", n.id === id));
  };

  window.__seek = (id, t) => {
    for (const { el, kind, s, dur } of tracks[id].steps) apply(el, kind, clamp((t - s) / dur));
  };
})();
