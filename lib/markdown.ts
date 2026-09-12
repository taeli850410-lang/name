/**
 * 블로그 초안용 경량 마크다운 렌더러. 제목(#·##·###), 목록(-), 번호 줄(1.), 인용(>), 표(|), 구분선(---),
 * 굵게(**), 링크([]()), 그리고 [[CHART … CHART]] 막대그래프 블록을 지원합니다. 모든 텍스트는 이스케이프됩니다.
 */

export function escapeHtml(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function chartBlock(body: string): string {
  let title = "";
  let unit = "";
  const pts: [string, number][] = [];
  for (const raw of body.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (/^title:/i.test(l)) title = l.slice(6).trim();
    else if (/^unit:/i.test(l)) unit = l.slice(5).trim();
    else {
      const idx = l.indexOf(":");
      if (idx > 0) {
        const v = parseFloat(l.slice(idx + 1));
        if (!Number.isNaN(v)) pts.push([l.slice(0, idx).trim(), v]);
      }
    }
  }
  if (!pts.length) return "";
  const vals = pts.map((p) => p[1]);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const cols = pts
    .map(([k, v], i) => {
      const h = 14 + Math.round(((v - min) / span) * 96);
      const last = i === pts.length - 1;
      return `<div class="bc-col"><span class="bc-val">${escapeHtml(String(v))}${escapeHtml(unit)}</span><div class="bc-bar${last ? " last" : ""}" style="height:${h}px"></div><span class="bc-x">${escapeHtml(k)}</span></div>`;
    })
    .join("");
  return `<div class="chart-block"><div class="chart-block-title">${escapeHtml(title)}</div><div class="bc-row">${cols}</div></div>`;
}

export function mdToHtml(md: string): string {
  const charts: string[] = [];
  const src = (md || "").replace(/\[\[CHART\n([\s\S]*?)\nCHART\]\]/g, (_m, body: string) => {
    charts.push(chartBlock(body));
    return `\n@@CHART_${charts.length - 1}@@\n`;
  });

  const lines = src.split("\n");
  let html = "";
  let inList = false;
  let bq: string[] = [];
  let tbl: string[] = [];

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  const flushBq = () => {
    if (!bq.length) return;
    const isSlot = bq.some((t) => t.includes("이미지 추가위치"));
    const isExp = bq.some((t) => t.includes("직접 경험 입력"));
    const inner = bq.map((t) => (/^\s*[-*]\s+/.test(t) ? `<div class="bq-li">${inline(t.replace(/^\s*[-*]\s+/, ""))}</div>` : `<div>${inline(t)}</div>`)).join("");
    html += `<blockquote${isSlot ? ' class="img-slot"' : isExp ? ' class="exp-slot"' : ""}>${inner}</blockquote>`;
    bq = [];
  };
  const flushTbl = () => {
    if (tbl.length < 2) {
      tbl = [];
      return;
    }
    const rows = tbl.map((r) =>
      r
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim()),
    );
    const header = rows[0];
    const body = rows.slice(2);
    html += `<div class="tbl-wrap"><table><thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${body
      .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div>`;
    tbl = [];
  };

  for (const raw of lines) {
    const l = raw.replace(/\s+$/, "");
    const chart = l.match(/^@@CHART_(\d+)@@$/);
    if (chart) {
      closeList();
      flushBq();
      flushTbl();
      html += charts[Number(chart[1])] ?? "";
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      closeList();
      flushBq();
      tbl.push(l);
      continue;
    }
    flushTbl();
    if (/^>\s?/.test(l)) {
      closeList();
      bq.push(l.replace(/^>\s?/, ""));
      continue;
    }
    flushBq();
    if (/^#\s+/.test(l)) {
      closeList();
      html += `<h1>${inline(l.replace(/^#\s+/, ""))}</h1>`;
    } else if (/^##\s+/.test(l)) {
      closeList();
      html += `<h2>${inline(l.replace(/^##\s+/, ""))}</h2>`;
    } else if (/^###\s+/.test(l)) {
      closeList();
      html += `<h3>${inline(l.replace(/^###\s+/, ""))}</h3>`;
    } else if (/^\s*[-*]\s+/.test(l)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`;
    } else if (/^\d+\.\s+/.test(l)) {
      closeList();
      html += `<p class="num">${inline(l)}</p>`;
    } else if (l.trim() === "---") {
      closeList();
      html += "<hr>";
    } else if (l.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(l)}</p>`;
    }
  }
  closeList();
  flushBq();
  flushTbl();
  return html;
}
