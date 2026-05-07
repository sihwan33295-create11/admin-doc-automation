"""
OpenAI API integration for parsing free-text meeting notes
into structured JSON for HWPX document generation.
"""

import json
import os
from typing import Any

from openai import AsyncOpenAI


def _get_client() -> AsyncOpenAI:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY 환경변수가 설정되지 않았습니다. "
            ".env 파일에 OPENAI_API_KEY=... 를 추가해 주세요."
        )
    return AsyncOpenAI(
        api_key=key,
        base_url="https://factchat-cloud.mindlogic.ai/v1/gateway",
    )

SYSTEM_PROMPT = """
당신은 대학 행정 문서 자동화 전문 AI입니다.
사용자가 입력한 비정형 회의 메모를 분석하여 아래 JSON 스키마를 반드시 준수하는 구조화된 데이터로 변환하세요.

## 출력 JSON 스키마
{
  "회의명": "string — 행사·프로그램 공식 명칭",
  "일시": "string — YYYY. M. D.(요일) HH:MM ~ HH:MM 형태",
  "장소": "string — 정확한 장소명",
  "안건": "string — 회의 안건 (공문서 문체, 1~2문장)",
  "참석자": [
    {
      "소속": "string",
      "직위": "string — 교수/팀장/직원/학생 등",
      "학번": "string — 학생이면 학번, 아니면 '-'",
      "이름": "string"
    }
  ],
  "회의내용": "string — 아래 ★규칙 엄격 적용★",
  "목적": "string — 아래 ★목적 규칙★ 적용",
  "추진과제": "string — 해당되면 기재, 없으면 ''",
  "세부과제": "string",
  "과업": "string",
  "세부과업": "string",
  "추진본부": "string — 주관 부서명",
  "실행부서": "string",
  "성과": "string — 아래 ★성과 규칙★ 적용",
  "향후계획": "string — 있으면 기재",
  "식비": "string | null — 식비 금액 (숫자+쉼표, 예: '223,500'), 없으면 null",
  "식비_일시": "string | null — 식비 결제 일시 (YYYY년 MM월 DD일 HH시 MM분), 없으면 null",
  "식비_금액": "string | null — 위의 식비와 동일",
  "다과비": "string | null — 다과비 금액, 없으면 null",
  "다과비_일시": "string | null — 다과비 결제 일시, 없으면 null",
  "다과비_금액": "string | null — 위의 다과비와 동일",
  "missing_warnings": ["string — 누락된 중요 정보에 대한 안내 메시지"]
}

## ★★★ 회의내용 필드 작성 규칙 (절대 준수) ★★★

### 회의내용에 절대 포함하지 말 것 (엄격 금지):
1. 일시·장소·참석자 정보 — 이미 별도 필드로 추출했으므로 중복 기재 금지
2. 식비·다과비·오찬·영수증·다과 준비 등 예산 지출 및 행정 관련 내용 — 해당 내용은 식비/다과비 필드에만 기재
3. "회의를 시작하였다", "자리를 마련하였다" 같은 형식적 서술어 금지
4. 프로그램 운영 개요나 행사 준비 과정 설명 금지

### 회의내용에 반드시 포함할 것:
1. 특강·발표의 주요 내용 및 핵심 주제 (구체적으로)
2. 핵심 논의 안건과 결정 사항
3. 질의응답 내용 (있는 경우)
4. 향후 추진 방향이나 합의 사항

### ★★★ 회의내용 유추 절대 의무 규칙 ★★★
**이 규칙은 절대 예외 없이 적용됩니다.**

- `"회의내용": ""` 또는 `"회의내용": null` 출력은 **절대 금지**
- 입력 메모에 회의 내용이 전혀 없어도 반드시 회의내용 필드를 채워야 합니다
- 유추 방법: 회의명·안건으로 주제 파악 → 참석자 역할로 논의 구조 파악 → 개조식 **5~8줄** 작성
- 강사가 참석자에 있으면 반드시 특강 세부 내용을 3줄 이상 구체적으로 유추
- 학생이 참석자에 있으면 교육·발표·피드백 내용 포함
- **분량 기준: 대주제(▮) 2개 이상, 세부항목(⦁) 총 5개 이상**

**유추 예시:**
- 회의명 "글로벌 마케팅 실무 특강 5회차" →
  `"▮ 글로벌 마케팅 실무 특강 진행\n⦁ 해외 마케팅 전략 수립 방법론 소개 및 실습\n⦁ 주요 글로벌 기업 사례 분석 및 시사점 도출\n⦁ 현지화 전략 및 문화적 고려사항 논의\n⦁ 수강생 질의응답 및 개별 피드백 진행\n▮ 향후 운영 방향 논의\n⦁ 다음 회차 주제 및 일정 협의\n⦁ 수강생 과제 부여 및 발표 방식 합의"`

### 형식:
- 개조식 행정 문체: ▮ 대주제 / ⦁ 세부사항 구조
- 동사 종결: '~함', '~완료', '~예정', '~추진'
- 불필요한 서론·결론 없이 핵심 내용만

## ★★★ 목적 필드 작성 규칙 ★★★
- 회의명·안건·추진본부를 바탕으로 이 행사/회의의 목적 및 필요성을 **3~5개 bullet** 으로 작성
- 각 항목은 ' - ' 로 시작하고 '~강화', '~증진', '~확대', '~도모' 등 명사형 종결
- 절대 빈 문자열 금지 — 메모에 목적이 없어도 회의명에서 유추하여 반드시 작성
- 형식 예시: `" - 참여 학생 실무 역량 강화\n - 외부 전문가 연계를 통한 교육 품질 향상\n - 프로그램 운영 성과 점검 및 개선 방향 도출"`

## ★★★ 성과 필드 작성 규칙 ★★★
- `"성과": ""` 또는 `"성과": null` 출력은 **절대 금지**
- 메모에 성과가 명시되지 않아도 회의명·회의내용을 바탕으로 반드시 유추하여 작성
- **3~5개 항목**으로 작성, 각 항목 줄바꿈(\n) 구분
- 숫자·참석인원 등 구체적 수치가 있으면 반드시 포함
- 형식: `"1. ~달성\n2. ~확인\n3. ~완료"` 또는 bullet 형식
- 유추 예시: 특강 → "수강생 만족도 향상 및 실무 역량 강화", "외부 강사 초청을 통한 교육 다양성 확보"

## 행정 문체 변환 규칙
- 구어체 → 개조식 행정 문체로 반드시 변환

## 중요 규칙
- 모든 날짜는 '2026. 4. 21.(화)' 형태로 표준화 (앞에 0 붙이지 않음)
- 다과비 결제 시간은 회의 시작 시간 **이전**이어야 합니다
- 식비_일시·다과비_일시가 메모에 명시되지 않았으면 null로 반환 (임의로 추측하지 않음)
- JSON 외의 텍스트를 절대 출력하지 마세요

## [결측치 및 누락 정보 처리]
- 사용자가 제공한 텍스트를 분석하여, 행정 문서 처리에 필수적인 정보가 누락된 경우 `missing_warnings` 배열에 구체적인 권고 메시지를 작성하세요.
- 예시 1: 다과비 결제 금액은 있는데 결제 시간이 없는 경우 → "다과비 결제 시간이 누락되었습니다. 정확한 시간을 입력해주세요."
- 예시 2: 회의 일자나 장소가 없는 경우 → "회의 일자 및 장소 정보가 없습니다."
- 예시 3: 참석자는 있는데 소속/직위가 없는 경우 → "일부 참석자의 소속과 직위 정보가 누락되었습니다."
- 모든 정보가 완벽하다면 빈 배열 [] 을 반환하세요.
"""


CONTENT_INFER_PROMPT = """
당신은 대학 행정 문서 작성 전문가입니다.
아래 회의 정보를 바탕으로 '회의내용' 필드만 작성하세요.

규칙:
- 개조식 행정 문체: ▮ 대주제 / ⦁ 세부사항 구조
- 동사 종결: '~함', '~완료', '~예정', '~추진'
- 일시·장소·참석자·식비 등 다른 필드 내용 포함 금지
- 강사가 있으면 특강 내용을 구체적으로 유추
- 학생이 있으면 교육·발표·피드백 내용 포함
- 반드시 3~6줄 이상 작성
- 텍스트만 출력 (JSON 불필요)
"""


async def parse_meeting_notes(user_input: str) -> dict[str, Any]:
    """
    사용자 자유 입력 → 구조화된 dict 반환
    회의내용이 비어 있으면 별도 호출로 생성 (폴백)
    """
    client = _get_client()
    response = await client.chat.completions.create(
        model="claude-sonnet-4-6",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_input},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content
    import re
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        raw = match.group(0)
    parsed = json.loads(raw)

    # 폴백: 회의내용이 비어 있으면 별도 호출로 생성
    if not parsed.get("회의내용"):
        parsed["회의내용"] = await _infer_content(client, parsed)

    # 폴백: 성과가 비어 있으면 유추
    if not parsed.get("성과"):
        parsed["성과"] = await _infer_outcome(client, parsed)

    # 폴백: 목적이 비어 있으면 유추
    if not parsed.get("목적"):
        parsed["목적"] = await _infer_purpose(client, parsed)

    return parsed


async def _infer_outcome(client, data: dict) -> str:
    """성과가 비어있을 때 유추 생성"""
    context = (
        f"회의명: {data.get('회의명', '')}\n"
        f"안건: {data.get('안건', '')}\n"
        f"회의내용 요약: {(data.get('회의내용') or '')[:200]}"
    )
    prompt = (
        "대학 행정 문서 전문가로서 아래 회의 정보를 바탕으로 '운영성과' 항목만 작성하세요.\n"
        "규칙:\n"
        "- 3~5개 항목, 줄바꿈(\\n) 구분\n"
        "- '1. ~달성', '2. ~확인' 형식 또는 ' - ~강화' bullet 형식\n"
        "- 구체적 수치나 효과를 포함하여 유추\n"
        "- 텍스트만 출력"
    )
    resp = await client.chat.completions.create(
        model="claude-sonnet-4-6",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": context},
        ],
        temperature=0.4,
    )
    return resp.choices[0].message.content.strip()


async def _infer_purpose(client, data: dict) -> str:
    """목적이 비어있을 때 유추 생성"""
    context = (
        f"회의명: {data.get('회의명', '')}\n"
        f"안건: {data.get('안건', '')}\n"
        f"추진본부: {data.get('추진본부', '')}"
    )
    prompt = (
        "대학 행정 문서 전문가로서 아래 회의/행사의 '목적 및 필요성'을 작성하세요.\n"
        "규칙:\n"
        "- 3~5개 bullet, 각 항목 ' - '로 시작, 줄바꿈(\\n) 구분\n"
        "- '~강화', '~증진', '~확대', '~도모' 등 명사형 종결\n"
        "- 텍스트만 출력"
    )
    resp = await client.chat.completions.create(
        model="claude-sonnet-4-6",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": context},
        ],
        temperature=0.4,
    )
    return resp.choices[0].message.content.strip()


async def _infer_content(client, data: dict) -> str:
    """회의내용이 비어있을 때 다른 필드 정보로 유추해서 생성"""
    att_lines = ", ".join(
        f"{a.get('이름')}({a.get('소속')}/{a.get('직위')})"
        for a in (data.get("참석자") or [])
    )
    context = (
        f"회의명: {data.get('회의명', '')}\n"
        f"안건: {data.get('안건', '')}\n"
        f"참석자: {att_lines}\n"
        f"추진본부: {data.get('추진본부', '')}"
    )
    resp = await client.chat.completions.create(
        model="claude-sonnet-4-6",
        messages=[
            {"role": "system", "content": CONTENT_INFER_PROMPT},
            {"role": "user", "content": context},
        ],
        temperature=0.4,
    )
    return resp.choices[0].message.content.strip()


def validate_receipt_timing(data: dict) -> list[str]:
    """
    다과비 결제 시간이 회의 시작 시간보다 이전인지 검증.
    위반 시 경고 메시지 리스트 반환 (비어 있으면 OK).
    """
    warnings = []
    meeting_time_str = data.get("일시", "")
    mt = _parse_meeting_start(meeting_time_str)

    if data.get("다과비"):
        if not data.get("다과비_일시"):
            warnings.append(
                "📋 다과비 결제 시각이 입력되지 않았습니다. "
                "감사 규정상 다과비는 회의 시작 전에 결제되어야 합니다. "
                "영수증의 결제 시각을 확인하여 입력해 주세요."
            )
        else:
            rt = _parse_receipt_time(data["다과비_일시"])
            if mt and rt and rt >= mt:
                warnings.append(
                    f"⚠️ 다과비 결제 시각({data['다과비_일시']})이 회의 시작 시간({meeting_time_str}) "
                    f"이후입니다. 감사 규정에 따라 다과비는 회의 시작 전 결제되어야 합니다. "
                    f"시간을 수정해 주세요."
                )
    return warnings


def _parse_meeting_start(s: str):
    from datetime import datetime
    import re
    m = re.search(r'(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2}).*?(\d{1,2}):(\d{2})', s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                            int(m.group(4)), int(m.group(5)))
        except Exception:
            return None
    return None


def _parse_receipt_time(s: str):
    from datetime import datetime
    import re
    m = re.search(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시\s*(\d{1,2})분', s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                            int(m.group(4)), int(m.group(5)))
        except Exception:
            return None
    return None
