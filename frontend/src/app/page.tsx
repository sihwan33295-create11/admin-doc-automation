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
      <header className="border-b border-cb-hairline bg-cb-canvas sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cb-blue flex items-center justify-center">
              <span className="text-cb-on-dark font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-cb-ink text-sm">Admin Doc AI</span>
            <span className="text-xs text-cb-muted hidden sm:inline">행정 문서 자동화</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-cb-muted">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span>AI 연결됨</span>
            {user && (
              <>
                <span className="text-cb-hairline">|</span>
                <span className="text-cb-ink font-medium">
                  {user.emp_name}({user.emp_id})님
                </span>
                <button
                  onClick={handleLogout}
                  className="text-cb-muted hover:text-red-500 transition-colors underline underline-offset-2"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Band (dark) ── */}
      <section className="bg-cb-surface-dark text-cb-on-dark py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-6">
            {['회의록', '결과보고서', '서명부', '영수증 증빙'].map((label) => (
              <span
                key={label}
                className="text-xs font-medium px-3 py-1 rounded-pill border border-cb-on-dark-soft text-cb-on-dark-soft"
              >
                {label}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-normal text-cb-on-dark leading-tight mb-4">
            행정 문서 자동 생성
          </h1>
          <p className="text-cb-on-dark-soft text-base leading-relaxed max-w-xl">
            회의 내용을 자유롭게 입력하면 AI가 분석하여<br/>
            회의록 · 결과보고서 · 서명부 · 영수증 증빙을<br/>
            자동으로 HWPX 파일로 만들어 드립니다.
          </p>
        </div>
      </section>

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── Left: Input ── */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-cb-ink">회의 메모 입력</label>
                <button
                  onClick={handleLoadExample}
                  className="text-xs text-cb-blue hover:underline"
                >
                  예시 불러오기
                </button>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`회의 일시, 장소, 참석자, 회의 내용, 식비·다과비 결제 정보 등을 자유롭게 입력하세요.\n\n예) 2026년 2월 6일 오후 1시 학생회관에서 멘토링 프로그램 운영 회의 진행.\n참석자: 김철수 팀장, 이영희 교수, 홍길동 학생 ...\n식비 223,500원 오후 2시 결제, 다과비 50,000원 낮 12시 구매`}
                rows={14}
                className="w-full rounded-2xl border border-cb-hairline bg-cb-canvas px-4 py-3
                           text-sm text-cb-ink placeholder-cb-muted-soft
                           focus:outline-none focus:ring-2 focus:ring-cb-blue/20
                           focus:border-cb-blue transition-colors leading-relaxed"
              />
              <p className="text-xs text-cb-muted">{inputText.length} 자 입력됨</p>
            </div>

            {parseError && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {parseError}
              </div>
            )}

            <button
              onClick={handleParse}
              disabled={isParsing || !inputText.trim()}
              className={`w-full py-3.5 rounded-pill font-semibold text-sm transition-all
                ${!inputText.trim()
                  ? 'bg-cb-surface-strong text-cb-muted cursor-not-allowed'
                  : isParsing
                  ? 'bg-cb-blue-disabled text-cb-on-dark cursor-not-allowed'
                  : 'bg-cb-blue hover:bg-cb-blue-active active:bg-cb-blue-active text-cb-on-dark shadow-sm'
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
                'AI 분석하기'
              )}
            </button>

            {/* Feature hints */}
            <div className="rounded-2xl border border-cb-hairline p-4 bg-cb-surface-soft">
              <p className="text-xs font-semibold text-cb-muted mb-2 uppercase tracking-wide">
                자동 처리 항목
              </p>
              <ul className="text-xs text-cb-body space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-cb-blue">✦</span>
                  구어체 → 행정 개조식 문체 변환
                </li>
                <li className="flex gap-2">
                  <span className="text-cb-blue">✦</span>
                  참석자 표 동적 생성 (소속·직위·학번·이름)
                </li>
                <li className="flex gap-2 text-red-500 font-medium">
                  <span>⚠</span>
                  다과비 결제 시간 감사 검증 (회의 시작 이전 필수)
                </li>
                <li className="flex gap-2">
                  <span className="text-cb-blue">✦</span>
                  식비·다과비 각각 별도 영수증 파일 생성
                </li>
              </ul>
            </div>
          </div>

          {/* ── Right: Result ── */}
          <div>
            {!parsedData && !isParsing && (
              <div className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-cb-hairline text-center p-8">
                <div className="w-12 h-12 rounded-full bg-cb-surface-strong flex items-center justify-center mb-4">
                  <span className="text-2xl">📋</span>
                </div>
                <p className="text-sm font-medium text-cb-ink mb-1">분석된 결과가 여기에 표시됩니다.</p>
                <p className="text-xs text-cb-muted">좌측에 내용을 입력하고 [AI 분석하기] 버튼을 누르세요</p>
              </div>
            )}

            {isParsing && (
              <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-cb-hairline">
                <svg className="animate-spin h-8 w-8 text-cb-blue mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-cb-muted">GPT-4o가 회의 내용을 분석하고 있습니다…</p>
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
      <footer className="border-t border-cb-hairline mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-cb-muted">
          <span>Admin Doc AI — 행정 문서 자동화 시스템</span>
          <span>Powered by GPT-4o + HWPX</span>
        </div>
      </footer>
    </div>
  )
}
