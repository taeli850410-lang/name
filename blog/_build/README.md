# 티스토리 원고 만들기

원고 한 편은 `content_<구역>.js` 파일 하나입니다. 같은 원고로 검토용 docx와 티스토리 HTML(붙여넣기 코드 + 미리보기)을 만듭니다.

```bash
cd blog/_build
node render_html.js content_macheon2.js ../macheon2-tistory /tmp
node render_docx.js content_macheon2.js ../macheon2-tistory
python3 -I strip_hlcs.py ../macheon2-tistory/macheon2_tistory_draft.docx
NODE_PATH=$(npm root -g) node shot.js "$PWD/../macheon2-tistory/macheon2_tistory_post.html" /tmp   # 화면 확인(선택)
```

- 본문 표기: `**굵게**`, `==형광펜==`, `{{채울 칸}}`, `!!빨간 굵은 글씨!!`
- 사진 박스에 `image: { file: 'assets/...jpg', w, h, label, dw }`를 주면 docx에는 실제 이미지가 들어가고, HTML 박스에는 어떤 이미지를 넣을지 적힙니다.
- 연락처가 들어간 이미지(상담 배너 등)는 `assets/`에 넣지 않습니다.
