@echo off
echo ============================================
echo  Admin Doc AI - 서버 시작
echo ============================================

:: .env 파일 존재 확인
if not exist .env (
    echo [경고] .env 파일이 없습니다. .env.example 을 복사하여 OPENAI_API_KEY를 설정하세요.
    copy .env.example .env
    echo .env 파일을 생성했습니다. OPENAI_API_KEY 를 입력해 주세요.
    pause
    exit /b 1
)

echo [1/2] 백엔드 서버 시작 (포트 8000)...
start "FastAPI Backend" cmd /k "cd /d backend && C:\Users\yuseRR\AppData\Local\Python\pythoncore-3.14-64\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo [2/2] 프론트엔드 서버 시작 (포트 3000)...
start "Next.js Frontend" cmd /k "cd /d frontend && npm run dev"

echo.
echo ============================================
echo  서버가 시작되었습니다!
echo  브라우저에서 http://localhost:3000 을 열어주세요
echo ============================================
pause
