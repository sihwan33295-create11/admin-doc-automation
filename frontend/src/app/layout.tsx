import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Admin Doc AI — 행정 문서 자동화',
  description: 'AI 기반 대학 행정 문서(HWPX) 자동 생성 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white">{children}</body>
    </html>
  )
}
