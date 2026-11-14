// 검토용 원고(.docx) — 네이버 원고와 같은 표기 규칙(형광펜·파란 사진 박스·주황 직접 입력 박스)을 따른다.
// 사용법: node render_docx.js <원고.js> <출력 폴더>   (만든 뒤 strip_hlcs.py 로 정리)
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, AlignmentType, LevelFormat, Footer, PageNumber, ExternalHyperlink, HeadingLevel, ImageRun,
} = require('docx');
const C = require(path.resolve(process.argv[2]));

const out = process.argv[3];
const W = 9638; // A4, 좌우 여백 2cm 기준 본문 폭
const FONT = 'Malgun Gothic';
const NAVY = '1F3A5F', BLUE = '2B6CB0', ORG = 'C05621', GRAY = '666666', LINE = 'BFC8D6';

function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*(.+?)\*\*|==(.+?)==|\{\{(.+?)\}\}|!!(.+?)!!)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    if (m[2] !== undefined) out.push(new TextRun({ text: m[2], ...base, bold: true }));
    else if (m[3] !== undefined) out.push(new TextRun({ text: m[3], ...base, highlight: 'yellow' }));
    else if (m[4] !== undefined) out.push(new TextRun({ text: m[4], ...base, bold: true, color: ORG }));
    else out.push(new TextRun({ text: m[5], ...base, bold: true, color: 'D32F2F' }));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const para = (text, opt = {}, base = {}) =>
  new Paragraph({ children: runs(text, base), spacing: { after: 160, line: 320 }, ...opt });

const border = (style, color, size) => ({ style, color, size });
const allBorders = b => ({ top: b, bottom: b, left: b, right: b });

function boxTable(children, { fill, line = border(BorderStyle.SINGLE, LINE, 4), margins = { top: 140, bottom: 140, left: 200, right: 200 } } = {}) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      borders: allBorders(line),
      shading: fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins,
      children,
    })] })],
  });
}
const gap = (after = 160) => new Paragraph({ spacing: { after }, children: [] });

function dataTable(b) {
  const line = border(BorderStyle.SINGLE, LINE, 4);
  const mk = (text, w, { head = false, emph = false, first = false } = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: allBorders(line),
    shading: head ? { fill: 'E8EEF6', type: ShadingType.CLEAR, color: 'auto' }
      : emph ? { fill: 'FFF4C2', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({
      alignment: first || b.leftAll ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: runs(text, { size: 19, bold: head || emph || undefined }),
    })],
  });
  const rows = [new TableRow({ tableHeader: true, children: b.head.map((h, i) => mk(h, b.widths[i], { head: true, first: i === 0 })) })];
  b.rows.forEach((r, ri) => {
    const emph = (b.emph || []).includes(ri);
    rows.push(new TableRow({ cantSplit: true, children: r.map((c, i) => mk(c, b.widths[i], { emph, first: i === 0 })) }));
  });
  const out = [];
  if (b.caption) out.push(para(b.caption, { spacing: { before: 120, after: 80 } }, { bold: true, color: NAVY }));
  out.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: b.widths, rows }));
  return out;
}

function label(text) {
  return boxTable([new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })] })],
    { fill: NAVY, line: border(BorderStyle.SINGLE, NAVY, 4), margins: { top: 60, bottom: 60, left: 160, right: 160 } });
}

const h2 = text => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 360, after: 160 },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: NAVY, space: 8 } },
  children: [new TextRun({ text, bold: true, color: NAVY, size: 26 })],
});
const h3 = text => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({ text, bold: true, color: BLUE, size: 23 })],
});

function render(b) {
  switch (b.t) {
    case 'p': return [para(b.text)];
    case 'h2': return [h2(b.text)];
    case 'h3': return [h3(b.text)];
    case 'table': return [...dataTable(b), gap(80)];
    case 'todo': return [para(b.text, { spacing: { after: 200 } }, { size: 18, color: ORG })];
    case 'note': return [para(b.text, { spacing: { after: 200 } }, { size: 18, color: GRAY })];
    case 'summary': return [boxTable([
      para(b.title, { spacing: { after: 80 } }, { bold: true, color: NAVY, size: 22 }),
      ...b.items.map(i => new Paragraph({ numbering: { reference: 'sum', level: 0 }, spacing: { after: 60, line: 300 }, children: runs(i) })),
    ], { fill: 'EEF4FB' }), gap()];
    case 'toc': return [boxTable([
      para('목차', { spacing: { after: 60 } }, { bold: true, color: NAVY }),
      ...C.toc.map(([, t]) => para(t, { spacing: { after: 20 } }, { color: BLUE })),
    ], { fill: 'F6F7F9' }), gap()];
    case 'photo': {
      const lab = b.label || '사진';
      const dw = b.image ? (b.image.dw || 540) : 0;
      return [boxTable([
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [
          new TextRun({ text: `[${lab}${b.n ? ' ' + b.n : ''}] `, bold: true, color: BLUE }), new TextRun({ text: b.title, bold: true, color: NAVY })] }),
        ...(b.image ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new ImageRun({
          type: 'jpg', data: fs.readFileSync(path.resolve(path.dirname(process.argv[2]), b.image.file)),
          transformation: { width: dw, height: Math.round(dw * b.image.h / b.image.w) },
          altText: { title: b.alt, description: b.alt, name: path.basename(b.image.file) } })] })] : []),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: `캡션: ${b.caption}`, size: 18, color: GRAY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `대체텍스트: ${b.alt}`, size: 18, color: GRAY })] }),
        ...(b.detail || []).map((d, i) => new Paragraph({ spacing: { before: i ? 0 : 80 }, children: [new TextRun({ text: `· ${d}`, size: 18, color: GRAY })] })),
      ], { fill: 'EEF4FB', line: border(BorderStyle.DASHED, BLUE, 8), margins: { top: 160, bottom: 160, left: 200, right: 200 } }), gap()];
    }
    case 'callout': return [boxTable([
      para('중개사 한 줄', { spacing: { after: 60 } }, { bold: true, color: '1E7B46' }),
      para(b.text, { spacing: { after: 0, line: 300 } }),
    ], { fill: 'EAF7EE', line: border(BorderStyle.SINGLE, '2F9E5B', 8) }), gap()];
    case 'exp': return [boxTable([
      new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: '[직접 입력] ', bold: true, color: ORG }), new TextRun({ text: b.title, bold: true, color: '7B341E' })] }),
      new Paragraph({ children: [new TextRun({ text: b.guide, size: 18, color: GRAY })] }),
    ], { fill: 'FDF1E7', line: border(BorderStyle.DASHED, ORG, 8) }), gap()];
    case 'formula': return [boxTable(b.lines.map(l => para(l, { spacing: { after: 60 } })),
      { fill: 'F6F7F9' }), gap()];
    case 'ol': return b.items.map(i => new Paragraph({ numbering: { reference: 'ol', level: 0 }, spacing: { after: 100, line: 320 }, children: runs(i) }));
    case 'checklist': {
      const widths = [2200, W - 2200];
      return [...dataTable({ head: ['확인 항목', '확인할 내용'], widths, leftAll: true,
        rows: b.items.map(([h, t], i) => [`**${i + 1}. ${h}**`, t]) }), gap(80)];
    }
    case 'compare': {
      const half = W / 2;
      const side = (s, fill, color) => new TableCell({
        width: { size: half, type: WidthType.DXA },
        borders: allBorders(border(BorderStyle.SINGLE, LINE, 4)),
        shading: { fill, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 140, bottom: 140, left: 180, right: 180 },
        children: [
          para(s.title, { spacing: { after: 80 } }, { bold: true, color }),
          ...s.items.map(i => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 40 }, children: runs(i) })),
          para(s.footer, { spacing: { before: 100, after: 0 } }, { size: 18, color: GRAY }),
        ],
      });
      return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [half, half],
        rows: [new TableRow({ children: [side(b.left, 'EEF4FB', NAVY), side(b.right, 'FDF1E7', ORG)] })] }), gap()];
    }
    case 'quote': return [new Paragraph({ spacing: { before: 200, after: 200 },
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'C8CDD3', space: 10 } },
      children: runs(b.text, { bold: true, color: '4A5568' }) })];
    case 'fit': return [h3(b.title), boxTable([
      ...b.items.map(i => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 40 }, children: runs(i) })),
      para(b.footer, { spacing: { before: 100, after: 0 } }, { bold: true, color: 'D32F2F' }),
    ], { fill: 'EEF4FB' }), gap()];
    case 'faq': return b.items.flatMap(([q, a]) => [boxTable([
      para(`Q. ${q}`, { spacing: { after: 60 } }, { bold: true, color: NAVY }),
      para(`A. ${a}`, { spacing: { after: 0, line: 300 } }),
    ], { fill: 'F6F7F9' }), gap(100)]);
    case 'broker': return [boxTable([
      new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: '[직접 입력] ', bold: true, color: ORG }), new TextRun({ text: '중개사무소 정보 (텍스트로도 남기기 — 지우지 마세요)', bold: true, color: '7B341E' })] }),
      ...b.rows.map(([k, v]) => new Paragraph({ spacing: { after: 20 }, children: [
        new TextRun({ text: `${k} · `, bold: true, size: 19 }), new TextRun({ text: v, size: 19, color: ORG })] })),
    ], { fill: 'FDF1E7', line: border(BorderStyle.DASHED, ORG, 8) }), gap()];
    case 'refs': return [
      para('참고 자료 (본문 끝에 공개로 들어가는 목록 — 원치 않으면 섹션째 삭제)', { spacing: { before: 240, after: 80 } }, { bold: true }),
      ...b.items.map(([t, u]) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 30 },
        children: u ? [new ExternalHyperlink({ link: u, children: [new TextRun({ text: t, size: 18, color: BLUE, underline: {} })] })]
          : [new TextRun({ text: t, size: 18 })] })),
    ];
    default: throw new Error('unknown block ' + b.t);
  }
}

const legend = boxTable([
  para('표시 기준', { spacing: { after: 60 } }, { bold: true, color: NAVY }),
  new Paragraph({ spacing: { line: 300 }, children: [
    new TextRun({ text: '굵은 글씨', bold: true, size: 19 }), new TextRun({ text: ' = 볼드  │  ', size: 19 }),
    new TextRun({ text: '노란 형광', highlight: 'yellow', size: 19 }), new TextRun({ text: ' = 형광펜(티스토리 \'배경색\')  │  ', size: 19 }),
    new TextRun({ text: '[사진 n] 파란 점선 박스', bold: true, color: BLUE, size: 19 }), new TextRun({ text: ' = 사진 넣을 자리 (캡션은 사진 캡션 칸, 대체텍스트는 이미지 설정의 \'대체텍스트\' 칸)  │  ', size: 19 }),
    new TextRun({ text: '[직접 입력] 주황 박스', bold: true, color: ORG, size: 19 }), new TextRun({ text: ' = 실제 겪은 일·사무소 정보를 직접 써넣을 자리 (경험 박스는 못 채우면 박스째 삭제)', size: 19 }),
    ...(C.meta.hasBlanks ? [new TextRun({ text: '  │  ', size: 19 }), new TextRun({ text: '[ ] 주황 글씨', bold: true, color: ORG, size: 19 }), new TextRun({ text: ' = 매물 분석표 숫자로 채울 칸', size: 19 })] : []),
  ] }),
], { fill: 'F6F7F9' });

const children = [
  legend, gap(240),
  label('제목'), gap(80),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: C.title, bold: true, color: NAVY, size: 32 })] }),
  para('다른 제목 후보', { spacing: { after: 40 } }, { size: 18, color: GRAY, bold: true }),
  ...C.altTitles.map(t => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text: t, size: 18, color: GRAY })] })),
  gap(200),
  label('본문'), gap(120),
  ...C.body.flatMap(render),
  gap(240),
  label('태그 (티스토리 태그 칸에 # 없이 쉼표로 붙여넣기 · 10개)'), gap(80),
  para(C.tags.join(', '), { spacing: { after: 360 } }),
  label('작성자 참고용 (블로그에는 올리지 마세요)'), gap(80),
  ...C.authorNotes.flatMap(sec => [
    para(sec.h, { spacing: { before: 200, after: 80 } }, { bold: true, color: NAVY }),
    ...sec.items.map(i => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60, line: 300 }, children: runs(i, { size: 19 }) })),
  ]),
];

const numberingLevel = (format, text) => ({ level: 0, format, text, alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 400, hanging: 280 } } } });

const doc = new Document({
  creator: '투유부동산컨설팅',
  title: C.meta.docTitle,
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT }, paragraph: { outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT }, paragraph: { outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [numberingLevel(LevelFormat.BULLET, '•')] },
    { reference: 'ol', levels: [numberingLevel(LevelFormat.DECIMAL, '%1.')] },
    { reference: 'sum', levels: [numberingLevel(LevelFormat.DECIMAL, '%1.')] },
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(path.join(out, `${C.meta.slug}_tistory_draft.docx`), buf);
  console.log('docx bytes', buf.length);
});
