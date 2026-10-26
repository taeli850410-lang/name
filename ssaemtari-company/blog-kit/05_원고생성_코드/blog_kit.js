const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle, LevelFormat,
  HeadingLevel, ExternalHyperlink, PageBreak, Footer, PageNumber,
} = require("docx");

const FONT = { ascii: "Malgun Gothic", eastAsia: "Malgun Gothic", hAnsi: "Malgun Gothic", cs: "Malgun Gothic" };
const W = 9638; // A4 content width with 2cm margins
const NAVY = "1F3A5F";
const BLUE = "2B6CB0";
const GRAY = "666666";

// **굵게**, ==형광펜== 마크업을 TextRun 배열로 변환
function runs(text, base = {}) {
  return text.split(/(\*\*.+?\*\*|==.+?==|\^\^.+?\^\^)/g).filter(Boolean).map((part) => {
    if (part.startsWith("^^")) return new TextRun({ ...base, text: part.slice(2, -2), bold: true, color: "1E40AF" });
    if (part.startsWith("**")) return new TextRun({ ...base, text: part.slice(2, -2), bold: true });
    if (part.startsWith("==")) return new TextRun({ ...base, text: part.slice(2, -2), highlight: "yellow" });
    return new TextRun({ ...base, text: part });
  });
}

const p = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run), spacing: { after: 160, line: 360 }, ...opts.para });
const note = (text) => new Paragraph({ children: runs(text, { size: 18, color: GRAY }), spacing: { before: 60, after: 200 } });
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text })],
  spacing: { before: 360, after: 160 },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: BLUE, space: 8 } },
});
const label = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 20, color: "FFFFFF" })],
  shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" },
  spacing: { before: 240, after: 160 },
});

const thin = { style: BorderStyle.SINGLE, size: 4, color: "BFC8D6" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

// keep: true 면 표 전체를 한 페이지에 모은다 (행이 페이지 사이에서 갈리지 않게)
function table(widths, rows, { header = true, emphasizeLast = false, alignLeft = false, keep = false } = {}) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((cells, r) => {
      const isHead = header && r === 0;
      const isEmph = emphasizeLast && r === rows.length - 1;
      const fill = isHead ? "E8EEF6" : isEmph ? "FFF4C2" : "FFFFFF";
      return new TableRow({
        tableHeader: isHead,
        cantSplit: keep,
        children: cells.map((c, i) => new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          borders,
          shading: { type: ShadingType.CLEAR, fill, color: "auto" },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          children: c.split("\n").map((t) => new Paragraph({
            alignment: i === 0 || (alignLeft && !isHead) ? AlignmentType.LEFT : AlignmentType.CENTER,
            keepNext: keep && r < rows.length - 1,
            children: runs(t, { bold: isHead || isEmph, size: 20 }),
          })),
        })),
      });
    }),
  });
}

// 사진 자리 표시 박스
function photo(n, what, caption) {
  const dash = { style: BorderStyle.DASHED, size: 8, color: BLUE };
  return [
    new Paragraph({ spacing: { after: 0 }, children: [] }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [new TableRow({ cantSplit: true, children: [new TableCell({
        width: { size: W, type: WidthType.DXA },
        borders: { top: dash, bottom: dash, left: dash, right: dash },
        shading: { type: ShadingType.CLEAR, fill: "EEF4FB", color: "auto" },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [
            new TextRun({ text: `[사진 ${n}]  `, bold: true, color: BLUE, size: 22 }),
            new TextRun({ text: what, bold: true, size: 22 }),
          ] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: "캡션: ", color: GRAY, size: 19 }),
            new TextRun({ text: caption, color: GRAY, size: 19 }),
          ] }),
        ],
      })] })],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

// 직접 경험 넣을 자리 (주황 점선 박스)
function exp(what, hint) {
  const ORANGE = "C05621";
  const dash = { style: BorderStyle.DASHED, size: 8, color: ORANGE };
  return [
    new Paragraph({ spacing: { after: 0 }, children: [] }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [new TableRow({ cantSplit: true, children: [new TableCell({
        width: { size: W, type: WidthType.DXA },
        borders: { top: dash, bottom: dash, left: dash, right: dash },
        shading: { type: ShadingType.CLEAR, fill: "FDF1E7", color: "auto" },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        children: [
          new Paragraph({ spacing: { after: 60 }, children: [
            new TextRun({ text: "[직접 경험 넣을 자리]  ", bold: true, color: ORANGE, size: 21 }),
            new TextRun({ text: what, bold: true, size: 21 }),
          ] }),
          new Paragraph({ children: [new TextRun({ text: hint, color: GRAY, size: 19 })] }),
        ],
      })] })],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

const num = (text, ref = "checks") => new Paragraph({
  numbering: { reference: ref, level: 0 },
  children: runs(text),
  spacing: { after: 120, line: 360 },
});
const bullet = (text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: runs(text, { size: 20 }),
  spacing: { after: 80, line: 320 },
});
const link = (title, url) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { after: 60 },
  children: [new ExternalHyperlink({ link: url, children: [new TextRun({ text: title, style: "Hyperlink", size: 19 })] })],
});

const KW = "1E40AF";
const GREEN = "047857";

// 박스형 블록 (요약·키워드·중개사 한 줄)
function box(title, lines, { fill = "EEF2FF", color = NAVY, bar = null } = {}) {
  const side = bar ? { style: BorderStyle.SINGLE, size: 24, color: bar } : thin;
  return [
    new Paragraph({ spacing: { after: 0 }, children: [] }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [new TableRow({ cantSplit: true, children: [new TableCell({
        width: { size: W, type: WidthType.DXA },
        borders: { top: bar ? { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } : thin, bottom: bar ? { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } : thin, right: bar ? { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } : thin, left: side },
        shading: { type: ShadingType.CLEAR, fill, color: "auto" },
        margins: { top: 140, bottom: 140, left: 240, right: 200 },
        children: [
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: title, bold: true, size: 21, color })] }),
          ...lines.map((l) => new Paragraph({ spacing: { after: 60, line: 340 }, children: runs(l, { size: 20 }) })),
        ],
      })] })],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}
const tip = (text) => box("중개사 한 줄", [text], { fill: "ECFDF5", color: GREEN, bar: "059669" });


// ───────── 쌤태리 블로그 형식용 블록 (2026.10 대표님 게시글 구조 반영) ─────────
const PURPLE = "6B21A8";
const RED = "B91C1C";
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

function dashedBox(color, fill, children) {
  const dash = { style: BorderStyle.DASHED, size: 8, color };
  return [
    new Paragraph({ spacing: { after: 0 }, children: [] }),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [new TableRow({ cantSplit: true, children: [new TableCell({
        width: { size: W, type: WidthType.DXA },
        borders: { top: dash, bottom: dash, left: dash, right: dash },
        shading: { type: ShadingType.CLEAR, fill, color: "auto" },
        margins: { top: 140, bottom: 140, left: 220, right: 220 },
        children,
      })] })],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}
const line = (label, text, color) => new Paragraph({ spacing: { after: 60, line: 330 }, children: [
  new TextRun({ text: label, bold: true, color, size: 20 }), ...runs(text, { size: 20 }),
] });

// 썸네일 카드 문구 (집 모양 카드: 지역 · 유형 · 매매가 · 왕관 줄 · 하단 태그 2개)
function thumb({ area, type, price, crown, tags, color }) {
  return dashedBox(RED, "FEF2F2", [
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "[썸네일 카드 문구]  대표 이미지 1장", bold: true, color: RED, size: 22 })] }),
    line("왼쪽 위 지역  ", area, RED),
    line("유형  ", type, RED),
    line("가운데 큰 글씨  ", price, RED),
    line("왕관 줄  ", crown, RED),
    line("하단 태그 2개  ", tags.join("  /  "), RED),
    line("카드 색  ", color, RED),
  ]);
}

// 인포그래픽 자리 (제목 · 들어갈 내용 · 하단 배너 문구)
function info(n, title, items, banner, caption) {
  return dashedBox(PURPLE, "F5F3FF", [
    new Paragraph({ spacing: { after: 80 }, children: [
      new TextRun({ text: `[인포그래픽 ${n}]  `, bold: true, color: PURPLE, size: 22 }),
      ...runs(title, { bold: true, size: 22 }),
    ] }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "들어갈 내용", bold: true, color: PURPLE, size: 20 })] }),
    ...items.map((t) => new Paragraph({ spacing: { after: 40, line: 320 }, indent: { left: 240 }, children: runs(`· ${t}`, { size: 20 }) })),
    line("하단 배너  ", `"${banner}"`, PURPLE),
    line("캡션  ", caption, PURPLE),
  ]);
}

// 실제 사진 · 영상 · 이전 글 링크 자리
function video(what, caption) {
  return dashedBox("4B5563", "F3F4F6", [
    line("[영상]  ", what, "374151"),
    line("캡션  ", caption, "374151"),
  ]);
}
function linkcard(what) {
  return dashedBox("374151", "F9FAFB", [line("[이전 글 링크 카드]  ", what, "111827")]);
}

// 가운데 인용구 (네이버 인용구 · 따옴표형, 가운데 정렬)
function quote(lines, sub) {
  return [
    new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }),
    ...lines.map((l) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60, line: 360 },
      children: [new TextRun({ text: l, size: 24, color: NAVY, italics: true })] })),
    ...(sub ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 },
      children: [new TextRun({ text: sub, size: 18, color: GRAY })] })] : []),
    new Paragraph({ spacing: { after: 240 }, children: [] }),
  ];
}

// 마무리 상담 안내 카드 문구
function contact(zone, services, closing) {
  return dashedBox(GREEN, "ECFDF5", [
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `[상담 안내 카드 문구]  ${zone} 매물 상담 안내`, bold: true, color: GREEN, size: 22 })] }),
    line("가운데 버튼  ", `${zone} 매물 상담`, GREEN),
    line("서비스 한 줄  ", services, GREEN),
    line("아래 문구  ", closing, GREEN),
    line("필수 표기  ", "중개사무소 명칭 · 소재지 · 연락처 · 등록번호 · 대표 공인중개사 성명 (공인중개사법 표시·광고 명시사항)", GREEN),
  ]);
}

const date = (d) => new Paragraph({ spacing: { after: 200 },
  children: [new TextRun({ text: `N부동산 매물현황 ${d}  매물은 실시간 확인이 필요하므로 반드시 전문가와 상담하세요.`, size: 16, color: GRAY })] });
const title = (text) => new Paragraph({ spacing: { after: 200, line: 400 },
  children: [new TextRun({ text, bold: true, size: 32, color: NAVY })] });

function legend() {
  const item = (text, run, desc) => [new TextRun({ text, size: 19, ...run }), new TextRun({ text: ` = ${desc}   |   `, size: 19, color: GRAY })];
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      borders,
      shading: { type: ShadingType.CLEAR, fill: "F6F7F9", color: "auto" },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "표시 기준", bold: true, size: 20, color: NAVY })] }),
        new Paragraph({ spacing: { after: 40, line: 320 }, children: [
          ...item("파란 굵은 글씨", { bold: true, color: KW }, "핵심 키워드"),
          ...item("노란 형광", { highlight: "yellow" }, "형광펜"),
          ...item("가운데 기울임", { italics: true, color: NAVY }, "인용구(따옴표형, 가운데)"),
          ...item("초록 박스", { bold: true, color: GREEN }, "중개사 한 줄(인용구 박스형)"),
          ...item("[썸네일] 빨강", { bold: true, color: RED }, "대표 이미지 문구"),
          ...item("[인포그래픽] 보라", { bold: true, color: PURPLE }, "직접 만드실 이미지 문구"),
          ...item("[사진] 파랑", { bold: true, color: BLUE }, "현장 사진"),
          new TextRun({ text: "[영상]·[이전 글 링크] 회색", bold: true, size: 19, color: "374151" }),
          new TextRun({ text: " = 영상·링크 카드 자리", size: 19, color: GRAY }),
        ] }),
      ],
    })] })],
  });
}

// 해시태그 (한 줄에 5개, 파란 글씨) — 예시_신용산북측1구역_v2.js 와 같은 모양
function hashtags(tags) {
  const rows = [];
  for (let i = 0; i < tags.length; i += 5) rows.push(tags.slice(i, i + 5));
  return [
    new Paragraph({
      keepNext: true,
      children: [new TextRun({ text: "  해시태그", bold: true, size: 20, color: "FFFFFF" })],
      shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" },
      spacing: { before: 240, after: 160 },
    }),
    ...rows.map((r) => new Paragraph({
      spacing: { after: 60, line: 360 },
      keepNext: true, keepLines: true,
      children: [new TextRun({ text: r.map((t) => "#" + t).join("   "), color: BLUE, size: 21 })],
    })),
  ];
}

// 작성자 참고용 페이지 머리 (새 페이지에서 시작, 블로그에는 올리지 않는 부분)
function refPage() {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: "작성자 참고용 (블로그에는 올리지 마세요)", bold: true, size: 26, color: NAVY })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
    }),
  ];
}

function buildDoc(children, docTitle, out) {
  const doc = new Document({
    creator: "쌤태리 부동산 컨설팅",
    title: docTitle,
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT, size: 26, bold: true, color: NAVY }, paragraph: { outlineLevel: 1, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        { reference: "checks", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 440, hanging: 360 } }, run: { bold: true, color: BLUE } } }] },
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 440, hanging: 300 } } } }] },
        // 작성자 참고용 페이지의 제목 후보 번호 (체크리스트 번호와 따로 센다)
        { reference: "titles", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 440, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY })] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out); });
}

module.exports = {
  Paragraph, TextRun, PageBreak, AlignmentType, W, NAVY, BLUE, GRAY, GREEN, KW, PURPLE, RED,
  runs, p, note, h2, label, table, photo, exp, num, bullet, link, box, tip,
  thumb, info, video, linkcard, quote, contact, date, title, legend, hashtags, refPage, buildDoc,
};
