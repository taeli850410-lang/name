import { SERVICE_BRAND, serviceHome } from "@/lib/brand";
import { dots, fmtDate } from "@/lib/format";
import {
  VIDEO_ANALYSIS_LABEL,
  VIDEO_ASIDE,
  VIDEO_CTA,
  VIDEO_FACT_LABEL,
  VIDEO_POINTS_TITLE,
  VIDEO_RELATED_TITLE,
  VIDEO_SPLIT_TITLE,
  VIDEO_TAG,
  type BriefBadge,
  type BriefCardModel,
  type BriefLink,
  type BriefModel,
  type BriefNewsModel,
  type BriefPromoModel,
  type BriefVideoModel,
} from "@/lib/brief";
import VideoPlayer from "@/components/VideoPlayer";
import { CUSTOMER_VIDEO_LABELS as L } from "@/lib/videoGuide";

/**
 * 브리핑 렌더러. 원본 EDM 구조를 그대로 따르고, audience 에 따라 그린(중개사)·남색(고객) 테마를 씁니다.
 * 서버·클라이언트 양쪽에서 쓰이므로 훅과 서버 전용 모듈을 쓰지 않습니다.
 */

function Badge({ b }: { b: BriefBadge }) {
  return <span className={`badge ${b.tone}`}>{b.label}</span>;
}

function LinkButton({ l }: { l: BriefLink }) {
  const ext = l.external ? { target: "_blank", rel: "noreferrer noopener" } : {};
  return (
    <a className={`srcbtn ${l.kind}`} href={l.href} {...ext}>
      {l.label}
      {l.kind === "primary" ? " →" : ""}
    </a>
  );
}

function ArticleList({ articles, title }: { articles: BriefCardModel["articles"]; title?: string }) {
  if (!articles.length) return null;
  return (
    <div className="artlist">
      {title && (
        <div className="artlist-lbl">
          {title} {articles.length}건
        </div>
      )}
      {articles.map((a) => (
        <a className="art" key={a.url} href={a.url} target="_blank" rel="noreferrer noopener">
          <div className="art-meta">
            <span>
              {a.publisher} · {fmtDate(a.date)}
            </span>
            <span className="art-go">기사 보기 ↗</span>
          </div>
          <div className="art-title">{a.title}</div>
        </a>
      ))}
    </div>
  );
}

function Impact({ card }: { card: BriefCardModel }) {
  if (!card.impact) return null;
  return (
    <div className="pcard-impact">
      <span className="lbl">
        {card.impact.label}
        {card.impact.dots != null && (
          <span className="dots" aria-label={`영향도 ${card.impact.dots} / 5`}>
            {dots(card.impact.dots)}
          </span>
        )}
      </span>
      <span className="val">{card.impact.value}</span>
    </div>
  );
}

/** ●●●○○ — 숫자만 두면 몇 점 만점인지 모르니 말로도 적습니다 */
function Dots({ level, label }: { level: number; label: string }) {
  return (
    <span className="vdots" aria-label={`영향도 ${level} / 5 · ${label}`}>
      <b aria-hidden="true">{dots(level)}</b>
      <i>{label}</i>
    </span>
  );
}

/**
 * 고객용 대표 영상에만 붙는 안내. 중개사용에는 없습니다 — 중개사는 제도만 보면 되고,
 * 고객은 그 앞에서 "그래서 내가 뭘 해야 하지?"에서 막힙니다.
 */
function VideoGuideTop({ g }: { g: NonNullable<BriefVideoModel["guide"]> }) {
  return (
    <>
      <div className="vguide">
        <div className="vguide-lbl">{L.audience}</div>
        {g.audiences.map((a) => (
          <div className="vaud" key={a.key}>
            <div className="vaud-top">
              <span className="vaud-name">{a.label}</span>
              <Dots level={a.level} label={a.levelLabel} />
            </div>
            <p>{a.note}</p>
          </div>
        ))}
        <p className="vguide-note">{L.impactNote}</p>
      </div>

      <div className="vsettle">
        <span className="vsettle-lbl">{L.notSettled}</span>
        <p>{g.notSettled}</p>
      </div>
    </>
  );
}

/** 계약 전 확인 목록. FACT/ANALYSIS 를 읽은 다음에 옵니다 — 무엇인지 알고 나서 무엇을 확인할지 */
function VideoChecklist({ g }: { g: NonNullable<BriefVideoModel["guide"]> }) {
  return (
      <div className="vcheck">
        <div className="vcheck-lbl">{L.checklist}</div>
        <ol>
          {g.checkpoints.map((c, i) => (
            <li key={i}>
              <span className="vcheck-n">{String(i + 1).padStart(2, "0")}</span>
              {c}
            </li>
          ))}
        </ol>
      </div>
  );
}

/** 번호가 붙는 관련 기사 카드 — ARTICLE 01 · 02 · 03 */
function NumberedArticles({ articles, id }: { articles: BriefVideoModel["articles"]; id: string }) {
  if (!articles.length) return null;
  return (
    <div className="artlist va-arts" id={`va-${id}`}>
      <div className="artlist-lbl">
        {VIDEO_RELATED_TITLE} {articles.length}건
      </div>
      {articles.map((a, i) => (
        <a className="art va-art" key={a.url} href={a.url} target="_blank" rel="noreferrer noopener">
          <div className="art-meta">
            <span className="va-num">ARTICLE {String(i + 1).padStart(2, "0")}</span>
            <span>
              {a.publisher} · {fmtDate(a.date)}
            </span>
            <span className="art-go">기사 보기 ↗</span>
          </div>
          <div className="art-title">{a.title}</div>
        </a>
      ))}
    </div>
  );
}

/**
 * 대표 영상 기사 — 하나의 Video Article.
 *
 * 순서가 곧 읽는 순서입니다: 발표 주체·날짜 → 헤드라인 → 영상 → 핵심 요약 →
 * 전문가 영향도 분석(FACT / ANALYSIS) → 원문·관련보도 → 관련 기사.
 * 영상만 봐도 내용을 알 수 있고, 글로 읽는 사람은 요약에서 바로 분석으로 넘어갑니다.
 *
 * CTA 는 스크립트가 아니라 앵커(#va-…)로 내려갑니다. 부드러운 스크롤은 CSS 가 맡고,
 * 스크립트를 지우는 이메일 클라이언트에서도 링크로 남습니다.
 */
/**
 * 사무소 홍보 배너. 맨 아래, 푸터 바로 위에 섭니다.
 *
 * 고객용에서 광고로 표시한 배너에는 (광고) 표기가 붙습니다 — 광고성 정보를 보낼 때는
 * 표기와 수신거부 수단이 있어야 하고, 수신거부는 바로 아래 푸터에 이미 있습니다.
 * 중개사용에는 대신 "지금 고객에게 이게 나갑니다" 안내가 붙습니다. 본인이 보는 화면이라
 * 광고가 아닙니다.
 */
function Promo({ p }: { p: BriefPromoModel }) {
  // 그림은 알맹이가 아니라 치장입니다 — 뜻은 아래 제목·본문이 다 지고 있어서 alt 를 비웁니다.
  // 그래야 그림 주소가 죽었을 때 깨진 아이콘 대신 조용히 사라지고, 읽어 주는 기계도 같은 말을 두 번 안 합니다.
  const img = p.imageUrl ? <img className="promo-img" src={p.imageUrl} alt="" /> : null;
  return (
    <section className="sec">
      <aside className={`promo promo-${p.tone}${p.imageUrl ? " promo-has-img" : ""}`}>
        {img &&
          (p.ctaUrl ? (
            <a className="promo-imglink" href={p.ctaUrl} target="_blank" rel="noreferrer noopener">
              {img}
            </a>
          ) : (
            img
          ))}
        <p className="promo-t">{p.title}</p>
        {p.body && <p className="promo-b">{p.body}</p>}
        {p.ctaUrl && p.ctaLabel && (
          <a className="promo-btn" href={p.ctaUrl} target="_blank" rel="noreferrer noopener">
            {p.ctaLabel}
          </a>
        )}
        {p.showAdMark && <span className="promo-ad">(광고) 수신거부는 아래 안내를 확인하세요.</span>}
        {p.note && <span className="promo-note">{p.note}</span>}
      </aside>
    </section>
  );
}

function VideoHead({ v }: { v: BriefVideoModel }) {
  return (
    <article className="pcard vhero">
      <div className="pcard-top">
        <span className="badge agency">{v.channel}</span>
        <span className="badge info">{v.topicLabel}</span>
        {v.place && <span className="badge neutral">{v.place}</span>}
        <span className="badge warn">영상 기사</span>
        <span className="pcard-date">{v.date} 공개</span>
      </div>
      <h4 className="pcard-title">
        <span className="num">01</span>
        <a href={v.url} target="_blank" rel="noreferrer noopener">
          {v.title}
        </a>
      </h4>
      {v.guide && <p className="vquestion">{v.guide.question}</p>}

      <div className="vhero-stage">
        <VideoPlayer id={v.id} title={v.title} thumb={v.thumb} url={v.url} tag={VIDEO_TAG} aside={VIDEO_ASIDE} />
      </div>
      <div className="vhero-meta">
        <span className="vhero-chan">{v.channel}</span>
        <span aria-hidden="true">·</span>
        <span>{v.date}</span>
        {v.channelUrl && (
          <a className="vhero-more" href={v.channelUrl} target="_blank" rel="noreferrer noopener">
            채널 보기 ↗
          </a>
        )}
      </div>

      {v.points.length > 0 ? (
        <div className="pcard-bullets">
          <div className="lbl">{v.guide ? L.summary : VIDEO_POINTS_TITLE}</div>
          {v.points.map((t, i) => (
            <div className="bl" key={i}>
              <span className="bl-ic">✓</span>
              <p>{t}</p>
            </div>
          ))}
        </div>
      ) : (
        // 꼭지가 안 뽑히면 채널이 적은 설명을 그대로 싣습니다. 고객용에서는 라벨을 붙여
        // 중개사무소가 쓴 글이 아님을 밝힙니다 — "공인중개사님들이 알아두면 좋은" 같은
        // 업계향 문장이 라벨 없이 실리면 누가 한 말인지 헷갈립니다.
        v.lead &&
        (v.guide ? (
          <div className="pcard-bullets">
            <div className="lbl">{L.channelDesc}</div>
            <p className="pcard-lead vchan-desc">{v.lead}</p>
          </div>
        ) : (
          <p className="pcard-lead">{v.lead}</p>
        ))
      )}

      {v.guide && <VideoGuideTop g={v.guide} />}

      {(v.fact || v.analysis) && (
        <div className="va-split">
          <div className="va-split-lbl">{VIDEO_SPLIT_TITLE}</div>
          {v.fact && (
            <div className="va-row va-fact">
              <span className="va-tag">{VIDEO_FACT_LABEL}</span>
              <p>{v.fact}</p>
            </div>
          )}
          {v.analysis && (
            <div className="va-row va-analysis">
              <span className="va-tag">{VIDEO_ANALYSIS_LABEL}</span>
              <p>{v.analysis}</p>
            </div>
          )}
        </div>
      )}

      {v.guide && <VideoChecklist g={v.guide} />}

      <div className="srcrow">
        {/* 붙일 보도가 있을 때만 아래로 내려보냅니다. 없으면 같은 자리에서 영상으로 보냅니다 */}
        {v.articles.length > 0 ? (
          <>
            <a className="srcbtn primary" href={`#va-${v.id}`}>
              {VIDEO_CTA} →
            </a>
            <a className="srcbtn ghost" href={v.url} target="_blank" rel="noreferrer noopener">
              영상 원본
            </a>
          </>
        ) : (
          <>
            <a className="srcbtn primary" href={v.url} target="_blank" rel="noreferrer noopener">
              유튜브에서 보기 →
            </a>
            {v.channelUrl && (
              <a className="srcbtn ghost" href={v.channelUrl} target="_blank" rel="noreferrer noopener">
                {v.channel} 채널
              </a>
            )}
          </>
        )}
      </div>

      {v.guide && v.articles.length > 0 && <p className="vcta-note">{L.ctaNote}</p>}
      <NumberedArticles articles={v.articles} id={v.id} />
    </article>
  );
}

export function BriefCard({ card, index }: { card: BriefCardModel; index: number }) {
  return (
    <article className="pcard">
      <div className="pcard-top">
        {card.badges.map((b, i) => (
          <Badge key={i} b={b} />
        ))}
        <span className="pcard-date">{card.date}</span>
      </div>
      <h4 className="pcard-title">
        <span className="num">{String(index + 1).padStart(2, "0")}</span>
        {card.title}
      </h4>
      {card.lead && <p className="pcard-lead">{card.lead}</p>}
      {card.bullets && card.bullets.items.length > 0 && (
        <div className="pcard-bullets">
          <div className="lbl">{card.bullets.title}</div>
          {card.bullets.items.map((t, i) => (
            <div className="bl" key={i}>
              <span className="bl-ic">✓</span>
              <p>{t}</p>
            </div>
          ))}
        </div>
      )}
      {card.extra && card.extra.items.length > 0 && (
        <div className="pcard-list">
          <div className="lbl">{card.extra.title}</div>
          <ul>
            {card.extra.items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {card.checklist && card.checklist.items.length > 0 && (
        <div className="pcard-list check">
          <div className="lbl">{card.checklist.title}</div>
          <ul>
            {card.checklist.items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <Impact card={card} />
      {card.links.length > 0 && (
        <div className="srcrow">
          {card.links.map((l, i) => (
            <LinkButton key={i} l={l} />
          ))}
        </div>
      )}
      <ArticleList articles={card.articles} title="관련 보도" />
      {(card.search.length > 0 || card.refs.length > 0) && (
        <div className="srcmeta">
          {card.search.length > 0 && (
            <div className="srcmeta-row">
              <span className="srcmeta-lbl">최신 뉴스 검색</span>
              {card.search.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener">
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
          {card.refs.length > 0 && (
            <div className="srcmeta-row">
              <span className="srcmeta-lbl">참고 사이트</span>
              {card.refs.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener">
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function NewsCard({ item }: { item: BriefNewsModel }) {
  return (
    <article className="ncard">
      <div className="ncard-head">
        {item.badges.map((b, i) => (
          <Badge key={i} b={b} />
        ))}
        {item.count > 0 && <span className="ncard-cnt">관련 기사 {item.count}건</span>}
      </div>
      {item.href ? (
        <a className="ncard-title" href={item.href} target="_blank" rel="noreferrer noopener">
          {item.title} <span className="go">↗</span>
        </a>
      ) : (
        <span className="ncard-title">{item.title}</span>
      )}
      {item.excerpt && <p className="ncard-ex">{item.excerpt}</p>}
      <ArticleList articles={item.articles} title="관련 보도" />
    </article>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="sechead">
      <h3>{title}</h3>
      {sub && <span>{sub}</span>}
    </div>
  );
}

function Numbers({ model }: { model: BriefModel }) {
  const { tiles, history, historyLabel, note, title, sub, regions } = model.numbers;
  if (!tiles.length && !regions) return null;
  const vals = history.map((h) => h.value);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, max);
  const span = max - min || 1;
  return (
    <section className="sec">
      <SectionHead title={title} sub={sub} />
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
              <span>{historyLabel}</span>
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
        {regions && (
          <div className="regions">
            <div className="regions-head">
              <span>{regions.title}</span>
              <span>{regions.unit}</span>
            </div>
            {regions.rows.map((r) => (
              <div className="region-row" key={r.name}>
                <span className="region-name">{r.name}</span>
                <span className="region-cell">
                  <i>매매</i>
                  <b>{r.sale}</b>
                  {r.saleDelta && <em className={r.saleDir}>{r.saleDelta}</em>}
                </span>
                <span className="region-cell">
                  <i>전세</i>
                  <b>{r.jeonse}</b>
                  {r.jeonseDelta && <em className={r.jeonseDir}>{r.jeonseDelta}</em>}
                </span>
              </div>
            ))}
            <div className="regions-src">
              {regions.rows[0]?.month} 기준 · {regions.source}
            </div>
          </div>
        )}
        <p className="note">{note}</p>
      </div>
    </section>
  );
}

export default function BriefView({ model }: { model: BriefModel }) {
  const o = model.office;
  const theme = model.audience === "broker" ? "theme-green" : "theme-navy";
  const telHref = o.phone ? `tel:${o.phone.replace(/[^0-9+]/g, "")}` : null;
  const keynoteLines = model.keynote.main.split("\n");

  return (
    <div className={`brief ${theme}`}>
      <div className="wrap">
        {model.audience === "customer" && (
          <a className="letter-brand" href={serviceHome()} aria-label={`${SERVICE_BRAND.line1} ${SERVICE_BRAND.line2} 메인으로`}>
            {SERVICE_BRAND.line1}
            <small>{SERVICE_BRAND.line2}</small>
          </a>
        )}

        <header className="masthead">
          <div>
            <div className="mh-name">
              {o.officeName}
              <span className="mh-pill">{model.audience === "broker" ? "중개사용" : "공인중개"}</span>
            </div>
            <div className="mh-sub">
              {o.brandName} · {model.vol}
            </div>
          </div>
          {model.audience === "customer" && telHref && (
            <a className="mh-ic" href={telHref} aria-label="전화 걸기">
              ☏
            </a>
          )}
        </header>

        <section className="sec">
          <div className="keyrow">
            <span className="keychip">{model.kicker}</span>
            <span className="keyvol">{model.vol}</span>
          </div>
          <div className="keynote">
            <h2>
              {keynoteLines.map((ln, i) => (
                <span key={i} className={i === keynoteLines.length - 1 && keynoteLines.length > 1 ? "hl" : undefined}>
                  {ln}
                  {i < keynoteLines.length - 1 && <br />}
                </span>
              ))}
            </h2>
            <p>{model.keynote.sub}</p>
          </div>
        </section>

        <section className="sec">
          <div className="lede">
            <span className="eyebrow">{model.eyebrow}</span>
            <h3>{model.headline}</h3>
          </div>
        </section>

        {model.video && (
          <section className="sec">
            {model.video.brand && <div className="vbrand">{model.video.brand}</div>}
            <SectionHead title={model.video.title} sub={model.video.sub} />
            <VideoHead v={model.video.head} />
            <div className="vid-row">
              {model.video.items.map((v) => (
                <a className="vid" key={v.id} href={v.url} target="_blank" rel="noreferrer noopener">
                  <span className="vid-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.thumb} alt="" loading="lazy" />
                    <span className="vid-play" aria-hidden="true">
                      ▶
                    </span>
                  </span>
                  <span className="vid-meta">
                    <span className="vid-chan">{v.channel}</span>
                    <span className="vid-tag">{v.topicLabel}</span>
                    {v.place && <span className="vid-tag vid-place">{v.place}</span>}
                  </span>
                  <strong className="vid-title">{v.title}</strong>
                  {v.summary && <span className="vid-sum">{v.summary}</span>}
                  <span className="vid-date">{v.date}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="sec">
          <SectionHead title={model.policy.title} sub={model.policy.sub} />
          {model.policy.cards.length === 0 && <div className="card empty">{model.policy.empty}</div>}
          <div className="stack">
            {model.policy.cards.map((c, i) => (
              <BriefCard key={c.id} card={c} index={i} />
            ))}
          </div>
        </section>

        {model.news && model.news.items.length > 0 && (
          <section className="sec">
            <SectionHead title={model.news.title} sub={model.news.sub} />
            <div className="stack">
              {model.news.items.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          </section>
        )}

        <Numbers model={model} />

        {model.persona && model.persona.rows.length > 0 && (
          <section className="sec">
            <SectionHead title={model.persona.title} sub={model.persona.sub} />
            <div className="card persona">
              {model.persona.rows.map((r, i) => (
                <div className="prow" key={i}>
                  <div className="prow-head">
                    <span className="prow-lbl">{r.label}</span>
                    <span className="prow-dots" aria-label={`영향도 ${r.level} / 5`}>
                      {dots(r.level)}
                    </span>
                  </div>
                  {r.note && <p className="prow-note">{r.note}</p>}
                </div>
              ))}
              <p className="note">{model.persona.note}</p>
              {model.persona.glossary && (
                <p className="prow-gloss">
                  <b>용어 하나 · {model.persona.glossary.term}</b> {model.persona.glossary.def}
                </p>
              )}
            </div>
          </section>
        )}

        {model.comment && (
          <section className="sec">
            <div className="comment">
              <div className="comment-head">
                <span className="avatar">{(o.repName || o.officeName).slice(0, 1)}</span>
                <div>
                  <div className="comment-name">{model.comment.name}</div>
                  <div className="comment-tag">{model.comment.tag}</div>
                </div>
              </div>
              <p className="comment-body">{model.comment.body}</p>
            </div>
          </section>
        )}

        {model.cta.buttons.length > 0 && (
          <section className="sec">
            <div className="cta">
              <h3>{model.cta.title}</h3>
              <p>{model.cta.sub}</p>
              <div className="cta-btns">
                {model.cta.buttons.map((b, i) => (
                  <a key={i} className={`cta-btn ${b.kind}`} href={b.href} {...(b.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
                    {b.label}
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {model.promo && <Promo p={model.promo} />}

        <footer className="foot">
          <div className="foot-id">
            <div className="foot-id-head">{model.footer.head}</div>
            <div className="foot-grid">
              {model.footer.rows.map(([k, v]) => (
                <p key={k}>
                  <b>{k}</b> {v}
                </p>
              ))}
            </div>
          </div>
          <div className="foot-legal">
            {model.footer.legal.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
          <div className="foot-links">
            {model.footer.links.map((l, i) => (
              <span key={l.href}>
                {i > 0 && <span className="sep">·</span>}
                <a href={l.href}>{l.label}</a>
              </span>
            ))}
            {model.footer.links.length > 0 && <span className="sep">·</span>}
            <span>{model.kicker}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
