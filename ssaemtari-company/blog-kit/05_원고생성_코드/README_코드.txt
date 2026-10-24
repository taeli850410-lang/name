[Claude용 안내] 쌤태리 블로그 원고 Word 생성 코드

- 실행 환경: Node.js + npm 패키지 docx (docx-js, package.json 에 9.5.1 고정 — 처음 한 번 npm install). A4, 여백 2cm, 맑은 고딕.
- blog_kit.js: 공통 블록 모음. require("./blog_kit.js") 후 children 배열만 작성하고 buildDoc(children, 제목, 출력경로)로 저장한다.
  · 문장 마크업: **굵게**, ==노란 형광==, ^^파란 굵은 키워드^^
  · 블록: legend() 표시 기준 / thumb() 썸네일 카드 문구 / title() 제목 / date("YYYY.MM.DD") 날짜 줄 /
          p() 문단 / quote([두 줄], 설명) 가운데 인용구 / h2() 소제목 / table(열너비[], 행[], {emphasizeLast, alignLeft}) /
          tip() 중개사 한 줄 / box() 요약 박스 / info(n, 제목, [내용], 하단배너, 캡션) 인포그래픽 문구 /
          photo(n, 무엇, 캡션) 사진 자리 / video() 영상 / linkcard() 이전 글 링크 / exp() 직접 경험 자리 /
          contact(구역, 서비스, 문구) 상담 안내 카드 / num() 번호 목록 / bullet() / link(제목, URL) / note() 작은 회색 글
          hashtags([태그…]) 해시태그 (한 줄 5개) / refPage() 작성자 참고용 페이지 머리 (새 페이지)
          · num(문장, "titles") 는 체크리스트와 따로 세는 번호 (제목 후보용)
  · 표 열 너비 합계는 9638(DXA)이어야 한다. 셀 안 줄바꿈은 "\n".
- 원고별/_템플릿.js: 13블록 원고 뼈대. 같은 폴더에 <구역>_<YYYYMMDD>.js 로 복사해 {{ }} 자리를 채우고
  node 원고별/<파일>.js ../04_완성원고/<이름>.docx 로 만든다. grep -n "{{" 결과가 비어 있어야 한다.
- make_guide.js: 02_작성기준_및_샘플.docx 생성 (실행: node make_guide.js 출력.docx)
- make_plan.js: 01_기획서.docx 생성 / make_readme.js: 00_먼저_읽어주세요.docx 생성
- 예시_신용산북측1구역_v2.js: 실제 원고 전체 예시(작성자 참고용 페이지 포함). 이 파일은 blog_kit 이전 방식이라 블록 함수가 파일 안에 들어 있다.
- 만든 뒤에는 LibreOffice로 PDF 변환 → 이미지로 렌더링해 표 · 박스가 페이지 사이에서 깨지지 않는지 확인한다.
