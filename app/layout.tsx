import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Real Estate Report Alert", template: "%s · Real Estate Report Alert" },
  description: "공인중개사무소를 위한 전국 부동산 정책·시장 브리핑. 중개사용 스튜디오와 고객용 EDM.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/*
          Pretendard 하나로 맞춥니다. 한글 본문용으로 만든 글꼴이라 자소 폭과 획 두께가 고르고,
          400~800 굵기가 다 있어 크기를 안 키우고도 위계를 세울 수 있습니다.

          dynamic-subset 판을 씁니다. 한글은 글자가 11,172자라 통째로 받으면 몇 MB인데,
          이쪽은 unicode-range 로 잘라 두어 그 편지에 실제로 쓰인 글자만 내려받습니다.
          고객이 휴대폰에서 여는 화면이라 이 차이가 큽니다.

          고정폭은 따로 안 받습니다. 숫자 몇 곳에만 쓰는데 글꼴 하나를 더 받을 이유가 없어,
          기기에 이미 있는 것을 씁니다.

          주소에 버전을 안 박았습니다. 버전을 잘못 적으면 404 가 나는데, 글꼴은 없어도 화면이
          안 깨지고 대체 글꼴로 그려져서 — 조용히 안 실린 채로 지나갈 수 있습니다. 버전을 빼면
          그 위험이 없어집니다.

          못 받아도 괜찮게 대체 글꼴을 제대로 쌓아 뒀습니다(globals.css 의 --font).
          아이폰은 Apple SD Gothic Neo, 안드로이드는 Noto Sans KR, 윈도우는 맑은 고딕으로
          떨어집니다. 셋 다 한글 본문용으로 쓸 만한 글꼴입니다.
        */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
