import { dots, fmtDate } from "@/lib/format";
import { letterTitle, segmentLabel } from "@/lib/letter";
import { PERIOD_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/taxonomy";
import type { Letter, LetterIssue } from "@/lib/types";

/**
 * 고객용 레터 렌더러. 서버·클라이언트 양쪽에서 쓰이므로 훅과 서버 전용 모듈을 쓰지 않습니다.
 */

const DISCLAIMER =
  "본 자료는 정부·공공기관의 발표자료 및 공개된 언론보도를 바탕으로 일반적인 부동산 정보를 제공하기 위해 작성되었습니다. 개별 부동산의 매수·매도·세무·법률 판단은 개인별 상황에 따라 달라질 수 있으므로 필요한 경우 관련 전문가의 별도 확인을 권합니다.";
const AD_FOOTER =
  "본 자료는 일반적인 부동산 정보 제공을 목적으로 작성되었으며 개별적인 투자·세무·법률 판단을 대신하지 않습니다. 광고성 정보 수신에 동의한 고객에게 발송되었습니다.";

function toneClass(status: LetterIssue["status"]): string {
  return STATUS_TONE[status];
}

export function LetterIssueCard({ item, index }: { item: LetterIssue; index: number }) {
  const c = item.customer;
  const dateLabel = item.effectiveAt ? `${fmtDate(item.effectiveAt)} 시행` : `${fmtDate(item.publishedAt)} 발표`;
  return (
    <article className="pcard">
      <div className="pcard-top">
        <span className="badge agency">{item.agency}</span>
        <span className={`badge ${toneClass(item.status)}`}>{STATUS_LABEL[item.status]}</span>
        {item.targeted && item.dong.length > 0 && <span className="badge target">{item.dong.join("·")} 소식</span>}
        <span className="pcard-date">{dateLabel}</span>
      </div>
      <h4 className="pcard-title">
        {index + 1}. {c.headline}
      </h4>
      <p className="pcard-what">{c.what}</p>
      {item.forMe && (
        <div className="forme">
          <div className="lbl">
            <span>나에게는</span>
            <span className="dots" aria-label={`영향도 ${item.impact} / 5`}>
              {dots(item.impact)}
            </span>
          </div>
          <p>{item.forMe}</p>
        </div>
      )}
      {c.actions.length > 0 && (
        <div className="todo">
          <div className="lbl">지금 할 일</div>
          <ol>
            {c.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="srcrow">
        {item.officialUrl && (
          <a className="srcbtn" href={item.officialUrl} target="_blank" rel="noreferrer noopener">
            원문 보기 →
          </a>
        )}
        {item.articleUrl && item.articleUrl !== item.officialUrl && (
          <a className="srcbtn ghost" href={item.articleUrl} target="_blank" rel="noreferrer noopener">
            {item.articleLabel ?? "기사 보기"}
          </a>
        )}
        {item.links.map((l) => (
          <a key={l.id} className="srcbtn link" href={l.url} target="_blank" rel="noreferrer noopener">
            {l.label}
          </a>
        ))}
      </div>
    </article>
  );
}

export function NumbersSection({ letter }: { letter: Letter }) {
  const { tiles, history } = letter;
  if (!tiles.length) return null;
  const vals = history.map((h) => h.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, max);
  const span = max - min || 1;
  return (
    <section className="sec">
      <div className="sechead">
        <h3>우리 동네 숫자</h3>
        <span>{letter.office.areaLabel} · 출처·기준일이 확인된 수치만</span>
      </div>
      <div className="card">
        <div className="tiles">
          {tiles.map((t) => (
            <div className="tile" key={t.key}>
              <span className="lbl">
                {t.label}
                {t.provisional ? " (잠정)" : ""}
              </span>
              <div className="val">
                <b>{t.value}</b>
                {t.delta && <span className={t.deltaDir}>{t.delta}</span>}
              </div>
              <span className="src">
                {t.asOf} ·{" "}
                <a href={t.sourceUrl} target="_blank" rel="noreferrer noopener">
                  {t.source}
                </a>
              </span>
            </div>
          ))}
        </div>
        {history.length >= 2 && (
          <div className="chart">
            <div className="chart-head">
              <span>{letter.historyLabel}</span>
              <span>최근 {history.length}개월</span>
            </div>
            <div className="bars">
              {history.map((h, i) => (
                <div className="bar-col" key={h.label}>
                  <div className={`bar${i === history.length - 1 ? " last" : ""}`} style={{ height: `${24 + Math.round(((h.value - min) / span) * 60)}px` }} />
                  <span className="bar-x">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="note">※ 실거래 신고 기한이 30일이라 최근 두 달 수치는 잠정치이며 이후 늘어날 수 있습니다.</p>
      </div>
    </section>
  );
}

export default function LetterView({ letter }: { letter: Letter }) {
  const o = letter.office;
  const telHref = o.phone ? `tel:${o.phone.replace(/[^0-9+]/g, "")}` : null;
  const unsubscribeHref = o.unsubscribeUrl || (o.email ? `mailto:${o.email}?subject=${encodeURIComponent("수신거부 요청")}` : null);
  const isDemo = letter.id === "demo";

  return (
    <div className="ll">
      <div className="wrap">
        {isDemo && <div className="demo-note">샘플 레터입니다. 스튜디오 → 설정에서 사무소 정보를 입력하고 레터 빌더에서 발행하면 실제 정보로 만들어집니다.</div>}
        <header className="masthead">
          <div>
            <div className="mh-name">
              {o.officeName}
              <span className="mh-pill">공인중개</span>
            </div>
            <div className="mh-sub">
              {o.brandName} · {segmentLabel(letter.segment)} 호
            </div>
          </div>
          {telHref && (
            <a className="mh-ic" href={telHref} aria-label="전화 걸기">
              ☏
            </a>
          )}
        </header>

        <section className="sec">
          <div className="keyrow">
            <span className="keychip">
              {PERIOD_LABEL[letter.period]} BRIEFING · {letter.editionLabel}
            </span>
            <span className="keyvol">{PERIOD_LABEL[letter.period]}</span>
          </div>
          <div className="keynote">
            <h2>{o.slogan}</h2>
            <p>확정된 정책과 우리 동네 숫자만 골라, 내 상황에 무엇이 달라지는지 3분 안에 정리해 드립니다.</p>
          </div>
        </section>

        <section className="sec">
          <div className="lede">
            <span className="eyebrow">{letterTitle(letter)}</span>
            <h3>{letter.headline}</h3>
          </div>
        </section>

        <section className="sec">
          <div className="sechead">
            <h3>이번 호 이슈</h3>
            <span>확정·시행 예정·통계만 본문에 싣습니다</span>
          </div>
          {letter.issues.length === 0 && <div className="card">이번 호에 실을 확정 이슈가 없습니다.</div>}
          {letter.issues.map((it, i) => (
            <LetterIssueCard key={it.issueId} item={it} index={i} />
          ))}
        </section>

        <NumbersSection letter={letter} />

        {letter.watch.length > 0 && (
          <section className="sec">
            <div className="sechead">
              <h3>지켜볼 이슈</h3>
              <span>아직 확정되지 않았습니다</span>
            </div>
            <div className="card">
              <ul className="watch">
                {letter.watch.map((w) => (
                  <li key={w.issueId}>
                    <span className={`badge ${w.statusLabel === STATUS_LABEL.LEGISLATIVE_NOTICE || w.statusLabel === STATUS_LABEL.IN_ASSEMBLY || w.statusLabel === STATUS_LABEL.UNDER_REVIEW ? "warn" : "neutral"}`}>
                      {w.statusLabel}
                    </span>
                    {w.url ? (
                      <a href={w.url} target="_blank" rel="noreferrer noopener">
                        {w.title}
                      </a>
                    ) : (
                      <span>{w.title}</span>
                    )}
                    <span className="date">{fmtDate(w.date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {letter.glossary && (
          <section className="sec">
            <div className="sechead">
              <h3>용어 하나</h3>
            </div>
            <div className="card glossary">
              <div className="term">{letter.glossary.term}</div>
              <p>{letter.glossary.def}</p>
            </div>
          </section>
        )}

        {letter.comment && (
          <section className="sec">
            <div className="comment">
              <div className="comment-head">
                <span className="avatar">{(o.repName || o.officeName).slice(0, 1)}</span>
                <div>
                  <div className="comment-name">{o.repName ? `${o.repName} 공인중개사의 한마디` : `${o.officeName}의 한마디`}</div>
                  <div className="comment-tag">현장에서 드리는 코멘트</div>
                </div>
              </div>
              <p className="comment-body">{letter.comment}</p>
            </div>
          </section>
        )}

        {(telHref || o.kakaoUrl) && (
          <section className="sec">
            <div className="cta">
              <h3>이 소식이 내 집에 어떤 영향을 주는지 궁금하신가요?</h3>
              <p>매도할지 보유할지, 갈아타기를 계획 중이신지. 확정된 숫자로 함께 정리해 드립니다.</p>
              <div className="cta-btns">
                {telHref && (
                  <a className="cta-btn primary" href={telHref}>
                    ☏ {o.phone}
                  </a>
                )}
                {o.kakaoUrl && (
                  <a className="cta-btn kakao" href={o.kakaoUrl} target="_blank" rel="noreferrer noopener">
                    카카오톡으로 상담하기
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        <footer>
          <div className="foot-id">
            <div className="foot-id-head">{o.officeName} 안내</div>
            <div className="foot-grid">
              {o.repName && (
                <p>
                  <b>대표 공인중개사</b> {o.repName}
                </p>
              )}
              {o.registrationNo && (
                <p>
                  <b>등록번호</b> {o.registrationNo}
                </p>
              )}
              {o.phone && (
                <p>
                  <b>연락처</b> {o.phone}
                </p>
              )}
              {o.address && (
                <p>
                  <b>소재지</b> {o.address}
                </p>
              )}
            </div>
          </div>
          <div className="foot-legal">
            <p>{DISCLAIMER}</p>
            <p>{AD_FOOTER}</p>
          </div>
          <div className="foot-links">
            {unsubscribeHref ? <a href={unsubscribeHref}>수신거부</a> : <span>수신거부: 사무소로 연락</span>}
            <span>·</span>
            <span>
              {PERIOD_LABEL[letter.period]} · {letter.editionLabel}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
