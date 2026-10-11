#!/usr/bin/env python3
"""랜딩페이지(landing/index.html)의 서비스·요금·교육·FAQ 블록을 문서에서 다시 만든다.

service-policy.md 의 2-1 가격표와 3장 상세 정책, faq.md 100문항을 읽어
landing/index.html 의 <!-- BUILD:이름:START --> ~ <!-- BUILD:이름:END --> 사이를 채운다.
가격이나 FAQ를 고친 뒤 이 스크립트를 다시 실행하면 랜딩페이지가 문서와 같아진다.

사용법:
    python3 ssaemtari-company/tools/build_landing.py          # landing/index.html 갱신
    python3 ssaemtari-company/tools/build_landing.py --check  # 문서와 어긋나 있으면 종료 코드 1
"""
import argparse
import re
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_docs import CATEGORIES, Result, parse_faq, price_table  # noqa: E402

CONSULTING_COUNT = 6          # 2-1 표의 앞 6개는 컨설팅, 나머지는 교육
FEATURED_FAQ = [26, 45, 51, 62, 37, 99]
CONSULT_TAG = {"필수": ("tag-navy", "상담 필수"), "권장": ("tag-review", "상담 권장"),
               "선택": ("tag-neutral", "일반 안내")}
LEGAL_FLAG = "최신 법령 확인 필요"

# 핵심 서비스 카드(4개)에만 쓰는 소개 문구. 가격·기간·산출물은 service-policy.md 에서 읽는다.
SERVICE_COPY = {
    "재개발 정비구역 분석": {
        "icon": "map", "tag": "구역 기초 검토",
        "desc": "구역 개요, 추진 단계와 고시 이력, 정비계획(세대수·용적률·임대주택), 공개된 조합 자료, "
                "입지와 주변 경쟁단지 실거래가, 위험요인을 한 보고서로 정리합니다.",
        "target": "관심 구역을 처음 검토하는 투자자",
    },
    "재개발 투자 물건 분석": {
        "icon": "domain", "tag": "매수 전 점검",
        "desc": "등기·건축물대장·토지대장 대조, 물건 유형별 분양대상 쟁점, 권리산정기준일 대비 분할·신축 여부, "
                "종전자산 추정 범위, 초기투자금·총투자비 시뮬레이션을 제공합니다.",
        "target": "특정 물건의 매수를 검토 중인 투자자",
    },
    "조합원 입주권 검토 지원": {
        "icon": "verified_user", "tag": "현금청산 위험 점검",
        "desc": "조례상 분양대상 요건, 다물권·공유 쟁점, 1+1 가능성, 투기과열지구 조합원 지위 양도 제한과 "
                "예외 사유를 자료로 검토합니다. 결과는 검토 의견이며 법적 확정이 아닙니다.",
        "target": "다물권·무허가·도로 등 권리관계가 복잡한 물건",
    },
    "재개발 사업성 분석": {
        "icon": "analytics", "tag": "분담금 스트레스 테스트",
        "desc": "종후자산과 총사업비를 추정해 비례율 3개 시나리오(기본·보수·악화)와 "
                "공사비·일반분양가·사업기간 변화에 따른 분담금 영향을 수치로 보여 드립니다.",
        "target": "관리처분 전 장기 보유를 계획하는 조합원·투자자",
    },
}


def policy_details(sp, index):
    """service-policy.md 3-{index} 표를 {항목: 내용} 으로 읽는다."""
    section = sp.split(f"### 3-{index}.", 1)[1].split("\n### ", 1)[0]
    rows = {}
    for m in re.finditer(r"^\| (.+?) \| (.+) \|$", section, re.M):
        if m.group(1) not in ("항목", "---"):
            rows[m.group(1)] = m.group(2)
    return rows


def won_number(price):
    return int(re.search(r"([\d,]+)원", price).group(1).replace(",", ""))


def split_parts(text, sep):
    return [p.strip() for p in text.split(sep) if p.strip()]


def short_duration(details, scope):
    m = re.match(r"^(\d+영업일)$", details.get("예상 소요기간", ""))
    return m.group(1) if m else scope.split(",")[0]


def service_cards(services, details):
    out = []
    for name, copy in SERVICE_COPY.items():
        scope, price = services[name]
        d = details[name]
        out.append(f"""<article class="card service-card">
  <div class="service-card-top"><span class="icon-box"><span class="ms" aria-hidden="true">{copy['icon']}</span></span><span class="tag tag-neutral">{escape(copy['tag'])}</span></div>
  <h3 class="h-md">{escape(name)}</h3>
  <p class="text-sub">{escape(copy['desc'])}</p>
  <ul class="check-list">
    <li><span class="ms ok" aria-hidden="true">check_circle</span><span><b>주요 대상</b> {escape(copy['target'])}</span></li>
    <li><span class="ms ok" aria-hidden="true">check_circle</span><span><b>산출물</b> {escape(d['산출물'])}</span></li>
    <li><span class="ms ok" aria-hidden="true">check_circle</span><span><b>소요기간</b> <span class="mono">{escape(d['예상 소요기간'])}</span></span></li>
  </ul>
  <div class="service-card-foot"><span class="price-inline mono">{escape(price)}</span><a class="link-arrow" href="#contact" data-service="{escape(name)}">서비스 신청하기<span class="ms" aria-hidden="true">arrow_forward</span></a></div>
</article>""")
    return "\n".join(out)


def pricing_cards(services, details):
    out = []
    names = list(services)[:CONSULTING_COUNT]
    for i, name in enumerate(names, 1):
        scope, price = services[name]
        d = details[name]
        included = split_parts(d["산출물"], " + ")
        if i == 1:
            # 기초 상담은 산출물이 메모뿐이라 상담 자체를 포함 항목 맨 앞에 둔다 (대면 장소 미정 문구는 뺀다)
            session = d["제공 범위"].split(". ")[0]
            included.insert(0, re.sub(r",\s*대면은[^)]*", "", session))
        excluded = split_parts(d.get("제외 범위", ""), ", ")[:4]
        amount = won_number(price)
        is_entry = i == 1
        extra = ""
        if is_entry:
            extra = (f'<p class="plan-note"><span class="ms" aria-hidden="true">redeem</span>'
                     f'14일 이내 같은 구역·물건으로 컨설팅 계약 시 상담료 50%({amount // 2:,}원) 차감</p>')
        payment = escape(d.get("결제", ""))
        inc = "\n".join(f'      <li><span class="ms ok" aria-hidden="true">check</span><span>{escape(x)}</span></li>' for x in included)
        exc = "\n".join(f'      <li><span class="ms no" aria-hidden="true">close</span><span>{escape(x)}</span></li>' for x in excluded)
        btn = "btn-accent" if is_entry else "btn-secondary"
        label = "기초 상담 예약" if is_entry else "이 서비스로 신청"
        out.append(f"""<article class="card plan-card">
  <div class="plan-top"><span class="mono label-plan">PLAN {i:02d}</span><span class="tag tag-neutral">{escape(short_duration(d, scope))}</span></div>
  <h3 class="h-sm">{escape(name)}</h3>
  <p class="plan-scope">{escape(scope)}</p>
  <p class="plan-price"><span class="mono">{amount:,}</span>원</p>
  {extra}
  <div class="plan-lists">
    <p class="label-sm">포함</p>
    <ul class="mark-list">
{inc}
    </ul>
    <p class="label-sm">제외</p>
    <ul class="mark-list">
{exc}
    </ul>
  </div>
  <dl class="plan-terms">
    <div><dt>기간</dt><dd>{escape(d.get('예상 소요기간', ''))}</dd></div>
    <div><dt>수정</dt><dd>{escape(d.get('수정 횟수', ''))}</dd></div>
    <div><dt>결제</dt><dd>{payment}</dd></div>
  </dl>
  <a class="btn {btn} btn-block" href="#contact" data-service="{escape(name)}">{label}</a>
</article>""")
    return "\n".join(out)


def edu_strip(services, details):
    names = list(services)[CONSULTING_COUNT:]
    prices = [won_number(services[n][1]) for n in names]
    items = "\n".join(
        f"""  <li><span class="edu-name">{escape(n)}</span><span class="mono edu-meta">{escape(services[n][0])} · {escape(services[n][1])}</span><span class="edu-target">{escape(details[n].get('대상·정원', ''))}</span></li>"""
        for n in names)
    return f"""<ul class="edu-list">
{items}
</ul>
<p class="edu-range mono">1인 {min(prices):,}원 ~ {max(prices):,}원</p>"""


def form_options(services):
    opts = ['<option value="">서비스를 선택하세요</option>']
    for name, (_, price) in services.items():
        opts.append(f'<option value="{escape(name)}">{escape(name)} ({escape(price)})</option>')
    opts.append('<option value="아직 모르겠어요">아직 모르겠어요 (기초 상담에서 안내)</option>')
    return "\n".join(opts)


def faq_filters(entries):
    btns = [f'<button type="button" class="chip" data-cat="featured" aria-pressed="true">자주 찾는 질문 <span class="mono">{len(FEATURED_FAQ)}</span></button>',
            f'<button type="button" class="chip" data-cat="all" aria-pressed="false">전체 <span class="mono">{len(entries)}</span></button>']
    for code, name, _ in CATEGORIES:
        n = sum(1 for e in entries if e["section"] and e["section"][0] == code)
        btns.append(f'<button type="button" class="chip" data-cat="{code}" aria-pressed="false">{escape(name)} <span class="mono">{n}</span></button>')
    return "\n".join(btns)


def faq_list(entries):
    out = []
    for e in entries:
        f = e["fields"]
        no = f"FAQ-{e['no']:03d}"
        tag_cls, tag_text = CONSULT_TAG.get(f.get("상담 연결", ""), ("tag-neutral", f.get("상담 연결", "")))
        answer = escape(f.get("답변", "")).replace(LEGAL_FLAG, f'<mark class="flag">{LEGAL_FLAG}</mark>')
        check = f.get("추가 확인 필요 여부", "")
        check_cls = "tag-review" if "확인 필요" in check else "tag-neutral"
        featured = " data-featured" if e["no"] in FEATURED_FAQ else ""
        out.append(f"""<details class="faq-item" id="faq-{e['no']:03d}" data-cat="{e['section'][0]}"{featured}>
  <summary><span class="mono faq-no">{no}</span><span class="faq-title">{escape(e['title'])}</span><span class="tag {tag_cls}">{escape(tag_text)}</span><span class="ms faq-caret" aria-hidden="true">expand_more</span></summary>
  <div class="faq-body">
    <p class="faq-ask">고객 질문 · {escape(f.get('질문', ''))}</p>
    <p class="faq-answer">{answer}</p>
    <dl class="faq-meta">
      <div><dt>카테고리</dt><dd>{escape(f.get('카테고리', ''))}</dd></div>
      <div><dt>관련 서비스</dt><dd>{escape(f.get('관련 서비스', ''))}</dd></div>
      <div><dt>추가 확인</dt><dd><span class="tag {check_cls}">{escape(check)}</span></dd></div>
      <div><dt>핵심 키워드</dt><dd>{escape(f.get('핵심 키워드', ''))}</dd></div>
    </dl>
  </div>
</details>""")
    return "\n".join(out)


def replace_block(text, name, content):
    pattern = re.compile(rf"(<!-- BUILD:{name}:START -->)(.*?)(<!-- BUILD:{name}:END -->)", re.S)
    if not pattern.search(text):
        sys.exit(f"landing/index.html 에서 BUILD:{name} 표시를 찾을 수 없습니다.")
    return pattern.sub(lambda m: f"{m.group(1)}\n{content}\n{m.group(3)}", text, count=1)


def main():
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description="랜딩페이지를 문서 기준으로 다시 만든다")
    ap.add_argument("--check", action="store_true", help="파일을 바꾸지 않고 문서와 어긋나 있으면 종료 코드 1")
    args = ap.parse_args()

    sp = (root / "service-policy.md").read_text(encoding="utf-8")
    faq_text = (root / "faq.md").read_text(encoding="utf-8")
    landing = root / "landing" / "index.html"
    html_text = landing.read_text(encoding="utf-8")

    services = price_table(sp, "### 2-1.")
    details = {name: policy_details(sp, i) for i, name in enumerate(services, 1)}
    entries = parse_faq(faq_text, Result())
    if len(services) != 9 or len(entries) != 100:
        sys.exit(f"문서를 읽지 못했습니다: 서비스 {len(services)}개, FAQ {len(entries)}개")

    new = html_text
    for name, content in (
        ("SERVICE-CARDS", service_cards(services, details)),
        ("EDU-STRIP", edu_strip(services, details)),
        ("PRICING", pricing_cards(services, details)),
        ("FORM-OPTIONS", form_options(services)),
        ("FAQ-FILTERS", faq_filters(entries)),
        ("FAQ-LIST", faq_list(entries)),
    ):
        new = replace_block(new, name, content)

    if args.check:
        if new != html_text:
            print("landing/index.html 이 문서와 어긋나 있습니다. build_landing.py 를 실행하세요.")
            return 1
        print("landing/index.html 이 문서와 같습니다.")
        return 0
    landing.write_text(new, encoding="utf-8")
    print(f"갱신: {landing} (서비스 {len(services)}개, FAQ {len(entries)}개)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
