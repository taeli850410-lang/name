import { dots, fmtDate } from "@/lib/format";
import type { BriefBadge, BriefCardModel, BriefLink, BriefModel, BriefNewsModel } from "@/lib/brief";

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
  const { tiles, history, historyLabel, note, title, sub } = model.numbers;
  if (!tiles.length) return null;
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
        {model.demoNote && <div className="demo-note">{model.demoNote}</div>}

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
