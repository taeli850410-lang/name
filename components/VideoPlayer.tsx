"use client";

import { useState } from "react";

/**
 * 대표 영상 플레이어. 처음에는 썸네일과 재생 단추만 그리고, 누르면 그 자리에서 유튜브를 띄웁니다.
 *
 * 처음부터 iframe 을 심지 않는 이유가 둘 있습니다.
 * ① 유튜브 iframe 하나가 수백 KB를 끌고 와서 브리핑 첫 화면이 느려집니다.
 * ② 이메일 클라이언트는 iframe 과 자바스크립트를 지웁니다. 지금 구조는 겉이 그냥 링크라
 *    스크립트가 없는 곳에서는 유튜브로 가는 링크로 남습니다.
 * 재생은 youtube-nocookie.com 으로 붙여 재생 전에는 추적 쿠키가 심기지 않습니다.
 */
export default function VideoPlayer({ id, title, thumb, url }: { id: string; title: string; thumb: string; url: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="vhero-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a
      className="vhero-frame vhero-facade"
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${title} 재생`}
      onClick={(e) => {
        // 스크립트가 도는 곳에서만 제자리 재생. 아니면 그냥 유튜브로 갑니다.
        e.preventDefault();
        setPlaying(true);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt="" loading="lazy" />
      <span className="vhero-play" aria-hidden="true">
        ▶
      </span>
    </a>
  );
}
