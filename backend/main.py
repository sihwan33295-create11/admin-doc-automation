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
from pathlib import Path
from typing import Any, List

from fastapi import FastAPI, HTTPException
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


class GenerateRequest(BaseModel):
    data: dict[str, Any]
    doc_type: str = "회의록"          # "회의록" | "결과보고서"
    receipt_types: list[str] = []    # [] or ["식비"], ["다과비"], ["식비","다과비"]


class ParseResponse(BaseModel):
    data: dict[str, Any]
    warnings: list[str]
    missing_warnings: List[str] = []


class GenerateResponse(BaseModel):
    files: list[str]
    warnings: list[str]


# ──────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────

@app.post("/api/parse", response_model=ParseResponse)
async def api_parse(req: ParseRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="입력 텍스트가 비어 있습니다.")
    try:
        parsed = await parse_meeting_notes(req.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI 파싱 오류: {str(e)}")

    warnings = validate_receipt_timing(parsed)
    missing_warnings = parsed.pop("missing_warnings", []) or []
    return ParseResponse(data=parsed, warnings=warnings, missing_warnings=missing_warnings)


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
async def api_download(filename: str):
    target = (OUTPUTS / filename).resolve()
    if not str(target).startswith(str(OUTPUTS.resolve())):
        raise HTTPException(status_code=403, detail="접근이 거부되었습니다.")
    if not target.exists():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=str(target),
        filename=filename,
        media_type="application/octet-stream",
    )


@app.get("/api/files")
async def api_files():
    files = sorted(OUTPUTS.glob("*.hwpx"), key=lambda f: f.stat().st_mtime, reverse=True)
    return {"files": [f.name for f in files[:20]]}


@app.get("/api/health")
async def health():
    return {"status": "ok", "openai_key_set": bool(os.environ.get("OPENAI_API_KEY"))}
