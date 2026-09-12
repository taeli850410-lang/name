"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";

/* 단일 계열 차트 두 종류와 스파크라인.
   - 마크는 얇게(막대 ≤ 24px, 선 2px), 데이터 끝만 둥글게, 격자는 실선 1px
   - 값 라벨은 끝점·최댓값만, 나머지는 툴팁이 맡는다
   - 글자는 텍스트 토큰, 계열 색은 마크에만 */

type Pt = { label: string; value: number; sub?: string };

function niceTicks(max: number, n = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / n;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export function BarChart({ data, height = 180, highlight, valueSuffix = "건", labelEvery = 5 }: { data: Pt[]; height?: number; highlight?: string; valueSuffix?: string; labelEvery?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const padL = 40, padR = 12, padT = 18, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const slot = innerW / data.length;
  const bw = Math.min(24, slot * 0.62);
  const y = (v: number) => padT + innerH - (v / top) * innerH;
  const maxIdx = data.reduce((mi, d, i) => (d.value > data[mi].value ? i : mi), 0);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="일별 발송 건수 막대 차트">
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "axis-line" : "grid-line"} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
            <text className="tick" x={padL - 8} y={y(t) + 4} textAnchor="end">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          const yy = y(d.value);
          const hgt = Math.max(0, padT + innerH - yy);
          const r = Math.min(4, bw / 2, hgt);
          const path = `M${x},${padT + innerH} v${-(hgt - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${hgt - r} z`;
          const isHl = highlight === d.label;
          return (
            <g key={d.label}>
              <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              <path className={`bar${hover === i || isHl ? " is-hover" : ""}`} d={hgt > 0 ? path : ""} style={{ pointerEvents: "none" }} />
              {(i === maxIdx || isHl) && (
                <text className="endlabel" x={x + bw / 2} y={yy - 6} textAnchor="middle">
                  {formatNumber(d.value)}
                </text>
              )}
              {(i % labelEvery === 0 || i === data.length - 1) && (
                <text className="tick" x={x + bw / 2} y={H - 8} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div className="chart__tip" style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          {h.sub ?? h.label} · <b>{formatNumber(h.value)}</b>
          {valueSuffix}
        </div>
      )}
    </div>
  );
}

export function LineChart({ data, height = 200, unit = "", format = (v: number) => formatNumber(v) }: { data: Pt[]; height?: number; unit?: string; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const padL = 56, padR = 64, padT = 16, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const vals = data.map((d) => d.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const min = lo - span * 0.25, max = hi + span * 0.25;
  const x = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${padT + innerH} L${x(0)},${padT + innerH} Z`;
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1].map((v) => Math.round(v / 100) * 100);
  const last = data[data.length - 1];
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="월별 시세 추이 선 차트">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
            <text className="tick" x={padL - 8} y={y(t) + 4} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        <line className="axis-line" x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} />
        <path className="area" d={area} />
        <path className="line" d={line} />
        {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} />}
        {data.map((d, i) => (
          <g key={d.label}>
            <rect x={x(i) - innerW / (data.length - 1) / 2} y={padT} width={innerW / (data.length - 1)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
            {(i === data.length - 1 || hover === i) && <circle className="dot" cx={x(i)} cy={y(d.value)} r={4.5} style={{ pointerEvents: "none" }} />}
            {(i % 3 === 0 || i === data.length - 1) && (
              <text className="tick" x={x(i)} y={H - 8} textAnchor="middle">
                {d.label}
              </text>
            )}
          </g>
        ))}
        <text className="endlabel" x={x(data.length - 1) + 10} y={y(last.value) + 4}>
          {format(last.value)}
          {unit}
        </text>
      </svg>
      {h && hover !== null && (
        <div className="chart__tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          {h.sub ?? h.label} · <b>{format(h.value)}</b>
          {unit}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const li = values.length - 1;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path className="l l--accent" d={d} />
      <circle className="d" cx={x(li)} cy={y(values[li])} r={2.5} />
    </svg>
  );
}
