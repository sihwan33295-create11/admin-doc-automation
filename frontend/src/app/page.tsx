'use client'

import React, { useState, useEffect } from 'react'
import ResultPanel from '@/components/ResultPanel'

interface ParsedData {
  회의명?: string
  일시?: string
  장소?: string
  안건?: string
  추진본부?: string
  실행부서?: string
  식비?: string | null
  식비_일시?: string | null
  다과비?: string | null
  다과비_일시?: string | null
  성과?: string
  향후계획?: string
  회의내용?: string
  참석자?: { 소속: string; 직위: string; 학번: string; 이름: string }[]
  [key: string]: unknown
}

interface UserInfo {
  emp_id: string
  emp_name: string
}

const EXAMPLE_TEXT = `프로그램명: 2026학년도 글로벌 진로개발 특강 운영 회의
일시: 2026년 3월 12일 수요일 오후 2시부터 4시까지
장소: 행정관 3층 소회의실 302호
추진본부: 학생처 진로취업지원팀

참석자:
- 홍길동 / 진로취업지원팀 / 팀장
- 김민지 / 진로취업지원팀 / 담당자
- 이준호 / 경영학과 / 교수
- 박소연 / 컴퓨터공학과 / 학생 / 20230145
- 최다은 / 글로벌비즈니스학과 / 학생 / 20240312

회의 내용:
- 2026학년도 1학기 글로벌 진로개발 특강 운영 계획 검토
- 외부 특강 강사 섭외 현황 공유 (기업 현직자 4명 확정)
- 특강 일정 조율 및 강의실 배정 논의
- 수강 신청 방식 및 홍보 계획 수립
- 차기 운영 예산 배분 협의

식비: 156,000원 / 결제일시: 2026년 3월 12일 16시 20분 (회의 후 식당 결제)
다과비: 35,000원 / 결제일시: 2026년 3월 12일 13시 45분 (회의 전 다과 구매)`

const STORAGE_KEY = 'admin_doc_user'

export default function HomePage() {
  const [inputText, setInputText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [missingWarnings, setMissingWarnings] = useState<string[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([])
  const [parseError, setParseError] = useState('')

  // 사용자 식별 상태
  const [user, setUser] = useState<UserInfo | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [loginName, setLoginName] = useState('')
  const [loginError, setLoginError] = useState('')

  // 마운트 시 로컬스토리지에서 사용자 정보 확인
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        setShowLoginModal(true)
      }
    } else {
      setShowLoginModal(true)
    }
  }, [])

  const handleLogin = () => {
    if (!loginId.trim() || !loginName.trim()) {
      setLoginError('사번과 이름을 모두 입력해 주세요.')
      return
    }
    const info: UserInfo = { emp_id: loginId.trim(), emp_name: loginName.trim() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
    setUser(info)
    setShowLoginModal(false)
    setLoginError('')
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setLoginId('')
    setLoginName('')
    setShowLoginModal(true)
  }

  const handleParse = async () => {
    if (!inputText.trim()) return
    setIsParsing(true)
    setParseError('')
    setParsedData(null)
    setWarnings([])
    setMissingWarnings([])
    setGeneratedFiles([])

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          emp_id: user?.emp_id ?? '',
          emp_name: user?.emp_name ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setParseError(json.detail || '파싱 중 오류가 발생했습니다.')
        return
      }
      setParsedData(json.data)
      setWarnings(json.warnings || [])
      setMissingWarnings(json.missing_warnings || [])
    } catch {
      setParseError('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleGenerate = async (docType: string, receiptTypes: string[]) => {
    if (!parsedData) return
    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsedData, doc_type: docType, receipt_types: receiptTypes }),
      })
      const json = await res.json()
      if (!res.ok) {
        setWarnings((prev) => [...prev, json.detail || '문서 생성 오류'])
        return
      }
      setGeneratedFiles(json.files || [])
      if (json.warnings?.length) {
        setWarnings((prev) => [...new Set([...prev, ...json.warnings])])
      }
    } catch {
      setWarnings((prev) => [...prev, '서버에 연결할 수 없습니다.'])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLoadExample = () => {
    setInputText(EXAMPLE_TEXT)
    setParsedData(null)
    setWarnings([])
    setMissingWarnings([])
    setGeneratedFiles([])
    setParseError('')
  }

  return (
    <div className="min-h-screen bg-cb-canvas font-sans">

      {/* ── 로그인 모달 ── */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-cb-blue flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <p className="font-semibold text-cb-ink text-sm">Admin Doc AI</p>
                <p className="text-xs text-cb-muted">사번과 이름을 입력해 주세요</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-cb-ink mb-1">사번</label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="예) 20240012"
                  className="w-full rounded-xl border border-cb-hairline px-3 py-2.5 text-sm text-cb-ink
                             focus:outline-none focus:ring-2 focus:ring-cb-blue/20 focus:border-cb-blue transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cb-ink mb-1">이름</label>
                <input
                  type="text"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="예) 홍길동"
                  className="w-full rounded-xl border border-cb-hairline px-3 py-2.5 text-sm text-cb-ink
                             focus:outline-none focus:ring-2 focus:ring-cb-blue/20 focus:border-cb-blue transition-colors"
                />
              </div>
            </div>

            {loginError && (
              <p className="text-xs text-red-500 mb-3">{loginError}</p>
            )}

            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-pill bg-cb-blue hover:bg-cb-blue-active text-white font-semibold text-sm transition-all shadow-sm"
            >
              시작하기
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-cb-hairline sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cb-blue flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm tracking-tight">A</span>
            </div>
            <span className="font-bold text-cb-ink text-sm tracking-tight">Admin Doc AI</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-cb-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              <span>AI 연결됨</span>
            </div>
            {user && (
              <>
                <div className="h-3 w-px bg-cb-hairline" />
                <span className="text-cb-ink font-semibold">
                  {user.emp_name}
                  <span className="font-normal text-cb-muted ml-1">({user.emp_id})</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-cb-muted hover:text-cb-ink transition-colors text-xs font-medium border border-cb-hairline rounded-pill px-2.5 py-1 hover:border-cb-ink"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Band ── */}
      <section className="bg-white text-cb-ink pt-14 pb-12 px-6 border-b border-cb-hairline">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-5">
            {['회의록', '결과보고서', '서명부', '영수증 증빙'].map((label) => (
              <span
                key={label}
                className="text-xs font-semibold px-3 py-1 rounded-pill bg-cb-blue text-white tracking-wide"
              >
                {label}
              </span>
            ))}
          </div>
          <h1 className="text-[2.75rem] font-bold text-cb-ink leading-tight mb-4 tracking-tight">
            행정 문서 자동화
          </h1>
          <p className="text-cb-body text-base leading-relaxed max-w-xl">
            회의 내용을 자유롭게 입력하면 AI가 분석하여<br/>
            회의록 · 결과보고서 · 서명부 · 영수증 증빙을<br/>
            자동으로 HWPX 파일로 만들어 드립니다.
          </p>
        </div>
      </section>

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── Left: Input ── */}
          <div className="flex flex-col gap-4">

            {/* Input card */}
            <div className="bg-white rounded-2xl border border-cb-hairline shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-cb-hairline flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-cb-muted uppercase tracking-widest mb-0.5">Step 1</p>
                  <h2 className="text-sm font-bold text-cb-ink">회의 메모 입력</h2>
                </div>
                <button
                  onClick={handleLoadExample}
                  className="text-xs font-semibold text-cb-blue border border-cb-blue/30 rounded-pill px-3 py-1.5 hover:bg-cb-blue hover:text-white transition-all"
                >
                  예시 불러오기
                </button>
              </div>
              <div className="p-5">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`회의 일시, 장소, 참석자, 회의 내용, 식비·다과비 결제 정보 등을 자유롭게 입력하세요.\n\n예) 2026년 2월 6일 오후 1시 학생회관에서 멘토링 프로그램 운영 회의 진행.\n참석자: 김철수 팀장, 이영희 교수, 홍길동 학생 ...\n식비 223,500원 오후 2시 결제, 다과비 50,000원 낮 12시 구매`}
                  rows={13}
                  className="w-full rounded-xl border border-cb-hairline bg-cb-surface-soft px-4 py-3
                             text-sm text-cb-ink placeholder-cb-muted-soft
                             focus:outline-none focus:ring-2 focus:ring-cb-blue/20
                             focus:border-cb-blue transition-colors leading-relaxed"
                />
                <p className="text-xs text-cb-muted mt-2">{inputText.length.toLocaleString()} 자</p>
              </div>
            </div>

            {parseError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex gap-2 items-start">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{parseError}</span>
              </div>
            )}

            <button
              onClick={handleParse}
              disabled={isParsing || !inputText.trim()}
              className={`w-full py-4 rounded-pill font-bold text-sm tracking-wide transition-all
                ${!inputText.trim()
                  ? 'bg-cb-surface-strong text-cb-muted cursor-not-allowed'
                  : isParsing
                  ? 'bg-cb-blue-disabled text-white cursor-not-allowed'
                  : 'bg-cb-blue hover:bg-cb-blue-active active:scale-[0.99] text-white shadow-md shadow-cb-blue/20'
                }`}
            >
              {isParsing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI 분석 중…
                </span>
              ) : (
                'AI 분석하기 →'
              )}
            </button>

            {/* Feature hints */}
            <div className="rounded-2xl border border-cb-hairline bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-cb-hairline">
                <p className="text-[10px] font-semibold text-cb-muted uppercase tracking-widest">자동 처리 항목</p>
              </div>
              <ul className="px-5 py-4 text-xs text-cb-body space-y-3">
                <li className="flex gap-3 items-start">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-cb-blue/10 text-cb-blue flex items-center justify-center shrink-0 font-bold text-[10px]">✓</span>
                  구어체 → 행정 개조식 문체 변환
                </li>
                <li className="flex gap-3 items-start">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-cb-blue/10 text-cb-blue flex items-center justify-center shrink-0 font-bold text-[10px]">✓</span>
                  참석자 표 동적 생성 (소속 · 직위 · 학번 · 이름)
                </li>
                <li className="flex gap-3 items-start text-red-500 font-semibold">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-[10px]">!</span>
                  다과비 결제 시간 감사 검증 (회의 시작 이전 필수)
                </li>
                <li className="flex gap-3 items-start">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-cb-blue/10 text-cb-blue flex items-center justify-center shrink-0 font-bold text-[10px]">✓</span>
                  식비 · 다과비 각각 별도 영수증 파일 생성
                </li>
              </ul>
            </div>
          </div>

          {/* ── Right: Result ── */}
          <div>
            {!parsedData && !isParsing && (
              <div className="bg-white rounded-2xl border border-cb-hairline shadow-sm flex flex-col items-center justify-center h-72 text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-cb-blue/8 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-cb-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-cb-ink mb-1.5">분석된 결과가 여기에 표시됩니다</p>
                <p className="text-xs text-cb-muted leading-relaxed">
                  좌측에 회의 내용을 입력하고<br/>[AI 분석하기] 버튼을 누르세요
                </p>
              </div>
            )}

            {isParsing && (
              <div className="bg-white rounded-2xl border border-cb-hairline shadow-sm flex flex-col items-center justify-center h-72">
                <div className="w-14 h-14 rounded-2xl bg-cb-blue/8 flex items-center justify-center mb-4">
                  <svg className="animate-spin h-6 w-6 text-cb-blue" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-cb-ink mb-1">AI 분석 중</p>
                <p className="text-xs text-cb-muted">회의 내용을 구조화하고 있습니다…</p>
              </div>
            )}

            {(parsedData || warnings.length > 0 || generatedFiles.length > 0) && (
              <ResultPanel
                parsedData={parsedData}
                warnings={warnings}
                missingWarnings={missingWarnings}
                generatedFiles={generatedFiles}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-cb-hairline mt-16 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-cb-blue flex items-center justify-center">
              <span className="text-white font-bold text-[9px]">A</span>
            </div>
            <span className="text-xs font-semibold text-cb-ink">Admin Doc AI</span>
          </div>
          <span className="text-xs text-cb-muted">Powered by GPT-4o + HWPX</span>
        </div>
      </footer>
    </div>
  )
}
