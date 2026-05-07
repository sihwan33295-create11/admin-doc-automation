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
  참석자?: Attendee[]
  [key: string]: unknown
}

interface ResultPanelProps {
  parsedData: ParsedData | null
  warnings: string[]
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

      {/* ── Parsed Data Preview ── */}
      {parsedData && (
        <div className="rounded-2xl border border-cb-hairline bg-cb-canvas overflow-hidden">
          <div className="px-5 py-3 border-b border-cb-hairline bg-cb-surface-soft">
            <h3 className="text-sm font-semibold text-cb-ink">AI 파싱 결과 미리보기</h3>
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

            {meetingContent && (
              <div className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 text-cb-muted font-medium">회의내용</span>
                <pre className="text-cb-ink flex-1 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {meetingContent.slice(0, 400)}
                  {meetingContent.length > 400 ? '…' : ''}
                </pre>
              </div>
            )}
          </div>

          {/* ── Document Selection ── */}
          <div className="mx-5 mb-4 rounded-xl border border-cb-hairline bg-cb-surface-soft p-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-cb-ink mb-2 uppercase tracking-wide">
                문서 종류 선택 <span className="text-cb-muted font-normal normal-case">(택 1)</span>
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
              <p className="text-xs font-semibold text-cb-ink mb-2 uppercase tracking-wide">
                지출 증빙 <span className="text-cb-muted font-normal normal-case">(중복 선택 가능)</span>
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
                생성될 파일: 참석자명단, {docType === '결과보고서' ? '행사결과보고서' : '회의록'}
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
              className={`w-full py-3.5 rounded-pill font-semibold text-sm transition-all
                ${hasBlockingWarning
                  ? 'bg-cb-surface-strong text-cb-muted cursor-not-allowed'
                  : isGenerating
                  ? 'bg-cb-blue-disabled text-cb-on-dark cursor-not-allowed'
                  : 'bg-cb-blue hover:bg-cb-blue-active active:bg-cb-blue-active text-cb-on-dark shadow-sm'
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
          </div>
        </div>
      )}

      {/* ── Generated Files ── */}
      {generatedFiles.length > 0 && (
        <div className="rounded-2xl border border-cb-hairline bg-cb-surface-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-cb-hairline">
            <h3 className="text-sm font-semibold text-cb-ink">
              ✓ {generatedFiles.length}개 문서 생성 완료
            </h3>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {generatedFiles.map((filename) => (
              <a
                key={filename}
                href={`/api/download/${encodeURIComponent(filename)}`}
                download={filename}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cb-canvas border border-cb-hairline
                           hover:border-cb-blue hover:bg-blue-50/30 transition-colors group"
              >
                <span className="text-lg">📄</span>
                <span className="text-sm text-cb-ink font-medium flex-1">{filename}</span>
                <span className="text-xs text-cb-blue font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
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
