#!/usr/bin/env python3
"""쌤태리부동산컨설팅 문서 3종(company-profile.md, service-policy.md, faq.md) 자동 검증.

검증 결과를 터미널에 요약하고, Markdown 보고서(validation-report.md)로 저장한다.

사용법:
    python3 ssaemtari-company/tools/validate_docs.py
    python3 ssaemtari-company/tools/validate_docs.py --output 보고서.md
    python3 ssaemtari-company/tools/validate_docs.py --no-report

오류가 하나라도 있으면 종료 코드 1을 반환한다.
"""
import argparse
import re
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path

DOC_NAMES = ["company-profile.md", "service-policy.md", "faq.md"]

CHECKS = OrderedDict([
    (1, "FAQ가 정확히 100개인지"),
    (2, "FAQ 번호가 001~100까지 연속인지"),
    (3, "11개 카테고리별 문항 수가 지정 숫자와 일치하는지"),
    (4, "회사의 핵심 서비스가 재개발 전문 컨설팅으로 반영되었는지"),
    (5, "3개 문서의 서비스명과 가격이 일치하는지"),
    (6, "검증되지 않은 사실과 법률상 확정 표현이 없는지"),
    (7, "모든 FAQ에 질문·답변·키워드·관련 서비스·상담 연결 항목이 있는지"),
    (8, "Markdown 문법 및 문서 내부 링크 오류"),
    (9, "챗봇 규칙(중복 질문, 답변 길이)"),
])

# 실습용 가격표에 반드시 있어야 하는 서비스 (가격은 service-policy.md 2-1 표를 기준으로 읽는다)
REQUIRED_SERVICES = [
    "재개발 기초 상담", "재개발 정비구역 분석", "재개발 투자 물건 분석",
    "조합원 입주권 검토 지원", "재개발 사업성 분석", "투자자 맞춤 종합 컨설팅",
    "재개발 실무교육", "공인중개사 AI 실무교육", "SNS 마케팅 실무교육",
]

CATEGORIES = [
    ("01", "회사 및 컨설팅 이용 안내", 5),
    ("02", "재개발·재건축 기초 개념", 10),
    ("03", "재개발 정비사업 추진 절차", 10),
    ("04", "조합원 입주권 및 분양자격", 15),
    ("05", "권리가액·비례율·분담금", 10),
    ("06", "재개발 투자금 및 수익성 분석", 10),
    ("07", "권리산정기준일·현금청산·투자 위험", 10),
    ("08", "재개발·재건축 관련 세금 및 금융", 10),
    ("09", "공인중개사 재개발 실무 및 AI 교육", 5),
    ("10", "SNS 마케팅 교육", 5),
    ("11", "컨설팅 신청·계약·결제·환불", 10),
]

FAQ_FIELDS = ["카테고리", "질문", "답변", "핵심 키워드", "관련 서비스",
              "관련 정책", "추가 확인 필요 여부", "상담 연결"]
CONSULT_VALUES = ("필수", "권장", "선택")
POLICY_DETAIL_FIELDS = ("제공 범위", "제출자료", "예상 소요기간", "산출물",
                        "수정 횟수", "결제", "취소·환불")

# 보장·단정 표현. 부정·금지 문맥에서 쓰인 경우는 허용한다.
BANNED = ["수익 보장합니다", "수익을 보장합니다", "수익이 보장", "확실한 수익", "무조건 오릅",
          "반드시 오릅", "100% 확보", "입주권 확보 보장", "틀림없이", "절대 손해",
          "입주가 확정됩니다", "일정을 보장합니다"]
NEGATION_CTX = ("않", "아닙", "아니", "없", "금지", "쓰지", "보장받을 수 있나요", "보장할 수 없",
                "보장되지", "대신 쓰는", "단정", "?")
# 법령·세금·금융 내용이 들어간 답변을 찾는 패턴
LEGAL = re.compile(r"(법 제|시행령|조례|제\d+조|세율|LTV|DSR|취득세|양도소득세|양도세|중과|부담금|대출|"
                   r"투기과열지구|조정대상지역|토지거래허가)")
LEGAL_FLAG = "최신 법령 확인 필요"
ANSWER_MIN, ANSWER_TYPICAL_MAX = 150, 350


class Result:
    def __init__(self):
        self.errors = {k: [] for k in CHECKS}
        self.warnings = {k: [] for k in CHECKS}

    def err(self, check, msg):
        self.errors[check].append(msg)

    def warn(self, check, msg):
        self.warnings[check].append(msg)

    @property
    def error_count(self):
        return sum(len(v) for v in self.errors.values())

    @property
    def warning_count(self):
        return sum(len(v) for v in self.warnings.values())


def slug(heading):
    """GitHub 방식의 제목 앵커."""
    s = re.sub(r"[*`]", "", heading).strip().lower()
    s = re.sub(r"[^\w\- ]", "", s)
    return s.replace(" ", "-")


def parse_faq(text, res):
    entries, cur, section = [], None, None
    for ln in text.split("\n"):
        m = re.match(r"^## (\d\d)\. (.+)$", ln)
        if m:
            section, cur = (m.group(1), m.group(2).strip()), None
            continue
        m = re.match(r"^#### FAQ-(\d{3})\. (.+)$", ln)
        if m:
            cur = {"no": int(m.group(1)), "title": m.group(2).strip(),
                   "section": section, "fields": {}}
            entries.append(cur)
            continue
        if ln.startswith("# ") or ln.startswith("## "):
            cur = None
            continue
        if cur is None:
            continue
        m = re.match(r"^\*\*(.+?):\*\* ?(.*)$", ln)
        if m:
            if m.group(1) in cur["fields"]:
                res.err(7, f"FAQ-{cur['no']:03d}: '{m.group(1)}' 항목 중복")
            cur["fields"][m.group(1)] = m.group(2).strip()
        elif ln.strip() and not ln.startswith("---"):
            res.err(8, f"FAQ-{cur['no']:03d}: 정해진 형식 밖의 줄 — {ln[:40]}")
    return entries


def price_table(text, anchor):
    """anchor 제목 아래 첫 표(서비스 | 기본 범위 | 예시 가격)를 읽는다."""
    if anchor not in text:
        return OrderedDict()
    rows = OrderedDict()
    for ln in text.split(anchor, 1)[1].split("\n"):
        m = re.match(r"^\| (.+?) \| (.+?) \| (.+?) \|$", ln)
        if m and m.group(1) not in ("서비스", "---"):
            rows[m.group(1)] = (m.group(2), m.group(3))
        elif rows and not ln.startswith("|"):
            break
    return rows


def won(price):
    """'1인 150,000원' → 150000"""
    m = re.search(r"([\d,]+)원", price)
    return int(m.group(1).replace(",", "")) if m else None


def fmt_won(n):
    return f"{n:,}원"


def check_faq(entries, faq_text, res):
    nos = [e["no"] for e in entries]
    if len(entries) != 100:
        res.err(1, f"FAQ 개수 {len(entries)}개 (100개 필요)")
    if nos != list(range(1, 101)):
        missing = sorted(set(range(1, 101)) - set(nos))
        res.err(2, f"번호가 001~100 연속이 아님 (누락: {missing[:10]})")

    start = 1
    for code, name, n in CATEGORIES:
        in_sec = [e for e in entries if e["section"] == (code, name)]
        in_field = [e for e in entries if e["fields"].get("카테고리") == name]
        if len(in_sec) != n:
            res.err(3, f"{code}. {name}: 섹션 문항 {len(in_sec)}개 (기준 {n}개)")
        if len(in_field) != n:
            res.err(3, f"{code}. {name}: 카테고리 필드 {len(in_field)}개 (기준 {n}개)")
        if [e["no"] for e in in_sec] != list(range(start, start + n)):
            res.err(3, f"{code}. {name}: 번호 범위가 FAQ-{start:03d}~FAQ-{start + n - 1:03d} 가 아님")
        for e in in_sec:
            if e["fields"].get("카테고리") != name:
                res.err(3, f"FAQ-{e['no']:03d}: 섹션({name})과 카테고리 필드 불일치")
        start += n
    sections = [f"{m.group(1)}. {m.group(2)}" for m in re.finditer(r"^## (\d\d)\. (.+)$", faq_text, re.M)]
    if sections != [f"{c}. {n}" for c, n, _ in CATEGORIES]:
        res.err(3, f"카테고리 섹션 순서·이름 불일치: {sections}")

    for e in entries:
        f = e["fields"]
        for name in FAQ_FIELDS:
            if not f.get(name):
                res.err(7, f"FAQ-{e['no']:03d}: '{name}' 누락 또는 빈 값")
        extra = set(f) - set(FAQ_FIELDS)
        if extra:
            res.err(7, f"FAQ-{e['no']:03d}: 정의되지 않은 항목 {sorted(extra)}")
        if f.get("상담 연결") and f["상담 연결"] not in CONSULT_VALUES:
            res.err(7, f"FAQ-{e['no']:03d}: 상담 연결 값 '{f['상담 연결']}' (필수·권장·선택 중 하나)")
        if f.get("질문") and not re.search(r"(\?|요\.)$", f["질문"]):
            res.warn(9, f"FAQ-{e['no']:03d}: 질문이 자연스러운 의문·요청 문장으로 끝나지 않음")

    seen = {}
    for e in entries:
        for val in (e["title"], e["fields"].get("질문", "")):
            if val and val in seen and seen[val] != e["no"]:
                res.err(9, f"중복 질문: FAQ-{e['no']:03d} 와 FAQ-{seen[val]:03d}")
            seen.setdefault(val, e["no"])
    for i, a in enumerate(entries):
        for b in entries[i + 1:]:
            r = SequenceMatcher(None, a["title"], b["title"]).ratio()
            if r >= 0.75:
                res.warn(9, f"제목이 비슷함 — 주제 중복 여부 확인: FAQ-{a['no']:03d} / FAQ-{b['no']:03d} (유사도 {r:.2f})")
    for e in entries:
        n = len(e["fields"].get("답변", ""))
        if n < ANSWER_MIN:
            res.err(9, f"FAQ-{e['no']:03d}: 답변 {n}자 ({ANSWER_MIN}자 미만)")

    for e in entries:
        ans = e["fields"].get("답변", "")
        chk = e["fields"].get("추가 확인 필요 여부", "")
        in_legal_scope = (e["section"] and "02" <= e["section"][0] <= "08") or \
            re.search(r"\S+법(은|이|상|에| 제)", ans)
        if in_legal_scope and LEGAL.search(ans) and chk == "없음":
            res.err(6, f"FAQ-{e['no']:03d}: 법령·세금·금융 내용이 있는데 '추가 확인 필요 여부'가 '없음'")
        if e["section"] and e["section"][0] == "08" and (LEGAL_FLAG not in ans or "2026" not in ans):
            res.err(6, f"FAQ-{e['no']:03d}: 세금·금융 답변에 기준일(2026) 또는 '{LEGAL_FLAG}' 표시 누락")
        if re.search(r"(최근|개정|2025년|2026년)", ans) and LEGAL.search(ans) and "확인 필요" not in ans + chk:
            res.err(6, f"FAQ-{e['no']:03d}: 최근 개정을 언급하는데 확인 필요 표시가 없음")


def check_core_business(cp, docs, res):
    if not re.search(r"\| 핵심 사업 \| 재개발·재건축 전문 컨설팅 \|", cp):
        res.err(4, "회사 개요 표의 핵심 사업이 '재개발·재건축 전문 컨설팅'이 아님")
    if not re.search(r"\| \*\*1순위\*\* \| \*\*재개발·재건축 전문 컨설팅\*\* \| 핵심 사업", cp):
        res.err(4, "서비스 우선순위 1순위가 재개발·재건축 전문 컨설팅이 아님")
    for lbl in ("공인중개사 전문 실무교육", "SNS 및 AI 마케팅 교육"):
        if not re.search(rf"\| {lbl} \| 보조 사업", cp):
            res.err(4, f"'{lbl}' 이 보조 사업으로 표시되지 않음")
    intro = cp.split("## 1. 회사 개요", 1)[-1].split("|", 1)[0]
    if "재개발" not in intro or 0 <= intro.find("AI") < intro.find("재개발"):
        res.err(4, "회사 개요 첫 문단에서 재개발 컨설팅이 먼저 소개되지 않음")
    m = re.search(r"### 13-1\. 메인 헤드라인.*?\n(.*?)\n### ", cp, re.S)
    if not m or "재개발" not in m.group(1) or any(k in m.group(1) for k in ("AI", "SNS")):
        res.err(4, "홈페이지 메인 헤드라인이 재개발 중심이 아님")
    m = re.search(r"### 13-3\. 메인 화면 구성 순서\n\n(.*?)\n\n", cp, re.S)
    if not m or "재개발 전문 컨설팅" not in m.group(1).split("\n")[0]:
        res.err(4, "홈페이지 화면 구성의 첫 순서가 재개발 전문 컨설팅이 아님")
    for doc, text in docs.items():
        for m in re.finditer(r"(AI|SNS)[^\n]{0,30}(주력 사업|핵심 사업|주력 서비스|핵심 서비스)", text):
            ctx = text[max(0, m.start() - 40): m.end() + 20]
            if not any(c in ctx for c in ("보조", "아니", "않")):
                res.err(4, f"{doc}: AI·SNS를 주력 사업처럼 표현 — {ctx.strip()[:60]}")


def check_services(docs, faq_entries, res):
    sp, cp, faq = docs["service-policy.md"], docs["company-profile.md"], docs["faq.md"]
    canon = price_table(sp, "### 2-1.")
    if list(canon) != REQUIRED_SERVICES:
        res.err(5, f"service-policy.md 2-1 가격표의 서비스 목록이 기준과 다름: {list(canon)}")
    cp_table = price_table(cp, "### 3-3.")
    for name in set(canon) | set(cp_table):
        if cp_table.get(name) != canon.get(name):
            res.err(5, f"company-profile.md 3-3 가격표 불일치 — {name}: {cp_table.get(name)} ≠ {canon.get(name)}")
    for i, (name, (_, price)) in enumerate(canon.items(), 1):
        m = re.search(rf"### 3-{i}\. (.+)\n\n\| 항목 \| 내용 \|\n\| --- \| --- \|\n\| 예시 가격 \| (.+?) \|", sp)
        if not m or m.group(1) != name or m.group(2) != price:
            res.err(5, f"service-policy.md 3-{i} 상세 정책의 서비스명·가격이 2-1 표와 다름")
            continue
        section = sp.split(f"### 3-{i}.", 1)[1].split("\n### ", 1)[0]
        for lbl in POLICY_DETAIL_FIELDS:
            if f"| {lbl} |" not in section:
                res.err(5, f"service-policy.md 3-{i} {name}: '{lbl}' 항목 누락")

    prices = {name: won(p) for name, (_, p) in canon.items()}
    for doc, text in docs.items():
        for name, amount in prices.items():
            if name not in text:
                res.err(5, f"{doc}: 서비스명 '{name}' 이 문서에 없음")
            for m in re.finditer(re.escape(name) + r"\([^)]*?([\d,]+)원", text):
                if int(m.group(1).replace(",", "")) != amount:
                    res.err(5, f"{doc}: '{name}' 뒤 가격 {m.group(1)}원 ≠ {fmt_won(amount)}")
    # FAQ에 나오는 금액은 가격표 금액이거나 그 50%(상담료 차감·착수금·잔금)여야 한다
    allowed = {a for a in prices.values()} | {a // 2 for a in prices.values()}
    for m in re.finditer(r"(?<![\d,])(\d{1,3}(?:,\d{3})+)원", faq):
        if int(m.group(1).replace(",", "")) not in allowed:
            res.err(5, f"faq.md: 가격표와 연결되지 않는 금액 {m.group(0)}")
    for e in faq_entries:
        for svc in (s.strip() for s in e["fields"].get("관련 서비스", "").split(",")):
            if svc and svc not in canon:
                res.err(5, f"FAQ-{e['no']:03d}: 관련 서비스 '{svc}' 가 가격표에 없음")
    return canon


def check_expressions(docs, res):
    for doc, text in docs.items():
        # 회사 소개서 2-4 표는 '쓰지 않는 표현' 목록 자체이므로 제외한다
        text = re.sub(r"### 2-4\. 표현 원칙.*?\n---\n", "", text, flags=re.S)
        for ln in text.split("\n"):
            if ln.startswith("**핵심 키워드:**"):
                continue
            for b in BANNED:
                # 줄 전체가 아니라 표현 바로 뒤 문맥만 본다 — 긴 답변의 다른 부정문에 묻히지 않게
                for m in re.finditer(re.escape(b), ln):
                    if not any(c in ln[m.start(): m.end() + 15] for c in NEGATION_CTX):
                        res.err(6, f"{doc}: 보장·단정 표현 '{b}' — {ln[max(0, m.start() - 20): m.end() + 20]}")
            for m in re.finditer("보장", ln):
                if not any(c in ln[m.start(): m.start() + 25] for c in NEGATION_CTX) \
                        and "보장 표현" not in ln:
                    res.warn(6, f"{doc}: '보장' 문맥 확인 — {ln[:70]}")


def check_markdown(docs, res):
    anchors = {}
    for doc, text in docs.items():
        seen, found, in_code = Counter(), set(), False
        for ln in text.split("\n"):
            if ln.startswith("```"):
                in_code = not in_code
            m = re.match(r"^(#{1,6}) (.+)$", ln)
            if m and not in_code:
                s = slug(m.group(2))
                found.add(s if seen[s] == 0 else f"{s}-{seen[s]}")
                seen[s] += 1
        if in_code:
            res.err(8, f"{doc}: 코드 블록이 닫히지 않음")
        if "�" in text:
            res.err(8, f"{doc}: 깨진 문자(U+FFFD) 포함")
        anchors[doc] = found

    link_count = 0
    for doc, text in docs.items():
        for m in re.finditer(r"\[([^\]]+)\]\(([^)]+)\)", text):
            target = m.group(2)
            if re.match(r"^[a-z]+:", target):
                continue
            link_count += 1
            path, _, frag = target.partition("#")
            tdoc = path or doc
            if tdoc not in docs:
                res.err(8, f"{doc}: 없는 문서로 가는 링크 {target}")
            elif frag and frag not in anchors[tdoc]:
                res.err(8, f"{doc}: 깨진 앵커 {target}")
        block = []
        for ln in text.split("\n") + [""]:
            if ln.startswith("|"):
                block.append(ln)
                continue
            if block:
                if len({len(re.findall(r"(?<!\\)\|", r)) for r in block}) != 1:
                    res.err(8, f"{doc}: 표 열 수 불일치 — {block[0][:50]}")
                if len(block) < 2 or not re.match(r"^\|( ?:?-+:? ?\|)+$", block[1]):
                    res.err(8, f"{doc}: 표 구분선 누락 — {block[0][:50]}")
            block = []
        prev = 0
        for ln in text.split("\n"):
            m = re.match(r"^(#{1,6}) ", ln)
            if m:
                lv = len(m.group(1))
                # faq.md 는 카테고리(H2) 아래 FAQ(H4)를 두는 구조라 H2→H4 를 허용한다
                if prev and lv > prev + 1 and not (doc == "faq.md" and (prev, lv) == (2, 4)):
                    res.warn(8, f"{doc}: 제목 수준 건너뜀 H{prev}→H{lv} — {ln[:40]}")
                prev = lv
    return link_count


def build_report(res, entries, canon, link_count, docs_dir):
    now = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M")
    passed = res.error_count == 0
    cats = Counter(e["fields"].get("카테고리") for e in entries)
    lens = {e["no"]: len(e["fields"].get("답변", "")) for e in entries}
    consult = Counter(e["fields"].get("상담 연결") for e in entries)
    flagged = [e for e in entries
               if LEGAL_FLAG in e["fields"].get("답변", "") + e["fields"].get("추가 확인 필요 여부", "")]
    long_answers = [e for e in entries if lens[e["no"]] > ANSWER_TYPICAL_MAX]

    def faq_link(e):
        return f"[FAQ-{e['no']:03d}](faq.md#{slug('FAQ-%03d. %s' % (e['no'], e['title']))})"

    out = [
        "# 쌤태리부동산컨설팅 문서 검증 보고서",
        "",
        f"> - 실행 일시: {now} (KST)",
        f"> - 대상 문서: {', '.join(f'[{d}]({d})' for d in DOC_NAMES)}",
        f"> - 결과: **{'통과' if passed else '실패'}** — 오류 {res.error_count}건, 경고 {res.warning_count}건",
        "> - 이 파일은 `tools/validate_docs.py` 가 만듭니다. 직접 고치지 말고 문서를 고친 뒤 스크립트를 다시 실행하세요.",
        "",
        "## 1. 검증 항목별 결과",
        "",
        "| 번호 | 검증 항목 | 결과 | 오류 | 경고 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for k, name in CHECKS.items():
        ne, nw = len(res.errors[k]), len(res.warnings[k])
        out.append(f"| {k} | {name} | {'통과' if ne == 0 else '**실패**'} | {ne} | {nw} |")

    out += ["", "## 2. FAQ 카테고리별 문항 수", "",
            "| 번호 | 카테고리 | 문항 범위 | 기준 | 실제 | 결과 |",
            "| --- | --- | --- | --- | --- | --- |"]
    start = 1
    for code, name, n in CATEGORIES:
        got = cats[name]
        out.append(f"| {code} | {name} | FAQ-{start:03d} ~ FAQ-{start + n - 1:03d} | {n} | {got} | "
                   f"{'일치' if got == n else '**불일치**'} |")
        start += n
    out.append(f"| | **합계** | | **100** | **{len(entries)}** | {'일치' if len(entries) == 100 else '**불일치**'} |")

    out += ["", "## 3. 서비스·가격 기준표", "",
            "[service-policy.md](service-policy.md#2-1-서비스별-실습용-가격) 2-1 표를 기준으로 회사 소개서와 FAQ를 대조했습니다.",
            "", "| 서비스 | 기본 범위 | 예시 가격 |", "| --- | --- | --- |"]
    out += [f"| {name} | {scope} | {price} |" for name, (scope, price) in canon.items()]

    out += ["", "## 4. FAQ 통계", "",
            "| 항목 | 값 |", "| --- | --- |",
            f"| 상담 연결 | 필수 {consult['필수']} · 권장 {consult['권장']} · 선택 {consult['선택']} |",
            f"| 답변 길이 | 최소 {min(lens.values(), default=0)}자 · 최대 {max(lens.values(), default=0)}자 · "
            f"평균 {sum(lens.values()) // max(len(lens), 1)}자 |",
            f"| '{LEGAL_FLAG}' 표시 | {len(flagged)}개 |",
            f"| {ANSWER_TYPICAL_MAX}자 초과 답변 | {len(long_answers)}개 (법령 예외·계산 설명용, 허용) |",
            f"| 검사한 내부 링크 | {link_count}개 |"]

    out += ["", f"### '{LEGAL_FLAG}' 표시 FAQ", "",
            "게시·상담 전에 법령 원문과 관계 기관 발표로 다시 확인해야 하는 문항입니다.", ""]
    out.append(", ".join(faq_link(e) for e in flagged) if flagged else "없음")
    out += ["", f"### {ANSWER_TYPICAL_MAX}자를 넘는 답변", ""]
    out.append(", ".join(f"{faq_link(e)}({lens[e['no']]}자)" for e in long_answers) if long_answers else "없음")

    out += ["", "## 5. 오류 목록", ""]
    if res.error_count == 0:
        out.append("오류가 없습니다.")
    for k, name in CHECKS.items():
        if res.errors[k]:
            out += [f"### {k}. {name}", ""] + [f"- {x}" for x in res.errors[k]] + [""]

    out += ["", "## 6. 경고 목록", "",
            "경고는 실패로 보지 않지만 사람이 한 번 확인할 항목입니다.", ""]
    if res.warning_count == 0:
        out.append("경고가 없습니다.")
    for k, name in CHECKS.items():
        if res.warnings[k]:
            out += [f"### {k}. {name}", ""] + [f"- {x}" for x in res.warnings[k]] + [""]

    out += ["", "## 7. 실행 방법", "", "```bash",
            "python3 ssaemtari-company/tools/validate_docs.py                 # 검증 후 validation-report.md 저장",
            "python3 ssaemtari-company/tools/validate_docs.py --output a.md   # 다른 이름으로 저장",
            "python3 ssaemtari-company/tools/validate_docs.py --no-report     # 저장하지 않고 터미널 출력만",
            "```", ""]
    return "\n".join(out).replace("\n\n\n", "\n\n")


def main():
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description="쌤태리부동산컨설팅 문서 3종 검증")
    ap.add_argument("--docs-dir", type=Path, default=here.parent, help="문서가 있는 폴더")
    ap.add_argument("--output", type=Path, help="보고서 저장 경로 (기본: <docs-dir>/validation-report.md)")
    ap.add_argument("--no-report", action="store_true", help="Markdown 보고서를 저장하지 않음")
    args = ap.parse_args()

    docs = {}
    for name in DOC_NAMES:
        p = args.docs_dir / name
        if not p.exists():
            sys.exit(f"문서를 찾을 수 없습니다: {p}")
        docs[name] = p.read_text(encoding="utf-8")

    res = Result()
    entries = parse_faq(docs["faq.md"], res)
    check_faq(entries, docs["faq.md"], res)
    check_core_business(docs["company-profile.md"], docs, res)
    canon = check_services(docs, entries, res)
    check_expressions(docs, res)
    link_count = check_markdown(docs, res)

    for k, name in CHECKS.items():
        ne, nw = len(res.errors[k]), len(res.warnings[k])
        print(f"[{'통과' if ne == 0 else '실패'}] {k}. {name} (오류 {ne}, 경고 {nw})")
        for x in res.errors[k]:
            print(f"    오류: {x}")
        for x in res.warnings[k]:
            print(f"    경고: {x}")
    print(f"\n결과: {'통과' if res.error_count == 0 else '실패'} — 오류 {res.error_count}건, 경고 {res.warning_count}건")

    if not args.no_report:
        out = args.output or args.docs_dir / "validation-report.md"
        out.write_text(build_report(res, entries, canon, link_count, args.docs_dir), encoding="utf-8")
        print(f"보고서 저장: {out}")
    return 1 if res.error_count else 0


if __name__ == "__main__":
    sys.exit(main())
