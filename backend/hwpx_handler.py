"""
HWPX document generation handler.

Accepts structured data (from ai_parser.py) and produces
HWPX output files using ZIP-level template manipulation.
"""

import os
import re
import shutil
import zipfile
from datetime import datetime
from typing import Optional
from pathlib import Path

from hwpx_builder import zip_replace

BASE_DIR   = Path(__file__).parent
TEMPLATES  = BASE_DIR / "templates"
OUTPUTS    = BASE_DIR / "outputs"
BASE_HWPX  = TEMPLATES / "회의록_template.hwpx"
ATTENDEE_HWPX    = TEMPLATES / "참석자명단_template.hwpx"
RECEIPT_HWPX_식비  = TEMPLATES / "식비_영수증_template.hwpx"
RECEIPT_HWPX_다과비 = TEMPLATES / "다과비_영수증_template.hwpx"
REPORT_HWPX      = TEMPLATES / "결과보고서_template.hwpx"

OUTPUTS.mkdir(exist_ok=True)


def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _esc_xml(text: str) -> str:
    return (str(text or '')
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))


def _replace_cell_text(xml: str, col: int, row: int, new_text: str,
                       search_start: int = 0) -> str:
    """Replace <hp:t> content in the cell at (col, row), searching from search_start."""
    marker = f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/>'
    pos = xml.find(marker, search_start)
    if pos == -1:
        return xml

    tc_start = xml.rfind('<hp:tc ', 0, pos)
    if tc_start == -1:
        return xml

    tc_end = xml.find('</hp:tc>', pos) + len('</hp:tc>')
    cell_xml = xml[tc_start:tc_end]

    if re.search(r'<hp:t>[^<]*</hp:t>|<hp:t/>', cell_xml):
        new_cell = re.sub(
            r'<hp:t>[^<]*</hp:t>|<hp:t/>',
            f'<hp:t>{_esc_xml(new_text)}</hp:t>',
            cell_xml,
            count=1
        )
    else:
        new_cell = re.sub(
            r'<hp:run ([^>]+)/>',
            lambda m: f'<hp:run {m.group(1)}><hp:t>{_esc_xml(new_text)}</hp:t></hp:run>',
            cell_xml,
            count=1
        )

    return xml[:tc_start] + new_cell + xml[tc_end:]


# --------------------------------------------------
# 1. 회의록 (Meeting Minutes)
# --------------------------------------------------

def generate_minutes(data: dict) -> Path:
    """
    New template (회의록 수정용 판):
      - Row 0: 일시, Row 1: 장소, Row 2: 안건
      - Rows 4-6: 6 attendee slots (col pairs 1/2 and 4/5)
      - Row 7: 회의내용 (multi-paragraph cell)
      - Row 9: 회의비 (conditional 식비/다과비 + 합계)
    """
    dst = OUTPUTS / f"회의록_{_ts()}.hwpx"
    shutil.copy(BASE_HWPX, dst)

    def s(v): return str(v) if v is not None else ""
    att_list = data.get("참석자") or []
    식비 = data.get("식비") or ""
    다과비 = data.get("다과비") or ""

    tmp = str(dst) + ".tmp"
    with zipfile.ZipFile(str(dst), 'r') as zin:
        section_xml = zin.read('Contents/section0.xml').decode('utf-8')

        # 1. 제목, 일시, 장소, 안건 (unique strings — safe to use str.replace)
        section_xml = section_xml.replace(
            ' JIU 연계 AI 헬스케어 사전교육 운영 회의록',
            f' {_esc_xml(s(data.get("회의명", "")))}'
        )
        section_xml = section_xml.replace(
            '2026. 4 21.(화) 12:00 ~ 18:00 (총 6시간)',
            _esc_xml(s(data.get("일시")))
        )
        section_xml = section_xml.replace(
            '인도네시아 자카르타 국제대학교 회의실',
            _esc_xml(s(data.get("장소")))
        )
        section_xml = section_xml.replace(
            'AI 헬스케어 사전교육 운영 결과 및 JIU 연계 지역사회 봉사활동 추진 회의록',
            _esc_xml(s(data.get("안건")))
        )

        # 2. 참석자 — cell-address based, bottom-to-top right-to-left
        # (col 4/5 = right pair, col 1/2 = left pair)
        # fmt: (row, col, att_index, field)
        ATT_SLOTS = [
            (4, 1, 0, '소속'), (4, 2, 0, '이름'),
            (4, 4, 1, '소속'), (4, 5, 1, '이름'),
            (5, 1, 2, '소속'), (5, 2, 2, '이름'),
            (5, 4, 3, '소속'), (5, 5, 3, '이름'),
            (6, 1, 4, '소속'), (6, 2, 4, '이름'),
            (6, 4, 5, '소속'), (6, 5, 5, '이름'),
        ]
        for row, col, att_idx, field in reversed(ATT_SLOTS):
            val = s(att_list[att_idx].get(field)) if att_idx < len(att_list) else ''
            section_xml = _replace_cell_text(section_xml, col, row, val)

        # 3. 회의내용 — subList 전체 교체 (템플릿 굵은 텍스트 잔존 방지)
        content_lines = [ln for ln in (data.get("회의내용") or "").split(chr(10)) if ln.strip()]
        if content_lines:
            section_xml = _replace_cell_sublist_by_label(
                section_xml, '회의내용', content_lines,
                para_pr="21", char_pr="8", horzsize=41520
            )

        # 4. 회의비 — conditional 식비/다과비 paragraph + 합계
        try:
            total_raw = (
                (int("".join(filter(str.isdigit, 식비))) if 식비 else 0) +
                (int("".join(filter(str.isdigit, 다과비))) if 다과비 else 0)
            )
        except ValueError:
            total_raw = 0

        OLD_EXP = '식비 : 223,500원<hp:lineBreak/>다과비 : 000,000원'
        if 식비 and 다과비:
            new_exp = f'식비 : {_esc_xml(식비)}원<hp:lineBreak/>다과비 : {_esc_xml(다과비)}원'
        elif 식비:
            new_exp = f'식비 : {_esc_xml(식비)}원'
        elif 다과비:
            new_exp = f'다과비 : {_esc_xml(다과비)}원'
        else:
            new_exp = ''
        section_xml = section_xml.replace(OLD_EXP, new_exp)
        section_xml = section_xml.replace(
            '합계 : 000,000원',
            f'합계 : {total_raw:,}원' if total_raw else ''
        )

        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'Contents/section0.xml':
                    zout.writestr(item, section_xml.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(item.filename))

    os.remove(str(dst))
    os.rename(tmp, str(dst))
    return dst


# --------------------------------------------------
# 2. 영수증 증빙
# --------------------------------------------------

def generate_receipt(data: dict, receipt_type: str = "식비") -> Path:
    is_식비 = receipt_type == "식비"
    suffix = "식비" if is_식비 else "다과비"
    tmpl = RECEIPT_HWPX_식비 if is_식비 else RECEIPT_HWPX_다과비
    dst = OUTPUTS / f"영수증_{suffix}_{_ts()}.hwpx"
    shutil.copy(tmpl, dst)

    def s(v): return str(v) if v is not None else ""

    회의명   = s(data.get("회의명"))
    amount   = s(data.get(receipt_type) or data.get(f"{receipt_type}_금액") or "")
    date_str = s(data.get(f"{receipt_type}_일시") or data.get("일시") or "")
    detail_sfx = "식대" if is_식비 else "다과비"

    tmp = str(dst) + ".tmp"

    # Read section0 separately first, then iterate infolist
    with zipfile.ZipFile(str(dst), 'r') as zin:
        section_xml = zin.read('Contents/section0.xml').decode('utf-8')

        # 1. Title — keep <hp:lineBreak/> to preserve 2-line cell layout
        section_xml = section_xml.replace(
            '「Beyond Minerva 초격차 교육」 <hp:lineBreak/> AI Assisted Music Production 101 영수증 증빙',
            f'「{_esc_xml(회의명)}」<hp:lineBreak/>영수증 증빙'
        )

        # 2. 일시
        section_xml = section_xml.replace(
            '2026년 02월 06일 11시 55분',
            _esc_xml(date_str)
        )

        # 3. 금액
        section_xml = section_xml.replace('223,500', _esc_xml(amount))

        # 4. 집행내역 (keep _식대/_다과비 suffix intact)
        section_xml = section_xml.replace(
            'AI Assisted Music Production 101 프로그램 운영 및 교육회의 진행',
            _esc_xml(f'{회의명} 프로그램 운영 및 교육회의 진행')
        )

        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'Contents/section0.xml':
                    zout.writestr(item, section_xml.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(item.filename))

    os.remove(str(dst))
    os.rename(tmp, str(dst))
    return dst


# --------------------------------------------------
# 3. 참석자 명단 (template-based ZIP replacement)
# --------------------------------------------------

def generate_attendee_list(data: dict) -> Path:
    """
    data keys: 회의명, 일시, 장소, 참석자(list of {소속,직위,학번,이름})

    Uses 참석자명단_template.hwpx as the base.
    Replaces only: title, 일시 value, 장소 value, and attendee row cells (rows 1-25).
    Rows beyond the attendee count are cleared to empty.
    """
    dst = OUTPUTS / f"서명부_{_ts()}.hwpx"
    shutil.copy(ATTENDEE_HWPX, dst)

    def s(v): return str(v) if v is not None else ""
    attendees = data.get("참석자") or []
    tmp = str(dst) + ".tmp"

    with zipfile.ZipFile(str(dst), 'r') as zin:
        section_xml = zin.read('Contents/section0.xml').decode('utf-8')

        # 1. 제목 (Table 0)
        old_title = '「Beyond Minerva AI Assisted Music Production 101」 서명부'
        new_title = f'「{s(data.get("회의명"))}」 서명부'
        section_xml = section_xml.replace(old_title, _esc_xml(new_title))

        # 2. 일시 / 장소 (Table 1)
        section_xml = section_xml.replace(
            '2026. 2. 6.(목) 13:00 ~ 16:00',
            _esc_xml(s(data.get("일시")))
        )
        section_xml = section_xml.replace(
            '미디어랩스관 ML 619',
            _esc_xml(s(data.get("장소")))
        )

        # 3. Table 2 시작 위치
        tbl_positions = [m.start() for m in re.finditer(r'<hp:tbl ', section_xml)]
        table2_start = tbl_positions[2] if len(tbl_positions) >= 3 else 0

        # 4. 참석자 rows 1-25 (col: 0=No, 1=소속, 2=직위, 3=학번, 4=이름)
        for row_idx in range(25, 0, -1):
            att_idx = row_idx - 1
            if att_idx < len(attendees):
                att = attendees[att_idx]
                vals = {
                    0: str(row_idx),
                    1: s(att.get('소속')),
                    2: s(att.get('직위')),
                    3: s(att.get('학번') or '-'),
                    4: s(att.get('이름')),
                }
            else:
                vals = {0: '', 1: '', 2: '', 3: '', 4: ''}

            for col in (4, 3, 2, 1, 0):
                section_xml = _replace_cell_text(
                    section_xml, col, row_idx, vals[col], table2_start
                )

        # Write modified section back into the ZIP
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'Contents/section0.xml':
                    zout.writestr(item, section_xml.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(item.filename))

    os.remove(str(dst))
    os.rename(tmp, str(dst))
    return dst


# --------------------------------------------------
# 4. 행사 결과보고서
# --------------------------------------------------

def _replace_cell_sublist_by_label(xml: str, label: str, lines: list,
                                    para_pr: str = "24", char_pr: str = "14",
                                    horzsize: int = 37507) -> str:
    """Find the cell labeled 'label', then replace the next cell's subList paragraphs."""
    idx = xml.find(f'<hp:t>{label}</hp:t>')
    if idx == -1:
        return xml
    tc_end = xml.find('</hp:tc>', idx) + len('</hp:tc>')
    next_tc = xml.find('<hp:tc ', tc_end)
    if next_tc == -1:
        return xml
    sl_start = xml.find('<hp:subList ', next_tc)
    sl_end = xml.find('</hp:subList>', sl_start) + len('</hp:subList>')
    sl_tag = xml[sl_start:xml.find('>', sl_start) + 1]
    new_paras = ''.join(
        f'<hp:p id="2147483648" paraPrIDRef="{para_pr}" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="{char_pr}"><hp:t>{_esc_xml(line)}</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="{i * 1600}" '
        f'vertsize="1000" textheight="1000" baseline="850" spacing="600" '
        f'horzpos="133" horzsize="{horzsize}" flags="393216"/>'
        f'</hp:linesegarray></hp:p>'
        for i, line in enumerate(lines)
    )
    return xml[:sl_start] + sl_tag + new_paras + '</hp:subList>' + xml[sl_end:]


def _format_date_kr(date_str: str) -> str:
    m = re.search(r'(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})', date_str or '')
    if m:
        return f'{m.group(1)}년 {int(m.group(2)):02d}월 {int(m.group(3)):02d}일'
    return datetime.now().strftime('%Y년 %m월 %d일')


def generate_report(data: dict) -> Path:
    dst = OUTPUTS / f"결과보고서_{_ts()}.hwpx"
    shutil.copy(REPORT_HWPX, dst)

    def s(v): return str(v) if v is not None else ""
    def _r(xml, old, val):
        return xml.replace(old, _esc_xml(val)) if val else xml

    회의명 = s(data.get("회의명"))
    일시   = s(data.get("일시"))
    장소   = s(data.get("장소"))
    참석자 = data.get("참석자") or []

    tmp = str(dst) + ".tmp"
    with zipfile.ZipFile(str(dst), 'r') as zin:
        xml = zin.read('Contents/section0.xml').decode('utf-8')

        # 제목 (2줄 → 1줄)
        xml = xml.replace(
            '키르기스스탄 전통문화 <hp:lineBreak/>글로벌 문화교류 페스티벌 행사',
            _esc_xml(회의명)
        )

        # 기본사항 단일 값 필드
        xml = _r(xml, '[추진과제 7] AI의료융합 교육 글로벌 허브', s(data.get("추진과제")))
        xml = _r(xml, '(세부과제 7-2) 초격차 역량 강화 지향 글로벌 인재 4,000명 양성', s(data.get("세부과제")))
        xml = _r(xml, '7-2-2. 글로컬 Insight &amp; Innovation', s(data.get("과업")))
        xml = _r(xml, '글로컬 의료융합 Enterprise PBL', s(data.get("세부과업")))
        xml = _r(xml, '키르기스스탄 Global Insight &amp; Innovation 프로젝트', 회의명)
        xml = _r(xml, '글로벌커리어지원센터', s(data.get("추진본부")))
        xml = _r(xml, '향설나눔대학(다드림비교과센터)', s(data.get("실행부서")))
        budget = _format_budget(data)
        if budget and budget != '-':
            xml = xml.replace('639,865원', _esc_xml(budget))
        xml = xml.replace('GII키르기스스탄_프로그램 행사 식대', _esc_xml(f'{회의명} 행사 식대'))

        # 일시 및 장소 (lineBreak 포함 단일 문단)
        xml = xml.replace(
            '일시 : 2026.01.31.(토) 10:00 ~ 13:00 (총 3시간),<hp:lineBreak/>'
            '장소 : 키르기스스탄 비슈케크, International University of Kyrgyzstan(IUK) Startup Center',
            f'일시 : {_esc_xml(일시)}<hp:lineBreak/>장소 : {_esc_xml(장소)}'
        )

        # 대 상 (다줄)
        대상_lines = [f' 1. 대상: {회의명} 참여 인원']
        for att in 참석자:
            name  = s(att.get('이름'))
            affil = s(att.get('소속'))
            rank  = s(att.get('직위') or att.get('학번') or '')
            대상_lines.append(f'    - {name} ({affil}{" / " + rank if rank else ""})')
        대상_lines.append(f' 2. 참가자: 총 {len(참석자)}명')
        xml = _replace_cell_sublist_by_label(xml, '대 상', 대상_lines)

        # 목적 및 필요성 → 목적 필드 우선, 없으면 안건
        목적_raw = s(data.get("목적") or data.get("안건"))
        if 목적_raw:
            목적_lines = [ln.strip() for ln in 목적_raw.split('\n') if ln.strip()]
            if 목적_lines:
                xml = _replace_cell_sublist_by_label(xml, '목적 및 필요성', 목적_lines)

        # 주요 추진내용 → 회의내용
        회의내용 = s(data.get("회의내용"))
        if 회의내용:
            내용_lines = [ln.strip() for ln in 회의내용.split('\n') if ln.strip()]
            if 내용_lines:
                xml = _replace_cell_sublist_by_label(xml, '주요 추진내용', 내용_lines)

        # 운영성과 → 성과
        성과 = s(data.get("성과"))
        if 성과:
            성과_lines = [ln.strip() for ln in 성과.split('\n') if ln.strip()]
            if 성과_lines:
                xml = _replace_cell_sublist_by_label(xml, '운영성과', 성과_lines)

        # 확인 날짜
        xml = xml.replace('2026년 02월 03일 ', f'{_format_date_kr(일시)} ')

        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'Contents/section0.xml':
                    zout.writestr(item, xml.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(item.filename))

    os.remove(str(dst))
    os.rename(tmp, str(dst))
    return dst


def _format_budget(data: dict) -> str:
    parts = []
    if data.get("식비"):
        parts.append(f"식비 {data['식비']}원")
    if data.get("다과비"):
        parts.append(f"다과비 {data['다과비']}원")
    return " / ".join(parts) if parts else "-"


# --------------------------------------------------
# Orchestrator
# --------------------------------------------------

def generate_all_documents(
    data: dict,
    doc_type: str = "회의록",
    receipt_types: list[str] | None = None,
) -> list[Path]:
    """
    사용자가 선택한 문서 종류에 따라 조건부로 HWPX 파일 생성.

    doc_type      : "회의록" | "결과보고서"
    receipt_types : ["식비"], ["다과비"], ["식비","다과비"], 또는 []

    항상 생성: 참석자명단
    선택 생성: 회의록 OR 결과보고서 (doc_type 에 따라 1개만)
    선택 생성: 식비 영수증, 다과비 영수증 (receipt_types 에 포함된 경우)
    """
    if receipt_types is None:
        receipt_types = []

    results: list[Path] = []

    # 1. 참석자명단 — 무조건 생성
    results.append(generate_attendee_list(data))

    # 2. 회의록 OR 결과보고서 — 선택된 1개만
    if doc_type == "결과보고서":
        results.append(generate_report(data))
    else:
        results.append(generate_minutes(data))

    # 3. 영수증 — 체크된 항목만
    if "식비" in receipt_types and data.get("식비"):
        results.append(generate_receipt(data, receipt_type="식비"))
    if "다과비" in receipt_types and data.get("다과비"):
        results.append(generate_receipt(data, receipt_type="다과비"))

    return results
