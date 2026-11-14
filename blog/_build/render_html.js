// 티스토리 HTML 모드에 붙여넣을 본문 + 미리보기/복사용 페이지를 만든다.
// 티스토리 스킨과 섞여도 깨지지 않게 <style> 없이 인라인 스타일만 쓴다.
// 사용법: node render_html.js <원고.js> <출력 폴더> [fragment 출력 폴더]
const fs = require('fs');
const path = require('path');
const C = require(path.resolve(process.argv[2]));

const out = process.argv[3];

const NAVY = '#1f3a5f', BLUE = '#2b6cb0', INK = '#1f2937', SUB = '#4a5568';
const LINE = '#bfc8d6', HEAD = '#e8eef6', SOFT = '#f6f7f9', SKY = '#eef4fb';
const YEL = '#fff4c2', MARK = '#fff1a8', ORG = '#c05621', ORG_BG = '#fdf1e7';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/==(.+?)==/g, `<span style="background-color: ${MARK}; color: ${INK};">$1</span>`)
  .replace(/\{\{(.+?)\}\}/g, `<span style="color: ${ORG}; font-weight: bold;">$1</span>`);

const P = (html, style = '') => `<p data-ke-size="size16"${style ? ` style="${style}"` : ''}>${html}</p>`;

function table(b) {
  const wide = b.head.length >= 4; // 넓은 표는 모바일에서 줄바꿈 대신 가로 스크롤
  const cell = (tag, html, extra) =>
    `<${tag} style="border: 1px solid ${LINE}; padding: 9px 12px;${wide ? ' white-space: nowrap;' : ''} ${extra}">${html}</${tag}>`;
  const head = b.head.map((h, i) =>
    cell('th', esc(h), `background-color: ${HEAD}; color: ${INK}; font-weight: bold; text-align: ${i === 0 ? 'left' : 'center'};`)).join('');
  const rows = b.rows.map((r, ri) => {
    const em = (b.emph || []).includes(ri);
    const bg = em ? YEL : '#ffffff';
    return '<tr>' + r.map((c, ci) =>
      cell('td', inline(c), `background-color: ${bg}; color: ${INK}; text-align: ${ci === 0 ? 'left' : 'center'};${em ? ' font-weight: bold;' : ''}`)).join('') + '</tr>';
  }).join('\n');
  const cap = b.caption ? P(`<b>${esc(b.caption)}</b>`, `margin: 20px 0 8px; color: ${NAVY};`) + '\n' : '';
  const minW = wide ? ' min-width: 560px;' : '';
  return `${cap}<div style="overflow-x: auto; margin: 12px 0 6px;">
<table style="border-collapse: collapse; width: 100%;${minW} font-size: 15px; line-height: 1.5;">
<thead><tr>${head}</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;
}

const box = (border, bg, color, inner, extra = '') =>
  `<div style="border: ${border}; background-color: ${bg}; color: ${color}; border-radius: 10px; padding: 16px 20px; margin: 24px 0; line-height: 1.7;${extra}">\n${inner}\n</div>`;

function render(b) {
  switch (b.t) {
    case 'p': return P(inline(b.text));
    case 'h2': return `<h2 id="${b.id}" data-ke-size="size26" style="border-left: 5px solid ${NAVY}; padding-left: 12px; margin: 56px 0 18px;">${esc(b.text)}</h2>`;
    case 'h3': return `<h3 data-ke-size="size23" style="margin: 36px 0 12px;">${esc(b.text)}</h3>`;
    case 'table': return table(b);
    case 'todo': return P(inline(b.text), `font-size: 13px; color: ${ORG}; margin-top: 4px;`);
    case 'note': return P(inline(b.text), `font-size: 13px; color: #6b7280; margin-top: 4px;`);
    case 'summary': return box(`1px solid ${LINE}`, SKY, INK,
      `<p style="margin: 0 0 8px; font-weight: bold; color: ${NAVY}; font-size: 17px;">${esc(b.title)}</p>\n<ol style="margin: 0; padding-left: 22px;">\n` +
      b.items.map(i => `<li style="margin: 4px 0;">${inline(i)}</li>`).join('\n') + '\n</ol>');
    case 'toc': return box('none', SOFT, INK,
      `<p style="margin: 0 0 6px; font-weight: bold; color: ${NAVY};">목차</p>\n<ul style="margin: 0; padding-left: 4px; list-style: none;">\n` +
      C.toc.map(([id, t]) => `<li style="margin: 3px 0;"><a href="#${id}" style="color: ${BLUE}; text-decoration: none;">${esc(t)}</a></li>`).join('\n') + '\n</ul>');
    case 'photo': {
      const lab = b.label || '사진';
      const detail = (b.detail || []).length
        ? `<p style="margin: 6px 0 0; font-size: 13px; color: ${SUB}; text-align: left;">` + b.detail.map(d => '· ' + esc(d)).join('<br />') + '</p>\n' : '';
      return box(`2px dashed ${BLUE}`, SKY, NAVY,
        `<p style="margin: 0 0 4px; font-weight: bold;">[${lab}${b.n ? ' ' + b.n : ''}] ${esc(b.title)}</p>\n` +
        `<p style="margin: 0; font-size: 13px; color: ${SUB};">캡션: ${esc(b.caption)}<br />대체텍스트: ${esc(b.alt)}</p>\n` + detail +
        (b.image ? `<p style="margin: 6px 0 0; font-size: 13px; color: ${NAVY};">보내 주신 이미지: ${esc(b.image.label)}</p>\n` : '') +
        `<p style="margin: 6px 0 0; font-size: 12px; color: ${ORG};">이 박스를 지우고 그 자리에 ${lab === '영상' ? '영상을' : lab === '사진' ? '사진을' : '이미지를'} 넣으세요.</p>`, ' text-align: center;');
    }
    case 'callout': return box('none', '#eaf7ee', INK,
      `<p style="margin: 0 0 4px; font-weight: bold; color: #1e7b46;">중개사 한 줄</p>\n<p style="margin: 0;">${inline(b.text)}</p>`,
      ' border-left: 4px solid #2f9e5b; border-radius: 0 10px 10px 0;');
    case 'exp': return box(`2px dashed ${ORG}`, ORG_BG, '#7b341e',
      `<p style="margin: 0 0 4px; font-weight: bold; color: ${ORG};">[직접 입력] ${esc(b.title)}</p>\n` +
      `<p style="margin: 0; font-size: 13px;">${esc(b.guide)} 다 쓰면 이 박스를 지우고 일반 문단으로 남기세요.</p>`);
    case 'formula': return box('none', SOFT, INK,
      b.lines.map(l => `<p style="margin: 4px 0;">${inline(l)}</p>`).join('\n'), ` border-left: 4px solid ${BLUE}; border-radius: 0 10px 10px 0;`);
    case 'ol': return `<ol style="padding-left: 22px; line-height: 1.8;">\n` + b.items.map(i => `<li style="margin: 8px 0;">${inline(i)}</li>`).join('\n') + '\n</ol>';
    case 'checklist': return b.items.map(([h, t], i) =>
      `<div style="border: 1px solid ${LINE}; background-color: #ffffff; color: ${INK}; border-radius: 10px; padding: 14px 18px; margin: 12px 0; line-height: 1.7;">\n` +
      `<p style="margin: 0 0 6px; font-weight: bold; color: ${NAVY};">☑ ${i + 1}. ${esc(h)}</p>\n<p style="margin: 0;">${inline(t)}</p>\n</div>`).join('\n');
    case 'compare': {
      const side = (s, border, bg, color) => box(`1px solid ${border}`, bg, INK,
        `<p style="margin: 0 0 8px; font-weight: bold; color: ${color}; font-size: 16px;">${esc(s.title)}</p>\n<ul style="margin: 0 0 10px; padding-left: 20px;">\n` +
        s.items.map(i => `<li style="margin: 3px 0;">${inline(i)}</li>`).join('\n') + `\n</ul>\n<p style="margin: 0; font-size: 14px; color: ${SUB};">${inline(s.footer)}</p>`, ' margin: 14px 0;');
      return side(b.left, '#9fb6d6', SKY, NAVY) + '\n' + side(b.right, '#e8b48f', ORG_BG, ORG);
    }
    case 'faq': return b.items.map(([q, a]) =>
      `<div style="background-color: ${SOFT}; color: ${INK}; border-radius: 10px; padding: 14px 18px; margin: 12px 0; line-height: 1.7;">\n` +
      `<p style="margin: 0 0 6px; font-weight: bold; color: ${NAVY};">Q. ${esc(q)}</p>\n<p style="margin: 0;">A. ${inline(a)}</p>\n</div>`).join('\n');
    case 'broker': return box(`1px solid ${LINE}`, SOFT, INK,
      `<p style="margin: 0 0 8px; font-weight: bold; color: ${NAVY};">상담 안내</p>\n` +
      b.rows.map(([k, v]) => `<p style="margin: 2px 0;"><b>${esc(k)}</b> · <span style="color: ${ORG};">${esc(v)}</span></p>`).join('\n'));
    case 'refs': return `<div style="margin: 48px 0 0; padding-top: 16px; border-top: 1px solid ${LINE}; font-size: 13px; line-height: 1.7;">\n` +
      `<p style="margin: 0 0 6px; font-weight: bold;">참고 자료</p>\n<ul style="margin: 0; padding-left: 18px;">\n` +
      b.items.map(([t, u]) => `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t)}</li>`).join('\n') + '\n</ul>\n</div>';
    default: throw new Error('unknown block ' + b.t);
  }
}

const fragment =
  `<div style="line-height: 1.8; word-break: keep-all;">\n` + C.body.map(render).join('\n\n') + `\n</div>\n`;

// 미리보기 페이지: 위에서 제목·태그·코드를 복사하고, 아래에서 실제 모양을 본다.
const page = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(C.meta.pageTitle)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef1f5; color: ${INK}; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; }
  .bar { background: ${NAVY}; color: #fff; padding: 18px 16px; }
  .wrap { max-width: 820px; margin: 0 auto; }
  .bar h1 { font-size: 15px; margin: 0 0 4px; font-weight: 600; opacity: .85; }
  .bar p.steps { font-size: 13px; margin: 8px 0 0; line-height: 1.7; opacity: .9; }
  .field { background: #fff; color: ${INK}; border-radius: 10px; padding: 12px 14px; margin: 12px 0 0; }
  .field .label { font-size: 12px; color: ${SUB}; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .field .value { font-size: 15px; line-height: 1.5; word-break: keep-all; }
  button { font: inherit; font-size: 13px; border: 0; border-radius: 8px; padding: 7px 12px; cursor: pointer; background: ${BLUE}; color: #fff; white-space: nowrap; }
  button.big { font-size: 15px; padding: 11px 18px; margin-top: 14px; width: 100%; background: #f5b942; color: #1f2937; font-weight: 700; }
  .post { background: #fff; color: ${INK}; max-width: 820px; margin: 20px auto; padding: 28px 16px 40px; border-radius: 12px; font-size: 16px; }
  .post h2 { font-size: 22px; } .post h3 { font-size: 18px; }
  .post-title { font-size: 26px; line-height: 1.4; margin: 0 0 24px; word-break: keep-all; }
  .code { max-width: 820px; margin: 0 auto 40px; padding: 0 16px; }
  textarea { width: 100%; height: 260px; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; border: 1px solid ${LINE}; border-radius: 10px; padding: 10px; background: #fff; color: ${INK}; }
  .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #111827; color: #fff; padding: 10px 16px; border-radius: 999px; font-size: 14px; opacity: 0; transition: opacity .2s; pointer-events: none; }
  .toast.on { opacity: 1; }
  @media (min-width: 640px) { .post { padding: 40px 48px 56px; } }
</style>
</head>
<body>
<div class="bar"><div class="wrap">
  <h1>${esc(C.meta.headline)}</h1>
  <p class="steps">① 아래 <b>HTML 코드 복사</b> → ② 티스토리 글쓰기 오른쪽 위 <b>기본모드 → HTML</b> → ③ 붙여넣기 → ④ 다시 <b>기본모드</b>로 돌아와 파란 사진 박스 자리에 사진을 넣고, 주황 박스는 채우거나 지우기</p>
  <div class="field"><div class="label"><span>제목</span><button data-copy="title">제목 복사</button></div><div class="value" id="title">${esc(C.title)}</div></div>
  <div class="field"><div class="label"><span>태그 (10개, # 없이)</span><button data-copy="tags">태그 복사</button></div><div class="value" id="tags">${esc(C.tags.join(', '))}</div></div>
  <button class="big" data-copy="code">HTML 코드 복사</button>
</div></div>

<article class="post">
  <h1 class="post-title">${esc(C.title)}</h1>
  <div id="preview"></div>
</article>

<div class="code">
  <p style="font-size:13px;color:${SUB};margin:0 0 6px;">붙여넣을 HTML 코드 (복사 버튼이 안 되면 여기서 전체 선택해 복사하세요)</p>
  <textarea id="code" readonly spellcheck="false">${esc(fragment)}</textarea>
</div>
<div class="toast" id="toast">복사했습니다</div>

<script>
  var code = document.getElementById('code');
  document.getElementById('preview').innerHTML = code.value;
  function text(key) {
    if (key === 'code') return code.value;
    return document.getElementById(key).textContent;
  }
  function fallback(t) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
  }
  function toast(msg) {
    var el = document.getElementById('toast'); el.textContent = msg; el.classList.add('on');
    setTimeout(function () { el.classList.remove('on'); }, 1600);
  }
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = text(btn.getAttribute('data-copy'));
      var done = function () { toast('복사했습니다'); };
      var fail = function () {
        if (fallback(t)) return done();
        if (btn.getAttribute('data-copy') === 'code') { code.focus(); code.select(); }
        toast('자동 복사가 막혀 있어요. 직접 선택해 복사해 주세요');
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fail);
      else fail();
    });
  });
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(out, `${C.meta.slug}_tistory_post.html`), page);
fs.writeFileSync(path.join(process.argv[4] || out, `${C.meta.slug}_fragment.html`), fragment);
console.log('fragment bytes', Buffer.byteLength(fragment), 'page bytes', Buffer.byteLength(page));
