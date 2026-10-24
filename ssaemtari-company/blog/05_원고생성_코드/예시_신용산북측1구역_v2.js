const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle, LevelFormat,
  HeadingLevel, ExternalHyperlink, PageBreak, Footer, PageNumber,
} = require("docx");

const OUT = process.argv[2];
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

function table(widths, rows, { header = true, emphasizeLast = false } = {}) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((cells, r) => {
      const isHead = header && r === 0;
      const isEmph = emphasizeLast && r === rows.length - 1;
      const fill = isHead ? "E8EEF6" : isEmph ? "FFF4C2" : "FFFFFF";
      return new TableRow({
        tableHeader: isHead,
        children: cells.map((c, i) => new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          borders,
          shading: { type: ShadingType.CLEAR, fill, color: "auto" },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          children: [new Paragraph({
            alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
            children: runs(c, { bold: isHead || isEmph, size: 20 }),
          })],
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
      rows: [new TableRow({ children: [new TableCell({
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
      rows: [new TableRow({ children: [new TableCell({
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
      rows: [new TableRow({ children: [new TableCell({
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

const children = [
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      borders,
      shading: { type: ShadingType.CLEAR, fill: "F6F7F9", color: "auto" },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "표시 기준", bold: true, size: 20, color: NAVY })] }),
        new Paragraph({ spacing: { after: 40 }, children: [
          new TextRun({ text: "굵은 글씨", bold: true, size: 19 }), new TextRun({ text: " = 볼드   |   ", size: 19, color: GRAY }),
          new TextRun({ text: "파란 굵은 글씨", bold: true, color: KW, size: 19 }), new TextRun({ text: " = 핵심 키워드 (네이버 글자색 파랑 + 볼드)   |   ", size: 19, color: GRAY }),
          new TextRun({ text: "노란 형광", highlight: "yellow", size: 19 }), new TextRun({ text: " = 형광펜   |   ", size: 19, color: GRAY }),
          new TextRun({ text: "[사진 n] 파란 점선 박스", bold: true, color: BLUE, size: 19 }), new TextRun({ text: " = 사진 자리   |   ", size: 19, color: GRAY }),
          new TextRun({ text: "[직접 경험] 주황 박스", bold: true, color: "C05621", size: 19 }), new TextRun({ text: " = 실제 겪은 일을 써넣을 자리 (못 채우면 삭제)   |   ", size: 19, color: GRAY }),
          new TextRun({ text: "초록 박스", bold: true, color: GREEN, size: 19 }), new TextRun({ text: " = 네이버 인용구(박스형)로 넣기", size: 19, color: GRAY }),
        ] }),
      ],
    })] })],
  }),

  label("  제목"),
  new Paragraph({
    spacing: { after: 200, line: 400 },
    children: [new TextRun({ text: "신용산 북측1구역 근생 19.5억 매물, 아파트 자격부터 따져본 진짜 계산", bold: true, size: 32, color: NAVY })],
  }),

  label("  본문"),
  new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: "N부동산 매물현황 2026.10.20  매물은 실시간 확인이 필요하므로 반드시 전문가와 상담하세요.", size: 16, color: GRAY })],
  }),
  p("용산, 그것도 ^^신용산역^^ 바로 앞. 롯데건설이 하이엔드 브랜드 '르엘'을 제안한 ^^신용산역 북측1구역^^에서 19억5,000만 원짜리 매물이 나왔습니다. 그런데 정체는 아파트도, 빌라도 아닌 **대지 3.8평짜리 상가(근린생활시설) 한 칸**입니다."),
  p("이 숫자 앞에서 마음은 두 갈래로 갈립니다. '용산 신축 한 채를 이 값에?' 하는 설렘, 그리고 '상가가 20억? 내가 모르는 함정이 있는 건 아닐까' 하는 불안. 둘 다 맞는 감정입니다. 이 글은 그 불안을 숫자와 서류로 하나씩 지워 보려고 씁니다."),
  p("==결론부터 말씀드리면, 이 매물은 가격보다 '이 상가가 정말 아파트 한 채가 되느냐'를 먼저 확인해야 하는 매물입니다.=="),

  ...box("3줄 요약", [
    "1. 19억5,000만 원 중 약 70%(13억7,350만 원)가 **프리미엄**입니다. 시장은 이 상가에 '아파트 한 채' 값을 매기고 있습니다.",
    "2. 상가는 주택이 아니라서, **권리가액이 최소 평형 분양가 이상**이어야 아파트를 받습니다. 서류 확인이 1순위입니다.",
    "3. 지금 시세로는 옆 신축 84㎡(29억7,500만 원)보다 총비용이 약 3억5,000만 원 높습니다. 그 차이는 '완공 시점의 용산'에 거는 값입니다.",
  ]),
  ...box("이 글의 핵심 키워드 · 목차", [
    "**키워드** · 신용산역 북측1구역 · 근생 매물 · 아파트 분양자격 · 권리가액 · 비례율 · 프리미엄 한계선 · 관리처분 · 토지거래허가 · 신용산 르엘",
    "**목차** · ① 매물 숫자 ② 상가가 19.5억인 이유 ③ 아파트 분양자격 ④ 옆 신축과 비교한 프리미엄 한계선 ⑤ 관리처분 앞둔 사업 단계 ⑥ 계약 전 체크리스트",
  ], { fill: "F8FAFC", color: NAVY }),

  h2("① 신용산역 북측1구역 근생 매물, 숫자부터 보세요"),
  table([3600, 6038], [
    ["항목", "내용"],
    ["위치", "용산구 한강로2가 (신용산역 북측 제1구역 안)"],
    ["건물 용도", "근린생활시설 (2008년 5월 1일 사용승인)"],
    ["대지", "3.80평 (약 12.56㎡)"],
    ["전용면적", "8.53평 (약 28.2㎡)"],
    ["추정 감정평가액", "약 5억7,650만 원"],
    ["추정 프리미엄", "약 13억7,350만 원"],
    ["매매가", "19억5,000만 원"],
  ], { emphasizeLast: true }),
  note("※ 감정평가액은 작성자 분석 기준 추정치입니다. 실제 금액은 조합의 종전자산 감정평가 통지서로 확인해야 합니다."),
  ...photo(1, "매물 외관 · 구역 현장 사진", "신용산역 북측1구역 근생 매물"),
  ...exp("매물을 직접 보러 갔을 때 느낀 점 1~2줄 (선택)", "[○월 ○일] 이 매물을 직접 보러 갔습니다. 신용산역 [○번 출구]에서 걸어서 [○분], 주변은 [분위기], 건물은 [상태]였습니다. [솔직한 느낌 한 줄]. ← 대괄호는 실제로 본 내용으로 채우고, 못 채우면 박스째 삭제"),
  ...photo(2, "매물 분석표 이미지 (대지 3.80평 · 매매 19.5억)", "신용산 북측1구역 근생 매물 분석표"),
  ...tip("같은 동의 근생 호실이 2억 원 안팎에 거래되는 걸 기준으로 보면, 이 매물 가격의 대부분은 '상가'가 아니라 **'아파트 자격'에 붙은 값**입니다."),

  h2("② 상가 한 칸이 19.5억인 이유: 시장은 '아파트 한 채'를 사고 있습니다"),
  p("국토교통부 실거래 공개자료에서 한강로2가 거래 가운데, 지번이 한 자리(2번지 추정)로 표시되거나 신용산역 북측 구역 지번인 최근 거래를 모았습니다. 아래 두 줄은 '상가 자체의 값'을 가늠하기 위한 같은 동 근생 호실 거래입니다."),
  table([1450, 2200, 1000, 1950, 1600, 1438], [
    ["계약일", "유형 (지번)", "준공", "대지", "거래가", "대지 평당가"],
    ["2026.07.08", "토지 · 일반상업 (한 자리)", "-", "5.6㎡ (1.69평)", "5억", "2억9,586만"],
    ["2026.02.19", "단독 (한 자리)", "1985", "50.6㎡ (15.31평)", "19억7,000만", "1억2,867만"],
    ["2025.07.04", "단독 (한 자리)", "1956", "36.7㎡ (11.1평)", "15억", "1억3,514만"],
    ["2025.06.16", "연립 (2-194, 북측2구역)", "1981", "67.13㎡ (20.31평)", "24억5,000만", "1억2,065만"],
    ["2025.05.22", "단독 (한 자리)", "1985", "72.7㎡ (21.99평)", "22억", "1억5만"],
    ["2026.08.26", "근생 호실 (구역 밖 주거지역)", "2008", "전용 22.56㎡", "2억", "-"],
    ["2026.08.14", "근생 호실 (구역 밖 주거지역)", "2008", "전용 40.32㎡", "1억9,500만", "-"],
    ["이 매물", "근생 (북측1구역)", "2008", "12.56㎡ (3.80평)", "19억5,000만", "5억1,316만"],
  ], { emphasizeLast: true }),
  note("※ 지번 일부가 가려진 거래는 구역 안인지 확인하지 못했습니다. 해제(취소)된 거래와 직거래는 뺐습니다. 근생 호실 2건은 구역 밖 다른 건물이라 단순 참고용입니다."),
  ...photo(3, "재개발 앱 실거래 그래프 · 거래 목록 캡처", "신용산역 북측1구역 일대 실거래"),
  p("이 표에서 가장 눈에 띄는 건 두 숫자입니다. 대지 3.8평 상가 19억5,000만 원, 대지 15평 단독 19억7,000만 원. 땅 크기는 4배 차이인데 값은 거의 같습니다. ==시장이 둘 다 '새 아파트 한 채'로 보고 있다는 뜻입니다.=="),
  p("대지 평당가로 바꾸면 이 매물은 **5억1,316만 원**, 주변 단독의 약 4배입니다. 이 값이 정당화되는 조건은 단 하나, '아파트 자격이 확실할 때'입니다. 그래서 다음 장이 이 글에서 가장 중요합니다."),
  ...tip("단독주택은 '집'이라 분양 대상이 비교적 분명합니다. 상가는 **조건부**입니다. 같은 19억대라도 확인할 서류의 무게가 다릅니다."),

  h2("③ 가장 먼저 확인할 것: 상가(근생) 소유자의 아파트 분양자격"),
  p("근린생활시설은 주택이 아닙니다. 그래서 서울시 조례상 상가 소유자가 아파트를 받으려면 둘 중 하나를 충족해야 합니다. 종전 토지가 **90㎡ 이상**이거나, ^^권리가액^^이 **분양용 최소규모 공동주택 1가구 추산액 이상**이어야 합니다. 이 매물은 대지가 12.56㎡라 두 번째 길, 권리가액으로 판단해야 합니다."),
  p("^^권리가액^^은 '감정평가액 × ^^비례율^^'입니다. 비례율은 사업이 끝난 뒤 남는 가치(종후자산에서 사업비를 뺀 금액)를 종전자산 총액으로 나눈 비율로, 사업성이 좋을수록 올라갑니다. 비례율은 관리처분 단계에서 정해지기 때문에, 지금은 범위로 보는 게 정직합니다."),
  table([3200, 6438], [
    ["비례율 (가정)", "권리가액 (추정 감정 5억7,650만 원 기준)"],
    ["90%", "약 5억1,885만 원"],
    ["100%", "약 5억7,650만 원"],
    ["110%", "약 6억3,415만 원"],
  ]),
  note("※ 이해를 돕기 위한 가정 계산입니다. 실제 비례율과 감정평가액은 조합 통지 기준으로 확인해야 합니다."),
  p("이제 이 숫자를 이 구역 분양용 최소 평형(2022년 건축심의 보도 기준 전용 20~39㎡대)의 조합원 분양가와 나란히 놓으면 답이 나옵니다. 최소 평형 분양가는 분양신청 안내문에 나와 있습니다."),
  p("이 비교 하나에 13억7,350만 원 프리미엄의 운명이 걸려 있습니다. 확인 없이 계약하는 건, 19억5,000만 원을 '아마도' 위에 올려놓는 일입니다. ==권리가액이 최소 평형 분양가에 못 미치면, 아파트 대신 상가 분양이나 현금청산이 될 수 있습니다.=="),
  ...tip("저라면 계약 전에 딱 세 장부터 봅니다. **감정평가 통지서, 분양신청서, 조합의 분양대상자 통지.** 이 세 장이 맞으면 그다음이 가격 이야기입니다."),

  h2("④ 총투자금 33억 vs 옆 신축 84㎡ 29.7억: 프리미엄 한계선"),
  table([3600, 6038], [
    ["항목 (분양가 19.5억 가정)", "금액"],
    ["매매가", "19억5,000만 원"],
    ["추정 감정평가액", "약 5억7,650만 원"],
    ["조합원 분양가 (가정)", "19억5,000만 원"],
    ["추정 분담금", "약 13억7,350만 원"],
    ["총투자금", "약 33억2,350만 원"],
  ], { emphasizeLast: true }),
  p("같은 한강로2가에서 2025년에 준공한 호반써밋 A.DITION 전용 84㎡가 2025년 11월 **29억7,500만 원**에 거래됐습니다(국토교통부 실거래, 1건). 84㎡를 받는다고 가정하고 나란히 놓으면 이렇습니다."),
  table([3400, 6238], [
    ["계산 (84㎡ 가정)", "금액"],
    ["옆 신축 84㎡ 실거래", "29억7,500만 원"],
    ["조합원 분양가 (가정)", "19억5,000만 원"],
    ["지금 기준 프리미엄 한계선", "약 10억2,500만 원"],
    ["이 매물의 추정 프리미엄", "약 13억7,350만 원 (한계선보다 약 3억4,850만 원 높음)"],
  ], { emphasizeLast: true }),
  note("※ 비교 신축은 1건 거래라 시세로 단정하기 어렵습니다. 입주까지의 시간·이자·세금은 반영하지 않았습니다."),
  p("솔직히 이 계산에서 한 번 멈칫하게 됩니다. 지금 시세로만 보면, 몇 년을 기다려 새집을 받는 쪽이 이미 지어진 옆 신축을 사는 것보다 3억 원 넘게 비쌉니다."),
  p("그런데도 이 가격에 사는 사람은 무엇을 보고 살까요. 신용산역 바로 북쪽의 지상 38층, ^^신용산 르엘^^ 제안, 업무·판매시설이 함께 들어서는 복합단지, 그리고 2025년 11월 첫 삽을 뜬 용산국제업무지구입니다. ==이 매물의 프리미엄은 지금 시세로는 설명되지 않고, '완공 시점의 용산'을 얼마나 믿느냐에 달려 있습니다.=="),
  ...photo(4, "신용산역 북측1구역과 주변 신축 · 용산국제업무지구 위치 지도", "신용산역 북측1구역 주변 개발 위치"),
  ...tip("지금 시세보다 싸게 사고 싶은 분께는 맞지 않는 매물입니다. 이 거래는 **'용산의 10년 뒤'에 대한 확신**을 사는 거래입니다. 그 확신이 있을 때만 들어오세요."),

  h2("⑤ 관리처분 앞둔 신용산역 북측1구역, 지금이 왜 중요한가"),
  table([2600, 7038], [
    ["시점", "내용"],
    ["2015", "서울시 신용산역 북측 정비구역 결정 (1·2구역, 서울시 정비사업 현황 데이터 기준)"],
    ["2023.01", "정비구역 변경 (구역면적 13,963.1㎡, 용산구 고시)"],
    ["2023.12.01", "사업시행계획인가 고시"],
    ["2025.01.11", "시공사 롯데건설 선정 (공사비 약 3,522억, '신용산 르엘' 제안)"],
    ["2026 (목표)", "관리처분계획 (작성자 분석표 기준)"],
  ]),
  p("계획은 지하 7층~지상 38층 아파트 324세대(분양 295·공공 29)와 지상 28층 업무동, 저층 판매시설입니다. 2022년 건축심의 보도 기준 평형은 전용 20·27·39·59·74·84·112㎡이고, 84㎡가 119세대로 가장 많습니다. 건축물대장 기준으로 구역 건물의 87.1%가 30년을 넘었습니다."),
  p("여기서 꼭 알아야 할 규칙이 있습니다. 용산구는 투기과열지구라, 재개발은 ^^관리처분^^계획인가 이후에 산 사람은 원칙적으로 조합원이 될 수 없습니다. ==즉, 이 매물은 '조합원 자격을 이어받으며 살 수 있는 시간'이 정해져 있습니다.=="),
  p("시간이 정해져 있으면 마음이 급해집니다. 그럴수록 서류는 더 천천히 보셔야 합니다. 급하게 산 매물이 가장 오래 발목을 잡습니다."),
  ...photo(5, "조감도 (출처 표기 필수)", "신용산역 북측1구역 재개발 조감도"),
  ...tip("'2026년 관리처분'이 인가 신청인지, 인가 완료인지에 따라 이 매물의 가치가 완전히 달라집니다. **인가 시점부터 확인**하세요."),

  h2("⑥ 신용산역 북측1구역 근생 매물, 계약 전 체크리스트"),
  num("**아파트 분양대상 통지**: 권리가액이 최소 평형 분양가 이상인지, 조합이 아파트 분양대상으로 통지했는지 서류로 확인하세요."),
  num("**분양신청 여부와 평형**: 매도인이 분양신청을 했는지, 어떤 평형으로 했는지 확인하세요. 신청하지 않았다면 현금청산 대상입니다."),
  num("**관리처분 인가 시점**: 인가 이후 매수는 원칙적으로 조합원 지위를 받을 수 없습니다. 예외 규정은 계약 전 전문가에게 확인하세요."),
  num("**토지거래허가**: 건축물대장 규제 정보상 구역 전체가 ^^토지거래허가^^구역입니다. 대지 12.56㎡는 용도지역에 따라 허가 대상 여부가 갈립니다(서울시 기준면적: 주거지역 6㎡·상업지역 15㎡ 초과)."),
  num("**자금과 세금**: 상가는 주택과 대출·취득세 기준이 다릅니다. 매매가에 분담금(가정)까지 **총 33억 원대 자금 계획**이 먼저입니다."),
  ...photo(6, "'계약 전 체크리스트 5' 카드 이미지", "신용산 북측1구역 근생 매물 계약 전 체크리스트"),
  ...exp("실제 상담에서 받은 질문 1줄 (선택)", "이 구역 상가 매물 문의 때 가장 먼저 나온 질문은 [실제 질문]이었습니다. [그때 드린 답 한 줄]. ← 실제 있었던 일만 쓰고, 없으면 박스째 삭제"),

  h2("이런 분께 맞고, 이런 분은 기다리는 편이 낫습니다"),
  p("**맞는 분** · 용산의 10년 뒤를 믿고, 33억 원대 자금을 무리 없이 감당할 수 있으며, 아파트 분양대상 통지까지 서류로 확인한 매물을 찾은 분."),
  p("**기다리실 분** · 분양자격이 서류로 확인되지 않는 매물을 보고 있는 분, 대출 비중이 큰 분, 지금 시세보다 싸게 사고 싶은 분. 지금 시세만 보면 이미 지어진 옆 신축이 더 쌉니다."),

  h2("마치며"),
  p("용산에 새집 한 채. 그 꿈이 얼마나 강한지 잘 압니다. 그래서 더 냉정하게 말씀드립니다."),
  p("==이 매물은 '19억5,000만 원이 비싸냐'보다 '이 상가가 정말 아파트 한 채가 되느냐'를 먼저 확인해야 합니다.== 그다음이 '완공 시점의 용산에 지금 3억 원 넘는 웃돈을 낼 만큼 확신이 있느냐'입니다. 순서를 바꾸면 안 되는 매물입니다."),
  p("감정평가 통지서와 분양신청 서류, 평형별로 필요한 자금은 상담 때 하나씩 함께 짚어 드리겠습니다."),
  ...photo(7, "중개사무소 정보 (명함형 이미지 1장)", "신용산 북측1구역 매물 상담 안내"),

  new Paragraph({
    keepNext: true,
    children: [new TextRun({ text: "  해시태그", bold: true, size: 20, color: "FFFFFF" })],
    shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" },
    spacing: { before: 240, after: 160 },
  }),
  ...[["신용산북측1구역", "신용산역북측1구역", "신용산르엘", "롯데르엘", "용산재개발"], ["한강로2가", "근생매물", "재개발상가", "권리가액", "관리처분"]].map((tags) => new Paragraph({
    spacing: { after: 60, line: 360 },
    keepNext: true, keepLines: true,
    children: [new TextRun({ text: tags.map((t) => "#" + t).join("   "), color: BLUE, size: 21 })],
  })),

  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: "작성자 참고용 (블로그에는 올리지 마세요)", bold: true, size: 26, color: NAVY })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
  }),
  h2("이번에 바뀐 점"),
  bullet("본문 맨 위에 작은 회색 글씨로 'N부동산 매물현황 2026.10.20  매물은 실시간 확인이 필요하므로 반드시 전문가와 상담하세요.'를 넣었습니다. 네이버 에디터에서 글자 크기를 11~13 정도로 줄여 주세요."),
  bullet("독자가 첫 화면에서 답을 얻도록 '3줄 요약' 박스를, 검색·가독성을 위해 '핵심 키워드 · 목차' 박스를 넣었습니다. 소제목에도 신용산역 북측1구역·관리처분 같은 핵심 키워드를 넣어 네이버 색인에 걸리기 쉽게 했습니다."),
  bullet("핵심 키워드(신용산역, 신용산역 북측1구역, 권리가액, 비례율, 신용산 르엘, 관리처분, 토지거래허가)는 파란 굵은 글씨로 표시했습니다. 키워드는 문장 안에 자연스럽게 1~2번씩만 넣었습니다."),
  bullet("'중개사 한 줄' 초록 박스 5곳은 네이버 인용구(박스형)로 넣으면 됩니다. 전문가의 판단이 한눈에 보이도록 만든 장치입니다."),
  bullet("감정은 약 30%로 늘렸습니다(설렘과 불안, 멈칫하는 순간, 급해지는 마음 등). '저라면 세 장부터 본다'는 대표님 판단으로 쓴 문장이니, 실제 기준과 다르면 고쳐 주세요."),
  bullet("형광펜은 6곳입니다."),
  h2("가장 먼저 확인할 것 (이전과 같음)"),
  bullet("이 매물이 아파트 분양대상인지(권리가액 ≥ 분양용 최소규모 공동주택 1가구 추산액)를 매도인의 분양신청서, 조합의 분양대상 통지, 감정평가 통지서로 확인한 뒤 게시를 권합니다."),
  bullet("'2026년 내 관리처분'이 인가 신청인지 인가 완료인지 확인해 주세요."),
  h2("게시 전에 확인할 것"),
  bullet("비례율 90·100·110% 표는 이해를 돕기 위한 가정 계산입니다. 실제 비례율은 관리처분계획에서 정해집니다."),
  bullet("조합원 분양가 19.5억이 어느 평형 기준인지 확인되지 않아, 옆 신축 비교는 '84㎡ 가정'으로 적었습니다."),
  bullet("옆 신축 비교는 호반써밋 A.DITION(2025년 준공) 84.28㎡ 2025년 11월 거래 1건입니다."),
  bullet("구역 일대 실거래는 지번이 한 자리로 가려진 거래라 구역 안인지 확인하지 못했습니다. 2-194는 북측 2구역 지번입니다. 근생 호실 2건은 구역 밖 다른 건물입니다."),
  bullet("평형 구성은 2022년 건축심의 보도 기준, 2026년 관리처분은 분석표 기준입니다."),
  bullet("토지거래허가 기준면적과 투기과열지구 조합원 지위 제한은 일반 원칙으로 적었습니다. 개별 매물은 구청·전문가 확인이 필요합니다."),
  h2("출처"),
  link("한국경제 – 신용산역 북측 1구역 따낸 롯데…한강변 프리미엄 주거벨트 조성 (2025.01)", "https://www.hankyung.com/article/2025011331441"),
  link("서울경제 – 롯데건설, 신용산역 북측 제1구역 재개발 수주…3522억 규모", "https://www.sedaily.com/article/14014854"),
  link("위클리한국주택경제 – 신용산역북측제1, 사업시행인가… 최고 38층 324세대 건립", "http://www.arunews.com/news/articleView.html?idxno=42036"),
  link("서울경제 – 신용산역 북측 제1구역 재개발, 324가구 규모로…임대 29가구 포함", "https://www.sedaily.com/article/13376195"),
  link("이투데이 – 서울 신용산역 북측 1구역, 38층 규모 324가구 아파트 재개발", "https://www.etoday.co.kr/news/view/2128467"),
  link("머니투데이 – [법] 재개발 구역 내 근린생활시설, 매수하면 분양권 받을 수 있을까? (2025.08)", "https://www.mt.co.kr/industry/2025/08/25/2025082517221717995"),
  link("한국경제 – 재개발아파트 상가 주인, 아파트 분양받을 수 있을까", "https://www.hankyung.com/article/202404194198Q"),
  link("국가법령정보센터 – 서울특별시 도시 및 주거환경정비 조례", "https://www.law.go.kr/LSW//ordinSideInfoP.do?ordinSeq=1792923&chrClsCd=010202&joNo=0036&joBrNo=00&docCls=jo&urlMode=ordinScJoRltInfoR"),
  bullet("국토교통부 실거래 공개자료 (용산구 한강로2가 연립·단독·토지·상업업무용·아파트 매매, 2024.11~2026.09)"),
  bullet("서울시 정비사업 현황 OA-20281 (신용산역 북측 제1구역 정비구역 변경 13,963.1㎡)"),
  bullet("건축물대장 구역 집계 (신용산역 북측 제1구역: 노후도·규제 정보)"),
];

const doc = new Document({
  creator: "투유부동산컨설팅",
  title: "신용산 북측1구역 매물 블로그 원고",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 26, bold: true, color: NAVY }, paragraph: { outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "checks", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 440, hanging: 360 } }, run: { bold: true, color: BLUE } } }] },
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 440, hanging: 300 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT); });
