// 티스토리 매물 글 구조 가이드(.docx) — STRUCTURE.md 와 같은 내용을 한 장짜리 문서로 만든다.
// 사용법: node render_guide.js <출력 파일.docx>
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, AlignmentType, LevelFormat, Footer, PageNumber, HeadingLevel,
} = require('docx');

const out = process.argv[2];
const W = 9638, FONT = 'Malgun Gothic';
const NAVY = '1F3A5F', BLUE = '2B6CB0', GRAY = '666666', LINE = 'BFC8D6', RED = 'D32F2F';

const t = (text, o = {}) => new TextRun({ text, ...o });
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 120, line: 300 }, ...o });
const h1 = text => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 120 }, children: [t(text, { bold: true, color: NAVY, size: 36 })] });
const h2 = text => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 140 },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: NAVY, space: 8 } }, children: [t(text, { bold: true, color: NAVY, size: 26 })] });
const bullet = (children, ref = 'bul') => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 300 },
  children: Array.isArray(children) ? children : [t(children)] });
const line = { style: BorderStyle.SINGLE, color: LINE, size: 4 };
const borders = { top: line, bottom: line, left: line, right: line };

function table(head, rows, widths, { emph = [] } = {}) {
  const cell = (content, w, { headRow = false, em = false } = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: headRow ? { fill: 'E8EEF6', type: ShadingType.CLEAR, color: 'auto' } : em ? { fill: 'FFF4C2', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    children: String(content).split('\n').map(s => new Paragraph({ spacing: { after: 30 }, children: [t(s, { size: 18, bold: headRow || undefined })] })),
  });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: [
    new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, widths[i], { headRow: true })) }),
    ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { em: emph.includes(ri) })) })),
  ] });
}

const order = [
  ['0', '대표 이미지', '매물 카드(구역명 · 유형 · 매매가 · 프리미엄 · 세대수 · 진행 단계)\n바로 아래 작은 글씨: ※ 매물 현황은 ○년 ○월 ○일 기준입니다…', '티스토리 대표 이미지로 지정'],
  ['-', '도입 3줄', '어떤 매물이 나왔나 → 가장 궁금한 것 → 이 글에서 다루는 것', '한 문장 = 한 문단'],
  ['1', '매물 한눈에 보기:\n{역 도보} {단지명} {층}', '표: 매매가 · 추정 감정가 · 프리미엄 · 조합원 분양가(가정) · 예상 분담금 · 총투자금 · 위치 · 건물 · 면적 · 임대·입주\n표 아래 한 문장씩 설명', '매매가·총투자금 행 강조\n핵심 한 줄 형광펜, 숫자 굵게'],
  ['2', '{구역}은 어떤 사업인가', '소개 한 문단 → 소제목 \'구역 개요\' + 표(위치·면적·계획·구역 안 시설·노후도·규제·현재 단계) + 출처 주석\n조감도 → 위치 지도 (각 캡션)', '조감도·지도 출처 표기'],
  ['3', '지금 어디까지 왔을까', '한 문단 → 연표 표 + 출처 주석 → 사업 단계 인포그래픽', '지금 단계 행 강조, 형광펜 한 줄'],
  ['4', '입지: {한 줄 요약}', '거리 표 + 기준 주석 → 짧은 문단 2~3개 → 생활 환경 지도', '거리 기준(도보/직선) 밝히기'],
  ['5', '구역 안 비슷한 매물 N개와 비교', '비교 표 + 자료 주석\n소제목 \'{단지명}이 추천 매물인 이유\' → 주목할 N가지 이유 이미지 → 번호 목록\n정리 한 줄\n소제목 \'같은 평형을 받는다고 놓으면: 총투자금 순서.\' → 총투자금 표 → 결론 한 줄', '정리·결론 줄 형광펜'],
  ['6', '인근 구역과 대지 평당가 비교', '한 줄 소개 → 표 → 짧은 문단 2개', '마지막 줄 형광펜'],
  ['-', '이런 분께 맞습니다', '연한 파란 박스: 글머리표 3개 + 마지막 한 줄', '마지막 줄 빨간 굵은 글씨'],
  ['7', 'Q&A로 한 번 더 정리', '5문항 안팎', '답의 핵심 구절 빨간 글씨 가능'],
  ['8', '마무리', '한 문단 → 단지 이미지(캡션) → 인용구 \'자세한 사항은 상담으로 문의주세요.^^\' → 상담 배너', '연출 이미지면 캡션에 \'연출\''],
  ['-', '태그 10개', '구역명 · 구역명 재개발 · 구역명 매물 · 역 빌라 · 뉴타운명 · 지역 재개발 · 사업 방식 · 토지거래허가(해당 시) · 단지명 · 쌤태리부동산', '# 없이 쉼표로'],
];

const children = [
  h1('티스토리 매물 글 구조 가이드'),
  p([t('기준 글: 마천2구역 게시본 (moneyclass19.tistory.com 41번 글, 2026.11.15)', { size: 19, color: GRAY })]),
  p([t('앞으로 티스토리 매물 글은 이 구조로 만듭니다. 대표님이 실제로 올린 글에서 남기고 뺀 것을 그대로 따릅니다.', { size: 20 })]),

  h2('제목 형식'),
  p([t('재개발 {구역명} {세대수}세대 {사업 방식} – 추천매물!', { bold: true, color: BLUE, size: 24 })]),
  p([t('예) 재개발 마천2구역 1,729세대 신통기획 – 추천매물!', { size: 19, color: GRAY })]),

  h2('글 순서'),
  table(['번호', '섹션', '들어가는 것', '강조 · 메모'], order, [700, 2200, 4538, 2200], { emph: [] }),

  h2('넣지 않는 것 (게시본에서 뺀 것)'),
  ...['핵심 요약 박스, 목차', '직접 경험(주황) 박스, 중개사 한 줄(초록) 박스, 영상 자리',
    '투자 가능성 비교(기대/위험), \'기다리는 편이 낫습니다\' 박스', '계약 전 체크리스트, 수익 보장 아님 주석',
    '중개사무소 정보 글 박스 (상담 배너 이미지로 대신)', '참고 자료 목록'].map(s => bullet(s)),

  h2('글맛'),
  ...['한 문장 = 한 문단. 문단이 길면 나눈다.', '형광펜은 섹션마다 핵심 한 줄. 숫자는 굵게.', '말하듯 자연스럽게, 합니다체.'].map(s => bullet(s)),

  h2('그래도 지켜야 할 것 (원고를 줄여도 남긴다)'),
  ...[
    [t('연출·AI 이미지', { bold: true }), t('에는 캡션에 \'연출 이미지\'를 남긴다. 실제 설계처럼 보이면 표시·광고 문제가 될 수 있다.')],
    [t('토지거래허가구역', { bold: true }), t('이면 \'세입자 승계\' 같은 문장 옆이나 Q&A 중 한 곳에는 실거주 조건 확인 문장을 남긴다.')],
    [t('상담 배너', { bold: true }), t('에 공인중개사법 표시·광고 명시사항(사무소 명칭 · 소재지 · 연락처 · 등록번호 · 공인중개사 성명)이 다 있는지 본다.')],
    [t('가정 숫자', { bold: true }), t('(조합원 분양가, 추정 감정가)는 표에서 \'(가정)\', \'추정\'을 지우지 않는다.')],
    [t('소제목 크기', { bold: true }), t('는 모두 제목1로 맞춘다.')],
  ].map(r => bullet(r)),

  h2('원고 만드는 방법'),
  ...['저장소 blog/_build/content_template.js 를 content_<구역>.js 로 복사해 {{ }} 칸과 숫자를 채운다.',
    'render_html.js 로 티스토리 붙여넣기 HTML을, render_docx.js 로 검토용 docx를 만든다 (사용법은 blog/_build/README.md).',
    '구조 원문은 blog/_build/STRUCTURE.md 에 있다.'].map(s => bullet([t(s, { size: 19 })])),
];

const numberingLevel = (format, text) => ({ level: 0, format, text, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 280 } } } });
const doc = new Document({
  creator: '투유부동산컨설팅', title: '티스토리 매물 글 구조 가이드',
  styles: { default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT }, paragraph: { outlineLevel: 1 } },
    ] },
  numbering: { config: [{ reference: 'bul', levels: [numberingLevel(LevelFormat.BULLET, '•')] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(out, buf); console.log('docx bytes', buf.length); });
