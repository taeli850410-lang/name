# docx-js 가 넣는 w:highlightCs 는 스키마에 없어 Word 검증에서 걸린다 — 빼고 다시 묶는다.
# 폴더 항목(이름이 / 로 끝나는 것)도 뺀다. 남아 있으면 클라우드 문서 서비스에서 안 열리는 일이 있다.
# 사용법: python3 -I strip_hlcs.py <파일.docx>
import re, sys, zipfile, shutil
src = sys.argv[1]; tmp = src + '.tmp'
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        if item.filename.endswith('/'):
            continue
        data = zin.read(item.filename)
        if item.filename == 'word/document.xml':
            data = re.sub(rb'<w:highlightCs [^>]*/>', b'', data)
        zout.writestr(item, data)
shutil.move(tmp, src)
