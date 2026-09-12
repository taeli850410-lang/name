"use client";

export default function PrintButton() {
  return (
    <button className="btn" onClick={() => window.print()} title="브라우저 인쇄 대화상자에서 PDF로 저장">
      PDF·인쇄
    </button>
  );
}
