'use client'

import React, { useState } from 'react'

interface Attendee {
  소속: string
  직위: string
  학번: string
  이름: string
}

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
  background?: string[]
  future_plan?: string[]
  참석자?: Attendee[]
  missing_warnings?: string[]
  [key: string]: unknown
}

interface ResultPanelProps {
  parsedData: ParsedData | null
  warnings: string[]
  missingWarnings: string[]
  generatedFiles: string[]
  onGenerate: (docType: string, receiptTypes: string[]) => void
  isGenerating: boolean
}

const FIELD_LABELS: { key: keyof ParsedData; label: string }[] = [
  { key: '회의명', label: '프로그램명' },
  { key: '일시', label: '일시' },
  { key: '장소', label: '장소' },
  { key: '안건', label: '안건' },
  { key: '추진본부', label: '추진본부' },
  { key: '실행부서', label: '실행부서' },
  { key: '식비', label: '식비 금액' },
  { key: '식비_일시', label: '식비 결제 일시' },
  { key: '다과비', label: '다과비 금액' },
  { key: '다과비_일시', label: '다과비 결제 일시' },
  { key: '성과', label: '성과' },
  { key: '향후계획', label: '향후계획' },
]

export default function ResultPanel({
  parsedData,
  warnings,
  missingWarnings,
  generatedFiles,
  onGenerate,
  isGenerating,
}: ResultPanelProps) {
  const [docType, setDocType] = useState<'회의록' | '결과보고서'>('회의록')
  const [receiptTypes, setReceiptTypes] = useState<string[]>([])

  const hasBlockingWarning = warnings.some((w) => w.includes('다과비 결제 시각'))
  const attendees: Attendee[] = parsedData?.참석자 ?? []
  const meetingContent: string = parsedData?.회의내용 ?? ''

  const toggleReceipt = (type: string) => {
    setReceiptTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const previewCount =
    1 +
    1 +
    (receiptTypes.includes('식비') && parsedData?.식비 ? 1 : 0) +
    (receiptTypes.includes('다과비') && parsedData?.다과비 ? 1 : 0)

  return (
    <div className="flex flex-col gap-5">

      {/* ── Warning Banner ── */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-xl leading-none mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-red-700 text-sm mb-1">감사 규정 위반 감지</p>
              {warnings.map((w, i) => (
                <p key={i} className="text-red-600 text-sm leading-relaxed">{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Missing Info Soft Warning ── */}
      {missingWarnings && missingWarnings.length > 0 && (
        <div className="mb-2 rounded-xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
          <div className="flex items-center mb-3">
            <span className="text-2xl mr-2">💡</span>
            <h3 className="text-base font-bold text-yellow-800">
              AI 보완 권장사항 <span className="font-normal text-yellow-600 text-sm">(선택)</span>
            </h3>
          </div>
          <ul className="list-disc pl-8 text-sm text-yellow-700 space-y-1.5 mb-3 font-medium">
            {missingWarnings.map((warning, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: warning }} />
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-yellow-200/60">
            <p className="text-xs text-yellow-600 font-semibold flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              위 내용은 참고용입니다. 보완하지 않고 바로 아래 [문서 생성] 버튼을 눌러도 됩니다.
            </p>
          </div>
        </div>
      )}

      {/* ── Parsed Data Preview ── */}
      {parsedData && (
        <div className="rounded-2xl border border-cb-hairline bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-cb-hairline">
            <p className="text-[10px] font-semibold text-cb-muted uppercase tracking-widest mb-0.5">Step 2</p>
            <h3 className="text-sm font-bold text-cb-ink">AI 분석 결과 미리보기</h3>
          </div>
          <div className="p-5 grid grid-cols-1 gap-3">
            {FIELD_LABELS.map(({ key, label }) => {
              const val = parsedData[key]
              if (!val) return null
              return (
                <div key={key} className="flex gap-3 text-sm">
                  <span className="w-32 shrink-0 text-cb-muted font-medium">{label}</span>
                  <span className="text-cb-ink flex-1 leading-relaxed">{String(val)}</span>
                </div>
              )
            })}

            {attendees.length > 0 && (
              <div className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 text-cb-muted font-medium">참석자</span>
                <div className="flex flex-col gap-1 flex-1">
                  {attendees.map((att, i) => (
                    <span key={i} className="text-cb-ink">
                      {att.이름} ({att.소속} / {att.직위}
                      {att.학번 && att.학번 !== '-' ? ` / ${att.학번}` : ''})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {parsedData?.background && parsedData.background.length > 0 && (
              <div className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 text-cb-muted font-medium">추진 배경</span>
                <div className="text-cb-ink flex-1 leading-relaxed flex flex-col gap-0.5">
                  {parsedData.background.map((item, i) => (
                    <span key={i}>⦁ {item}</span>
                  ))}
                </div>
              </div>
            )}

            {meetingContent && (
              <div className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 text-cb-muted font-medium">회의내용</span>
                <pre className="text-cb-ink flex-1 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {meetingContent.slice(0, 400)}
                  {meetingContent.length > 400 ? '…' : ''}
                </pre>
              </div>
            )}

            {parsedData?.future_plan && parsedData.future_plan.length > 0 && (
              <div className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 text-cb-muted font-medium">향후 계획</span>
                <div className="text-cb-ink flex-1 leading-relaxed flex flex-col gap-0.5">
                  {parsedData.future_plan.map((item, i) => (
                    <span key={i}>⦁ {item}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Document Selection ── */}
          <div className="mx-5 mb-4 rounded-xl border border-cb-hairline bg-cb-surface-soft p-4 flex flex-col gap-4">
            <div>
              <p className="text-[10px] font-semibold text-cb-muted mb-2 uppercase tracking-widest">
                문서 종류 선택 <span className="font-normal normal-case">(택 1)</span>
              </p>
              <div className="flex gap-4">
                {(['회의록', '결과보고서'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="docType"
                      value={type}
                      checked={docType === type}
                      onChange={() => setDocType(type)}
                      className="accent-cb-blue w-4 h-4 cursor-pointer"
                    />
                    <span
                      className={`text-sm font-medium transition-colors ${
                        docType === type
                          ? 'text-cb-blue'
                          : 'text-cb-ink group-hover:text-cb-blue'
                      }`}
                    >
                      {type === '회의록' ? '회의록' : '행사결과보고서'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-cb-hairline" />

            <div>
              <p className="text-[10px] font-semibold text-cb-muted mb-2 uppercase tracking-widest">
                지출 증빙 <span className="font-normal normal-case">(중복 선택 가능)</span>
              </p>
              <div className="flex gap-4">
                {[
                  { key: '식비', label: '식비 영수증', available: !!parsedData?.식비 },
                  { key: '다과비', label: '다과비 영수증', available: !!parsedData?.다과비 },
                ].map(({ key, label, available }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 ${available ? 'cursor-pointer group' : 'cursor-not-allowed opacity-40'}`}
                  >
                    <input
                      type="checkbox"
                      checked={receiptTypes.includes(key)}
                      onChange={() => available && toggleReceipt(key)}
                      disabled={!available}
                      className="accent-cb-blue w-4 h-4"
                    />
                    <span
                      className={`text-sm font-medium transition-colors ${
                        receiptTypes.includes(key)
                          ? 'text-cb-blue'
                          : 'text-cb-ink group-hover:text-cb-blue'
                      }`}
                    >
                      {label}
                      {!available && (
                        <span className="ml-1 text-xs text-cb-muted font-normal">(데이터 없음)</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-cb-muted">
              <span className="text-cb-blue">✦</span>
              <span>
                생성될 파일: 서명부, {docType === '결과보고서' ? '행사결과보고서' : '회의록'}
                {receiptTypes.includes('식비') && parsedData?.식비 ? ', 식비 영수증' : ''}
                {receiptTypes.includes('다과비') && parsedData?.다과비 ? ', 다과비 영수증' : ''}
                <span className="ml-1 font-semibold text-cb-ink">({previewCount}개)</span>
              </span>
            </div>
          </div>

          {/* ── Generate Button ── */}
          <div className="px-5 pb-5">
            <button
              onClick={() => onGenerate(docType, receiptTypes)}
              disabled={isGenerating || hasBlockingWarning}
              className={`w-full py-4 rounded-pill font-bold text-sm tracking-wide transition-all
                ${hasBlockingWarning
                  ? 'bg-cb-surface-strong text-cb-muted cursor-not-allowed'
                  : isGenerating
                  ? 'bg-cb-blue-disabled text-white cursor-not-allowed'
                  : 'bg-cb-blue hover:bg-cb-blue-active active:scale-[0.99] text-white shadow-md shadow-cb-blue/20'
                }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  문서 생성 중…
                </span>
              ) : hasBlockingWarning ? (
                '⚠ 시간 위반 — 수정 후 재시도'
              ) : (
                `HWPX 파일로 변환하기 (${previewCount}개)`
              )}
            </button>
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              <p className="font-semibold flex items-center mb-1 text-gray-700">
                <span className="mr-1">⚠️</span> 다운로드한 한글 파일이 제대로 열리지 않나요?
              </p>
              <p className="text-xs leading-relaxed text-gray-500 pl-5">
                한글 프로그램의 보안 설정 문제일 수 있습니다.<br/>
                해결 방법: 빈 한글 문서 실행 → 상단 메뉴의 <b>[보안]</b> 탭 클릭 → <b>[문서 보안 설정]</b> → <b>{'\'낮음\''}</b>으로 설정 후 프로그램 재실행
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Generated Files ── */}
      {generatedFiles.length > 0 && (
        <div className="rounded-2xl border border-cb-hairline bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-cb-hairline flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-green-600 text-[10px] font-bold">✓</span>
            </div>
            <h3 className="text-sm font-bold text-cb-ink">
              {generatedFiles.length}개 문서 생성 완료
            </h3>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {generatedFiles.map((filename) => (
              <a
                key={filename}
                href={`/api/download/${encodeURIComponent(filename)}`}
                download={filename}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cb-surface-soft border border-cb-hairline
                           hover:border-cb-blue hover:bg-cb-blue/5 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-cb-blue/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-cb-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <span className="text-sm text-cb-ink font-medium flex-1 truncate">{filename}</span>
                <span className="text-xs text-cb-blue font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  다운로드 ↓
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
