"""
FastAPI backend for AI-powered university administrative document automation.

Endpoints:
  POST /api/parse    — Parse free text with OpenAI → structured JSON preview
  POST /api/generate — Generate HWPX files from structured data
  GET  /api/download/{filename} — Download a generated HWPX file
  GET  /api/files    — List recently generated files
"""

import os
import json
import urllib.request
import requests as _requests
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, List, Optional

KST = timezone(timedelta(hours=9))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ai_parser import parse_meeting_notes, validate_receipt_timing
from hwpx_handler import generate_all_documents, OUTPUTS

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path, override=True)
except ImportError:
    pass

app = FastAPI(title="Admin Doc Automation API", version="1.0.0")

_cors_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────
# Request / Response models
# ──────────────────────────────────────────────────────────

class ParseRequest(BaseModel):
    text: str
    emp_id: Optional[str] = None
    emp_name: Optional[str] = None


class GenerateRequest(BaseModel):
    data: dict[str, Any]
    doc_type: str = "회의록"          # "회의록" | "결과보고서"
    receipt_types: list[str] = []    # [] or ["식비"], ["다과비"], ["식비","다과비"]


class ParseResponse(BaseModel):
    data: dict[str, Any]
    warnings: list[str]
    missing_warnings: List[str] = []
    background: List[str] = []
    future_plan: List[str] = []


class GenerateResponse(BaseModel):
    files: list[str]
    warnings: list[str]


# ──────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────

LOG_FILE = Path(__file__).parent / "user_logs.txt"
SHEETS_URL = os.environ.get("GOOGLE_SHEETS_URL", "")

def _write_log(emp_id: str, emp_name: str, text: str) -> None:
    ts = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")
    snippet = text.replace("\n", " ").replace("\r", " ").strip()
    if len(snippet) > 100:
        snippet = snippet[:100] + "..."

    # 로컬 파일 기록
    try:
        user_label = f"{emp_name}({emp_id})" if emp_name or emp_id else "미식별"
        line = f"[{ts}] 사용자: {user_label} | 입력 메모: {snippet}\n"
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass

    # Google Sheets 기록
    if SHEETS_URL:
        try:
            params = {
                "timestamp": ts,
                "emp_id": emp_id or "미식별",
                "emp_name": emp_name or "미식별",
                "snippet": snippet,
            }
            _requests.get(SHEETS_URL, params=params, timeout=10)
        except Exception:
            pass


@app.post("/api/parse", response_model=ParseResponse)
async def api_parse(req: ParseRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="입력 텍스트가 비어 있습니다.")

    _write_log(req.emp_id or "", req.emp_name or "", req.text)

    try:
        parsed = await parse_meeting_notes(req.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI 파싱 오류: {str(e)}")

    warnings = validate_receipt_timing(parsed)
    missing_warnings = parsed.pop("missing_warnings", []) or []
    background = parsed.get("background", []) or []
    future_plan = parsed.get("future_plan", []) or []
    return ParseResponse(
        data=parsed,
        warnings=warnings,
        missing_warnings=missing_warnings,
        background=background,
        future_plan=future_plan,
    )


@app.post("/api/generate", response_model=GenerateResponse)
async def api_generate(req: GenerateRequest):
    data = req.data

    warnings = validate_receipt_timing(data)
    blocking = [w for w in warnings if "다과비 결제 시각" in w]
    if blocking:
        raise HTTPException(status_code=400, detail=blocking[0])

    try:
        paths = generate_all_documents(
            data,
            doc_type=req.doc_type,
            receipt_types=req.receipt_types,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"문서 생성 오류: {str(e)}")

    filenames = [p.name for p in paths]
    return GenerateResponse(files=filenames, warnings=warnings)


@app.get("/api/download/{filename}")
async def api_download(filename: str, background_tasks: BackgroundTasks):
    target = (OUTPUTS / filename).resolve()
    if not str(target).startswith(str(OUTPUTS.resolve())):
        raise HTTPException(status_code=403, detail="접근이 거부되었습니다.")
    if not target.exists():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    background_tasks.add_task(os.remove, str(target))
    return FileResponse(
        path=str(target),
        filename=filename,
        media_type="application/octet-stream",
    )


@app.get("/api/files")
async def api_files():
    files = sorted(OUTPUTS.glob("*.hwpx"), key=lambda f: f.stat().st_mtime, reverse=True)
    return {"files": [f.name for f in files[:20]]}


@app.get("/api/logs")
async def api_logs(secret: str = ""):
    admin_secret = os.environ.get("LOG_SECRET", "")
    if not admin_secret or secret != admin_secret:
        raise HTTPException(status_code=403, detail="접근이 거부되었습니다.")
    if not LOG_FILE.exists():
        return {"logs": [], "total": 0}
    lines = LOG_FILE.read_text(encoding="utf-8").splitlines()
    lines = [l for l in lines if l.strip()]
    return {"logs": list(reversed(lines)), "total": len(lines)}


@app.get("/api/health")
async def health():
    return {"status": "ok", "openai_key_set": bool(os.environ.get("OPENAI_API_KEY"))}
