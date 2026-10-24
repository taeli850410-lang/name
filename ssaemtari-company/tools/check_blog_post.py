#!/usr/bin/env python3
"""쌤태리 블로그 원고(docx) 게시 전 점검.

blog/01_기획서 12번 '게시 전 체크리스트' 중 기계로 볼 수 있는 항목과
blog/02_작성기준_및_샘플의 13블록 표시가 원고에 다 들어갔는지를 본다.
숫자 대조 · 광고 가능 여부처럼 사람이 봐야 하는 항목은 마지막에 따로 출력한다.

사용법:
    python3 ssaemtari-company/tools/check_blog_post.py 원고.docx [원고2.docx ...]
    python3 ssaemtari-company/tools/check_blog_post.py 원고.docx --date 2026.10.24

오류가 하나라도 있으면 종료 코드 1을 반환한다.
"""
import argparse
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
AUTHOR_MARK = "작성자 참고용"
LEGEND_MARK = "= 형광펜"  # 표시 기준 박스의 형광펜 견본은 세지 않는다
DATE_LINE = re.compile(r"N부동산 매물현황 (\d{4}\.\d{2}\.\d{2})")
LABELS = ("", "본문", "제목")  # 예전 형식 원고의 '제목' · '본문' 머리표
PLACEHOLDER = re.compile(r"\[\[|\]\]")
HASHTAG = re.compile(r"#[^\s#]+")

# 01_기획서 11번 · 03_프롬프트/1 의 쓰지 않는 말
BANNED = ["무조건 오", "무조건 사", "지금 안 사면", "마지막 기회", "확정 수익", "안녕하세요",
          "알아보겠습니다", "많은 분들이 궁금", "끝까지 읽어"]
# 02_작성기준 13블록 중 원고에 글자로 남는 표시
BLOCKS = [
    ("썸네일 카드 문구", "[썸네일 카드 문구]"),
    ("중개사 한 줄", "중개사 한 줄"),
    ("인포그래픽 문구", "[인포그래픽"),
    ("이전 글 링크 카드", "[이전 글 링크 카드]"),
    ("영상 자리", "[영상]"),
    ("마치며", "마치며"),
    ("상담 안내 카드 문구", "[상담 안내 카드 문구]"),
    ("상담 카드 필수 표기", "필수 표기"),
    ("해시태그", "해시태그"),
]
HIGHLIGHTS = (5, 6)     # 형광펜 5~6곳
HASHTAGS = (8, 12)      # 해시태그 10개 안팎
TITLE_LEN = (30, 40)    # 제목 30~40자 (공백 제외)

MANUAL = [
    "매물 숫자(매매가 · 대지 · 감정가 · 분양가와 평형)를 원자료와 다시 맞췄다",
    "실거래 지번이 가려진 경우, 구역 안인지 확인 못 했다는 각주가 있다",
    "사업 단계 표현(신청 / 인가)이 정확하다",
    "광고할 수 있는 매물이고, 필수 표기가 들어갔다",
    "조감도 · 지도 등 이미지 출처를 적었다",
]


def paragraphs(path):
    """문서 순서대로 (글자, 형광펜 덩어리 수)를 낸다. 표 · 박스 안 문단도 포함한다."""
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    out = []
    for para in root.iter(W + "p"):
        texts, marks, prev = [], 0, False
        for r in para.iter(W + "r"):
            t = "".join(x.text or "" for x in r.iter(W + "t"))
            if not t:
                continue
            hl = r.find(f"{W}rPr/{W}highlight")
            on = hl is not None and hl.get(W + "val", "none") != "none" and bool(t.strip())
            marks += on and not prev
            prev = on
            texts.append(t)
        out.append(("".join(texts), marks))
    return out


def snippet(text, at, width=24):
    s = max(0, at - width)
    return ("…" if s else "") + text[s:at + width].strip() + ("…" if at + width < len(text) else "")


def check(path, today):
    errors, warnings, info = [], [], []
    paras = paragraphs(path)
    cut = next((i for i, (t, _) in enumerate(paras) if t.startswith(AUTHOR_MARK)), len(paras))
    body = paras[:cut]
    body_text = "\n".join(t for t, _ in body)
    if cut == len(paras):
        warnings.append("작성자 참고용 페이지가 없습니다 (확인할 것 · 출처를 남기는 마지막 페이지)")

    # 1. 템플릿 자리표시
    left = [(t, m.start()) for t, _ in paras for m in PLACEHOLDER.finditer(t)]
    if left:
        errors.append(f"[[ ]] 자리가 {len(left)}곳 남아 있습니다. 첫 곳: \"{snippet(*left[0])}\"")

    # 2. 날짜 줄과 제목
    idx = next((i for i, (t, _) in enumerate(body) if DATE_LINE.search(t)), None)
    if idx is None:
        errors.append("날짜 줄('N부동산 매물현황 YYYY.MM.DD …')이 없습니다")
    else:
        d = DATE_LINE.search(body[idx][0]).group(1)
        if d != today:
            warnings.append(f"날짜 줄이 {d} 입니다. 게시하는 날({today})로 바꿨는지 확인하세요")
        title = next((t.strip() for t, _ in reversed(body[:idx]) if t.strip() not in LABELS), "")
        n = len(re.sub(r"\s", "", title))
        info.append(f"제목: {title} ({n}자, 공백 제외)")
        if not TITLE_LEN[0] <= n <= TITLE_LEN[1]:
            warnings.append(f"제목이 {n}자입니다 (기준 {TITLE_LEN[0]}~{TITLE_LEN[1]}자, 공백 제외)")

    # 3. 쓰지 않는 말 (본문만)
    for word in BANNED:
        for t, _ in body:
            at = t.find(word)
            if at >= 0:
                errors.append(f"쓰지 않는 말 '{word}': \"{snippet(t, at)}\"")

    # 4. 형광펜 · 해시태그 개수
    marks = sum(m for t, m in body if LEGEND_MARK not in t)
    info.append(f"형광펜 {marks}곳")
    if not HIGHLIGHTS[0] <= marks <= HIGHLIGHTS[1]:
        warnings.append(f"형광펜이 {marks}곳입니다 (기준 {HIGHLIGHTS[0]}~{HIGHLIGHTS[1]}곳)")
    tags = HASHTAG.findall(body_text)
    info.append(f"해시태그 {len(tags)}개")
    if not HASHTAGS[0] <= len(tags) <= HASHTAGS[1]:
        warnings.append(f"해시태그가 {len(tags)}개입니다 (기준 10개 안팎)")

    # 5. 13블록 표시
    missing = [name for name, mark in BLOCKS if mark not in body_text]
    if missing:
        warnings.append("13블록 중 빠진 표시: " + ", ".join(missing))

    # 6. 직접 경험 자리
    exp = body_text.count("[직접 경험")
    if exp:
        warnings.append(f"[직접 경험] 박스 {exp}곳: 네이버에 옮길 때 실제 경험으로 채우거나 지우세요")
    return errors, warnings, info


def main():
    ap = argparse.ArgumentParser(description="쌤태리 블로그 원고(docx) 게시 전 점검")
    ap.add_argument("files", nargs="+", type=Path, help="점검할 원고 docx")
    ap.add_argument("--date", help="게시일 YYYY.MM.DD (기본: 오늘, 한국 시간)")
    args = ap.parse_args()
    today = args.date or datetime.now(timezone(timedelta(hours=9))).strftime("%Y.%m.%d")

    total_errors = 0
    for f in args.files:
        if not f.exists():
            sys.exit(f"원고를 찾을 수 없습니다: {f}")
        errors, warnings, info = check(f, today)
        total_errors += len(errors)
        print(f"== {f.name}")
        for x in info:
            print(f"    {x}")
        for x in errors:
            print(f"    오류: {x}")
        for x in warnings:
            print(f"    경고: {x}")
        print(f"    결과: {'통과' if not errors else '실패'} — 오류 {len(errors)}건, 경고 {len(warnings)}건\n")

    print("직접 확인할 것 (스크립트로 볼 수 없는 항목)")
    for i, x in enumerate(MANUAL, 1):
        print(f"    {i}. {x}")
    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main())
