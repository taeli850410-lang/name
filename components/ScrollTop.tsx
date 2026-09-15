"use client";

import { useEffect, useState } from "react";

/**
 * 맨 위로 올라가는 단추.
 *
 * 브리핑 한 통이 390px 휴대폰에서 10,000px 쯤 됩니다 — 화면 스물다섯 장 분량이라, 다 읽고
 * 사무소 연락처를 다시 보려면 한참을 쓸어 올려야 했습니다.
 *
 * 처음부터 떠 있지는 않습니다. 한 화면 반쯤 내려간 뒤에 나타납니다 — 위에 있을 때는
 * 필요 없는 단추이고, 글 읽는 자리를 가리기만 합니다.
 */
export default function ScrollTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 스크롤은 손가락을 따라 수십 번씩 울립니다. passive 로 붙여 스크롤을 막지 않게 하고,
    // 다음 그리기 한 번으로 묶어 읽습니다.
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShow(window.scrollY > window.innerHeight * 1.5);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    // 움직임을 줄여 달라고 설정한 사람에게는 쓸어 올리지 않고 그냥 올립니다
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button type="button" className={`to-top${show ? " on" : ""}`} onClick={toTop} aria-label="맨 위로" tabIndex={show ? 0 : -1} aria-hidden={!show}>
      <span aria-hidden="true">↑</span>
      TOP
    </button>
  );
}
