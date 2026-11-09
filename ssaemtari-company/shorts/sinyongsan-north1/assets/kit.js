/*
 * 장면들이 같이 쓰는 키네틱 타이포 도구.
 *
 * 모든 움직임은 GSAP 타임라인 위의 tween 이다. 콜백(onUpdate)으로 글자를 바꾸지
 * 않는다 — 렌더러가 프레임을 건너뛰며 탐색할 때 콜백이 생략될 수 있어서, 숫자
 * 카운트업도 0~9 띠를 굴려 멈추는 오도미터(transform)로 만든다.
 */
window.KIT = (function () {
  var DIG = "0123456789";

  /** data-odo="5억 7,650만" → 숫자마다 0~9 띠가 든 창. 글자(억·,·만)는 그대로 둔다. */
  function odo(scope) {
    var els = scope.querySelectorAll("[data-odo]");
    for (var e = 0; e < els.length; e++) {
      var el = els[e];
      if (el.getAttribute("data-odo-built")) continue;
      var text = el.getAttribute("data-odo");
      el.textContent = "";
      el.setAttribute("aria-label", text);
      el.setAttribute("data-odo-built", "1");
      var chars = Array.from(text);
      for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        if (/\d/.test(ch)) {
          var win = document.createElement("span");
          win.className = "odo-win";
          // 굴러가는 띠는 읽을 글자가 아니다 — 검사(craft·contrast)에서 뺀다. 멈춘 숫자는 사람이 본다.
          win.setAttribute("data-layout-ignore", "");
          var strip = document.createElement("span");
          strip.className = "odo-strip";
          strip.setAttribute("data-d", ch);
          for (var k = 0; k < 20; k++) {
            var s = document.createElement("span");
            s.textContent = DIG[k % 10];
            strip.appendChild(s);
          }
          win.appendChild(strip);
          el.appendChild(win);
        } else {
          var c = document.createElement("span");
          c.className = "odo-ch";
          c.textContent = ch === " " ? "\u00a0" : ch; // 빈칸은 inline-block 안에서 사라지므로 NBSP 로
          el.appendChild(c);
        }
      }
    }
  }

  /** 오도미터를 굴린다. 오른쪽 자리일수록 오래 돈다. 1.2~1.6 s 후 멈춰 그대로 선다. */
  function roll(tl, el, t, dur) {
    dur = dur || 1.35;
    var strips = el.querySelectorAll(".odo-strip");
    var n = strips.length;
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.06, ease: "none" }, t);
    for (var j = 0; j < n; j++) {
      var d = Number(strips[j].getAttribute("data-d"));
      // 띠는 20칸(0~9 두 바퀴). 칸 하나 = 띠 높이의 5%. 두 번째 바퀴의 d 에서 멈춘다.
      tl.fromTo(
        strips[j],
        { yPercent: 0 },
        { yPercent: -(10 + d) * 5, duration: dur * (0.7 + (0.3 * (j + 1)) / n), ease: "power3.out" },
        t,
      );
    }
  }

  /** 착지 흔들림 — 감쇠하는 다섯 번. 매 단계 fromTo 라 어느 시점에서 탐색해도 같다. */
  function shake(tl, el, t, amp) {
    amp = amp || 14;
    var xs = [0, amp, -amp * 0.65, amp * 0.4, -amp * 0.2, 0];
    var ys = [0, -amp * 0.35, amp * 0.3, -amp * 0.15, amp * 0.08, 0];
    for (var k = 0; k < xs.length - 1; k++) {
      tl.fromTo(
        el,
        { x: xs[k], y: ys[k] },
        { x: xs[k + 1], y: ys[k + 1], duration: 0.035, ease: "none", immediateRender: false },
        t + k * 0.035,
      );
    }
  }

  /** 크게 들어와 박히는 착지 — 블러 14 → 0, 0.24 s expo.out. */
  function slam(tl, el, t, from) {
    tl.fromTo(
      el,
      { scale: from || 1.7, opacity: 0, filter: "blur(14px)" },
      { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.24, ease: "expo.out" },
      t,
    );
  }

  /** 단어마다 블러가 걷히며 나타난다 — 0.13 s, 단어 사이 gap. 위치는 움직이지 않는다. */
  function words(tl, els, t, gap) {
    gap = gap || 0.08;
    for (var i = 0; i < els.length; i++) {
      tl.fromTo(
        els[i],
        { opacity: 0, filter: "blur(8px)" },
        { opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power2.out" },
        t + i * gap,
      );
    }
  }

  /** 바로 뜬다(하드컷) — 살짝 큰 데서 0.15 s 만에 자리 잡는다. */
  function pop(tl, el, t, from) {
    tl.fromTo(el, { opacity: 0, scale: from || 1.12 }, { opacity: 1, scale: 1, duration: 0.15, ease: "power4.out" }, t);
  }

  return { odo: odo, roll: roll, shake: shake, slam: slam, words: words, pop: pop };
})();
