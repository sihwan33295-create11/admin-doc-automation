# Admin Doc AI — 행정 문서 자동화 시스템

GPT-4o로 비정형 회의 메모를 파싱하여 대학 행정 HWPX 문서를 자동 생성합니다.

## 생성 문서 종류
| 파일 | 설명 |
|------|------|
| `회의록_*.hwpx` | 회의록 (참석자·내용·비용 포함) |
| `결과보고서_*.hwpx` | 행사 결과보고서 |
| `참석자명단_*.hwpx` | 참석자 명단 (동적 표) |
| `영수증_식비_*.hwpx` | 식비 영수증 증빙 |
| `영수증_다과비_*.hwpx` | 다과비 영수증 증빙 |

## 빠른 시작

### 1. 환경 설정
```bash
# .env 파일 생성
copy .env.example .env
# .env 파일에 OPENAI_API_KEY 입력
```

### 2. 백엔드 의존성 설치
```bash
cd backend
pip install -r requirements.txt
```

### 3. 프론트엔드 의존성 설치
```bash
cd frontend
npm install
```

### 4. 서버 실행
```bat
# 윈도우: 루트에서 더블클릭 또는
start.bat
```

또는 개별 실행:
```bash
# 백엔드 (포트 8000)
cd backend
uvicorn main:app --reload

# 프론트엔드 (포트 3000)
cd frontend
npm run dev
```

### 5. 브라우저 접속
http://localhost:3000

## 감사 규칙: 다과비 시간 검증
- 다과비 결제 시각이 **회의 시작 시간 이후**이면 붉은 경고 배너 표시
- 경고 상태에서는 문서 생성 버튼이 비활성화됨
- 사용자가 입력 텍스트를 수정하고 재파싱 후 생성 가능

## 기술 스택
- **Frontend**: Next.js 14 + Tailwind CSS (Coinbase style)
- **Backend**: Python FastAPI + Uvicorn
- **AI**: OpenAI gpt-4o
- **문서**: HWPX (ZIP-level XML manipulation)
