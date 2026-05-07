"""
HWPX ZIP-level manipulation utilities.
Builds and replaces content in HWPX documents.
"""

import zipfile
import os
import re
import io

NS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history"'

SEC_HEADER = f'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec {NS}>'
SEC_FOOTER = '</hs:sec>'

# Style IDs inherited from 회의록_template.hwpx (must match header.xml)
PARA_DEFAULT = "0"
PARA_LABEL   = "20"   # bold label in table header cells
PARA_VALUE   = "24"   # regular value in table cells
CHAR_DEFAULT = "0"
CHAR_TITLE   = "8"    # large title text
CHAR_LABEL   = "11"   # label text in cells
BORDER_OUTER = "4"
BORDER_HEAD  = "9"
BORDER_DATA  = "10"


def _para(text: str, para_pr: str = PARA_VALUE, char_pr: str = CHAR_LABEL,
          para_id: int = 0, horzsize: int = 40000) -> str:
    return (
        f'<hp:p id="{para_id}" paraPrIDRef="{para_pr}" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="{char_pr}"><hp:t>{_esc(text)}</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="2000" '
        f'textheight="2000" baseline="1700" spacing="600" horzpos="0" horzsize="{horzsize}" flags="393216"/>'
        f'</hp:linesegarray></hp:p>'
    )


def _esc(text) -> str:
    if text is None:
        return ''
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))


_CELL_MARGIN = 510  # left + right each

def _cell(text: str, col: int, row: int, col_span: int = 1, row_span: int = 1,
          width: int = 25000, height: int = 4000,
          border_id: str = BORDER_HEAD, para_pr: str = PARA_LABEL,
          char_pr: str = CHAR_LABEL) -> str:
    inner_w = max(width - _CELL_MARGIN * 2, 1000)
    return (
        f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{border_id}">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        f'{_para(text, para_pr=para_pr, char_pr=char_pr, horzsize=inner_w)}'
        f'</hp:subList>'
        f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>'
        f'<hp:cellSpan colSpan="{col_span}" rowSpan="{row_span}"/>'
        f'<hp:cellSz width="{width}" height="{height}"/>'
        f'<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
        f'</hp:tc>'
    )


def _row(*cells: str) -> str:
    return f'<hp:tr>{"".join(cells)}</hp:tr>'


def _table(rows: str, row_cnt: int, col_cnt: int, total_width: int = 50000, total_height: int = 20000) -> str:
    # horzsize in table's anchor paragraph = page text width (51024 for A4 portrait with default margins)
    return (
        f'<hp:p id="0" paraPrIDRef="{PARA_DEFAULT}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="{CHAR_DEFAULT}">'
        f'<hp:tbl id="1" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" '
        f'lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="{row_cnt}" colCnt="{col_cnt}" '
        f'cellSpacing="0" borderFillIDRef="{BORDER_OUTER}" noAdjust="1">'
        f'<hp:sz width="{total_width}" widthRelTo="ABSOLUTE" height="{total_height}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" '
        f'vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="220" horzOffset="0"/>'
        f'<hp:outMargin left="141" right="141" top="141" bottom="141"/>'
        f'<hp:inMargin left="510" right="510" top="141" bottom="141"/>'
        f'{rows}'
        f'</hp:tbl>'
        f'<hp:t/></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="4000" textheight="4000" baseline="3400" '
        f'spacing="600" horzpos="0" horzsize="51024" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )


# --------------------------------------------------
# Template section XML builders
# --------------------------------------------------

def build_receipt_section(doc_title_ph: str = "{{DOC_TITLE}}",
                          date_ph: str = "{{일시}}",
                          amount_ph: str = "{{금액}}",
                          detail_ph: str = "{{집행내역}}") -> str:
    """영수증 증빙 section0.xml"""
    label_w, value_w = 12000, 38000
    rows = (
        _row(
            _cell(doc_title_ph, 0, 0, col_span=2, row_span=1,
                  width=50000, height=5000, border_id=BORDER_HEAD,
                  para_pr=PARA_LABEL, char_pr=CHAR_TITLE),
        ) +
        _row(
            _cell("일   시", 0, 1, width=label_w, height=4000, border_id=BORDER_HEAD),
            _cell(date_ph, 1, 1, width=value_w, height=4000, border_id=BORDER_DATA,
                  para_pr=PARA_VALUE),
        ) +
        _row(
            _cell("금   액", 0, 2, width=label_w, height=4000, border_id=BORDER_HEAD),
            _cell(amount_ph, 1, 2, width=value_w, height=4000, border_id=BORDER_DATA,
                  para_pr=PARA_VALUE),
        ) +
        _row(
            _cell("집행내역", 0, 3, width=label_w, height=4000, border_id=BORDER_HEAD),
            _cell(detail_ph, 1, 3, width=value_w, height=4000, border_id=BORDER_DATA,
                  para_pr=PARA_VALUE),
        ) +
        _row(
            _cell('"영수증 첨부"', 0, 4, col_span=2, row_span=1,
                  width=50000, height=8000, border_id=BORDER_DATA,
                  para_pr=PARA_VALUE),
        )
    )
    tbl = _table(rows, row_cnt=5, col_cnt=2, total_height=25000)
    return SEC_HEADER + tbl + SEC_FOOTER


def build_attendee_section(title_ph: str = "{{제목}}",
                           date_ph: str = "{{일시}}",
                           place_ph: str = "{{장소}}",
                           rows_xml: str = "") -> str:
    """참석자 명단 section0.xml — rows_xml 은 동적으로 생성된 <hp:tr> 묶음"""
    col_widths = [5000, 13000, 9000, 11000, 12000]  # No./소속/직위/학번/이름
    total_w = sum(col_widths)

    # Title row (span all 5 cols)
    title_row = _row(
        _cell(title_ph, 0, 0, col_span=5, width=total_w, height=6000,
              border_id=BORDER_HEAD, para_pr=PARA_LABEL, char_pr=CHAR_TITLE)
    )
    # Info rows
    info_row1 = _row(
        _cell("일   시", 0, 1, width=5000, height=3500, border_id=BORDER_HEAD),
        _cell(date_ph, 1, 1, col_span=4, width=45000, height=3500,
              border_id=BORDER_DATA, para_pr=PARA_VALUE)
    )
    info_row2 = _row(
        _cell("장   소", 0, 2, width=5000, height=3500, border_id=BORDER_HEAD),
        _cell(place_ph, 1, 2, col_span=4, width=45000, height=3500,
              border_id=BORDER_DATA, para_pr=PARA_VALUE)
    )
    # Header row for data table
    hdr_row = _row(
        _cell("No.", 0, 3, width=col_widths[0], height=3500, border_id=BORDER_HEAD),
        _cell("소   속", 1, 3, width=col_widths[1], height=3500, border_id=BORDER_HEAD),
        _cell("직   위", 2, 3, width=col_widths[2], height=3500, border_id=BORDER_HEAD),
        _cell("학   번", 3, 3, width=col_widths[3], height=3500, border_id=BORDER_HEAD),
        _cell("이   름", 4, 3, width=col_widths[4], height=3500, border_id=BORDER_HEAD),
    )

    all_rows = title_row + info_row1 + info_row2 + hdr_row + rows_xml
    # Count total rows
    row_cnt = 4 + rows_xml.count('<hp:tr>')
    tbl = _table(all_rows, row_cnt=row_cnt, col_cnt=5, total_width=total_w, total_height=row_cnt * 3500)
    return SEC_HEADER + tbl + SEC_FOOTER


def build_attendee_data_row(no: int, affil: str, rank: str, student_id: str, name: str,
                            row_idx: int, col_widths=None) -> str:
    if col_widths is None:
        col_widths = [5000, 13000, 9000, 11000, 12000]
    return _row(
        _cell(str(no), 0, row_idx, width=col_widths[0], height=3500,
              border_id=BORDER_DATA, para_pr=PARA_VALUE),
        _cell(affil, 1, row_idx, width=col_widths[1], height=3500,
              border_id=BORDER_DATA, para_pr=PARA_VALUE),
        _cell(rank, 2, row_idx, width=col_widths[2], height=3500,
              border_id=BORDER_DATA, para_pr=PARA_VALUE),
        _cell(student_id, 3, row_idx, width=col_widths[3], height=3500,
              border_id=BORDER_DATA, para_pr=PARA_VALUE),
        _cell(name, 4, row_idx, width=col_widths[4], height=3500,
              border_id=BORDER_DATA, para_pr=PARA_VALUE),
    )


def build_report_section(title_ph: str = "{{프로그램명}}",
                         fields: dict = None) -> str:
    """행사 결과보고서 section0.xml"""
    if fields is None:
        fields = {}

    label_w, value_w = 14000, 36000

    def field_row(label: str, key: str, row_idx: int) -> str:
        return _row(
            _cell(label, 0, row_idx, width=label_w, height=4000, border_id=BORDER_HEAD),
            _cell(fields.get(key, f"{{{{{key}}}}}"), 1, row_idx, width=value_w,
                  height=4000, border_id=BORDER_DATA, para_pr=PARA_VALUE)
        )

    title_row = _row(
        _cell(fields.get("프로그램명", "{{프로그램명}}"), 0, 0, col_span=2,
              width=50000, height=5000, border_id=BORDER_HEAD,
              para_pr=PARA_LABEL, char_pr=CHAR_TITLE)
    )

    rows = title_row
    labels = [
        ("추  진  과  제", "추진과제"),
        ("세  부  과  제", "세부과제"),
        ("과          업", "과업"),
        ("세  부  과  업", "세부과업"),
        ("추  진  본  부", "추진본부"),
        ("실  행  부  서", "실행부서"),
        ("사  업  기  간", "사업기간"),
        ("집  행  예  산", "집행예산"),
        ("참  석  인  원", "참석인원"),
        ("개      요", "개요"),
        ("주  요  내  용", "주요내용"),
        ("성      과", "성과"),
        ("향  후  계  획", "향후계획"),
    ]
    for i, (label, key) in enumerate(labels):
        rows += field_row(label, key, i + 1)

    row_cnt = 1 + len(labels)
    tbl = _table(rows, row_cnt=row_cnt, col_cnt=2,
                 total_width=50000, total_height=row_cnt * 4000)
    return SEC_HEADER + tbl + SEC_FOOTER


# --------------------------------------------------
# ZIP manipulation helpers
# --------------------------------------------------

def zip_replace(src_path: str, dst_path: str, replacements: dict) -> None:
    """HWPX ZIP 내 모든 XML에서 텍스트 일괄 치환"""
    tmp = dst_path + ".tmp"
    with zipfile.ZipFile(src_path, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename.startswith("Contents/") and item.filename.endswith(".xml"):
                    text = data.decode("utf-8")
                    for old, new in replacements.items():
                        text = text.replace(old, new)
                    data = text.encode("utf-8")
                zout.writestr(item, data)
    if os.path.exists(dst_path):
        os.remove(dst_path)
    os.rename(tmp, dst_path)


def build_hwpx_from_section(base_hwpx: str, dst_path: str, section_xml: str) -> None:
    """기존 HWPX의 header.xml 등을 재사용하고 section0.xml만 교체하여 새 HWPX 생성"""
    with zipfile.ZipFile(base_hwpx, "r") as zin:
        with zipfile.ZipFile(dst_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == "Contents/section0.xml":
                    zout.writestr(item, section_xml.encode("utf-8"))
                elif item.filename.startswith("BinData/"):
                    # Skip binary images (not needed for non-meeting-minutes docs)
                    pass
                else:
                    zout.writestr(item, zin.read(item.filename))
