// 카드뉴스(index.html)를 영상 프레임으로 찍기 위한 레이아웃과 등장 애니메이션.
// render-video.js 가 video.css 와 함께 주입한 뒤 __setup(mode) → __show(id) → __seek(id, t) 순으로 부른다.
(() => {
  // 장마다 화면에 머무는 시간(초). 글이 많은 장일수록 길다.
  const HOLD = { c01: 6, c02: 10, c03: 11, c04: 11, c05: 11, c06: 12, c07: 12, c08: 12, c09: 15, c10: 12, c11: 12 };
  // 앞 장과 겹쳐 넘어가는 동안은 비워 두고, 넘어간 뒤에 내용이 올라오게 한다.
  const LEAD = 0.6;

  // 가로 화면에서 왼쪽 단(제목·한 줄 정리)으로 보낼 요소. 나머지는 오른쪽 단(그림·표)으로 간다.
  const LEFT = {
    c01: ["h1", ".sub"],
    c02: [".eyebrow", "h2", ".say"],
    c03: [".eyebrow", "h2", ".formula"],
    c04: [".eyebrow", "h2", ".w-only"],
    c05: [".eyebrow", "h2", ".two"],
    c06: [".eyebrow", "h2", ".read"],
    c07: [".eyebrow", "h2", ".facts", ".facts-cap"],
    c08: [".eyebrow", "h2", ".lead"],
    c09: [".eyebrow", "h2", ".w-only"],
    c10: [".eyebrow", "h2", ".quote"],
    c11: [".eyebrow", "h2", ".cta", ".office"],
  };
  // 가로 화면은 왼쪽 단이 비어 보이는 장이 있어, 원고에 있던 문장을 한 줄 더 꺼내 쓴다.
  const EXTRA = {
    c04: { after: "h2", text: "대지가 15평이든 30평이든, 5억 2,000만 원 아래 거래는 없었습니다." },
    c09: { after: "h2", text: "이 확인 없이 계약하면 5억 전체가 불확실성 위에 올라갑니다." },
  };

  // [선택자, 방식, 시작(초), 길이(초), 여러 개면 간격(초), 옵션]
  const HEAD = [[".eyebrow", "up", 0, 0.6], ["h2", "up", 0.15, 0.7]];
  const STEPS = {
    c01: [[".ticket", "up", 0, 0.8], [".ticket .price", "pop", 0.35, 0.8], [".stub .q", "pop", 0.9, 0.6],
          ["h1", "up", 1.2, 0.7], [".sub", "up", 1.7, 0.7]],
    c02: [...HEAD, [".spec > div", "up", 0.6, 0.55, 0.12], [".split .cap", "up", 1.5, 0.5],
          [".split .bar span:nth-child(1)", "growX", 1.7, 0.5], [".split .bar span:nth-child(2)", "growX", 1.9, 0.9],
          [".split .lab", "fade", 2.5, 0.5], [".say", "up", 2.9, 0.7], [".say .mark", "mark", 3.5, 0.8]],
    c03: [...HEAD, [".receipt", "up", 0.6, 0.6], [".receipt > :nth-child(1)", "fade", 1.0, 0.4],
          [".receipt > :nth-child(2)", "fade", 1.4, 0.4], [".receipt > :nth-child(3)", "fade", 1.6, 0.4],
          [".receipt .rule", "growX", 1.9, 0.5], [".receipt .total", "fade", 2.3, 0.3],
          [".receipt .total .v", "count", 2.3, 1.3, 0, { to: 196152, fmt: "eok" }],
          [".formula", "up", 3.5, 0.7], [".formula .mark", "mark", 4.1, 0.9]],
    c04: [...HEAD, ["h2 .mark", "mark", 0.7, 0.8], ["svg .ax", "fade", 0.6, 0.6], ["svg .deal", "pop", 1.1, 0.45, 0.12],
          ["svg .lbl", "fade", 2.4, 0.4], ["svg .ref", "growX", 2.5, 0.7], ["svg .ref-l", "fade", 2.9, 0.4],
          ["svg .me", "pop", 3.2, 0.6], ["svg .me-l", "fade", 3.5, 0.5], [".legend", "fade", 3.6, 0.5],
          [".w-only", "up", 3.9, 0.6]],
    c05: [...HEAD, ["h2 .mark", "mark", 0.7, 0.8], [".bars .r .h", "fade", 1.0, 0.4, 0.25],
          [".bars .r .fill", "growX", 1.0, 0.9, 0.25], [".bars .r .ext", "fade", 2.0, 0.4],
          [".two > div", "up", 2.6, 0.6, 0.3]],
    c06: [...HEAD, [".vs .up", "up", 0.6, 0.6], [".vs .up .big", "count", 0.8, 1.2, 0, { to: 4.1, fmt: "pct" }],
          [".vs .flat", "up", 1.2, 0.6], [".read > p:not(.say)", "up", 2.3, 0.6], [".read .say", "up", 2.7, 0.6],
          [".read .mark", "mark", 3.2, 1.0]],
    c07: [...HEAD, [".tl li", "up", 0.6, 0.55, 0.4], [".facts", "up", 2.4, 0.6], [".facts-cap", "fade", 2.7, 0.4]],
    c08: [...HEAD, [".lead", "up", 0.5, 0.6], [".zone.a", "up", 1.0, 0.6], [".zone.a .bld span", "growY", 1.4, 0.5, 0.08],
          [".arrow", "fade", 1.9, 0.5], [".zone.b", "up", 2.2, 0.6], [".zone.b .bld span", "growY", 2.6, 0.7, 0.12]],
    c09: [...HEAD, [".w-only", "up", 0.5, 0.6], [".chk li", "up", 0.7, 0.55, 0.35]],
    c10: [...HEAD, [".who .yes", "up", 0.7, 0.6], [".who .wait", "up", 1.4, 0.6], [".quote", "up", 2.2, 0.7]],
    c11: [...HEAD, [".pts li", "up", 0.7, 0.6, 0.45], [".cta", "up", 1.8, 0.6], [".office", "fade", 2.3, 0.6]],
  };

  const clamp = v => Math.max(0, Math.min(1, v));
  const outCubic = p => 1 - Math.pow(1 - p, 3);
  const outBack = p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const won = n => n.toLocaleString("ko-KR");
  const FMT = {
    eok: v => { v = Math.round(v); const e = Math.floor(v / 10000), m = v % 10000; return `약 ${e ? e + "억 " : ""}${won(m)}만`; },
    pct: v => `+${v.toFixed(1)}%`,
  };

  let tracks = {};

  function apply(el, kind, p, opt) {
    const e = outCubic(p);
    switch (kind) {
      case "up":   el.style.opacity = e; el.style.transform = `translateY(${(1 - e) * 28}px)`; break;
      case "fade": el.style.opacity = e; break;
      case "pop":  el.style.opacity = clamp(p * 2.5); el.style.transform = `scale(${0.4 + 0.6 * outBack(p)})`; break;
      case "growX": el.style.transform = `scaleX(${e})`; break;
      case "growY": el.style.transform = `scaleY(${e})`; break;
      case "mark": el.style.backgroundSize = `${e * 100}% 100%`; break;
      case "count": el.textContent = FMT[opt.fmt](opt.to * e); break;
    }
  }

  function compile(card) {
    const out = [];
    let end = 0;
    for (const [sel, kind, start, dur, gap = 0, opt] of STEPS[card.id]) {
      const els = [...card.querySelectorAll(sel)];
      if (!els.length) throw new Error(`${card.id}: '${sel}' 없음`);
      els.forEach((el, i) => {
        const s = LEAD + start + i * gap;
        if (kind === "pop" || kind === "growX" || kind === "growY") {
          el.style.transformBox = "fill-box";
          el.style.transformOrigin = kind === "growX" ? "left center" : kind === "growY" ? "center bottom" : "center";
        }
        out.push({ el, kind, s, dur, opt });
        end = Math.max(end, s + dur);
      });
    }
    return { steps: out, anim: end + 0.3 };
  }

  function splitColumns(card) {
    const body = card.querySelector(".body");
    const L = document.createElement("div"); L.className = "colL";
    const R = document.createElement("div"); R.className = "colR";
    const left = LEFT[card.id];
    for (const el of [...body.children]) {
      (left.some(s => el.matches(s)) ? L : R).appendChild(el);
    }
    body.append(L, R);
  }

  window.__setup = mode => {
    document.body.classList.add("video", mode);
    const cards = [...document.querySelectorAll(".card")];
    for (const card of cards) {
      const ex = EXTRA[card.id];
      if (ex) {
        const p = document.createElement("p");
        p.className = "lead w-only"; p.textContent = ex.text;
        card.querySelector(ex.after).after(p);
      }
      if (mode === "wide") splitColumns(card);
    }
    if (mode === "short") {
      cards.forEach((card, i) => {
        const f = document.createElement("div");
        f.className = "sframe"; f.dataset.id = card.id;
        f.innerHTML = `<div class="sband-top"><small>성북2구역 무허가주택</small><b>5억 매물, 끝까지 계산해 보면</b></div>`;
        card.before(f); f.appendChild(card);
        const bot = document.createElement("div"); bot.className = "sband-bot";
        bot.innerHTML = cards.map((_, j) => `<i class="${j === i ? "cur" : ""}"></i>`).join("");
        f.appendChild(bot);
      });
    }
    tracks = {};
    for (const card of cards) tracks[card.id] = compile(card);
    return cards.map(c => ({ id: c.id, anim: tracks[c.id].anim, hold: HOLD[c.id] }));
  };

  window.__show = id => {
    document.querySelectorAll(".card, .sframe").forEach(n => n.classList.remove("on"));
    const card = document.getElementById(id);
    (card.closest(".sframe") || card).classList.add("on");
  };

  window.__seek = (id, t) => {
    for (const { el, kind, s, dur, opt } of tracks[id].steps) apply(el, kind, clamp((t - s) / dur), opt);
  };

  window.__thumb = () => {
    document.body.className = "video thumbmode";
    document.body.innerHTML = `
      <div class="thumb" id="thumb">
        <div class="ticket">
          <div class="main">
            <div class="label"><span>입장권</span><span>성북2구역</span></div>
            <div class="price">5억</div>
            <div class="meta">무허가주택 · 대지 2.42평</div>
          </div>
          <div class="stub"><div class="q">?</div></div>
        </div>
        <div class="tx">
          <small>성북2구역 무허가주택 매물</small>
          <div class="l1">끝까지 계산하면</div>
          <div class="l2"><span class="ap">약</span>19.6억</div>
          <div class="n">조합원 분양가 15억 원 가정 · 추정치</div>
        </div>
      </div>`;
  };
})();
