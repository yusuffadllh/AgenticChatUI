import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Neon Veil | 3D Portfolio',
  description: 'Fullstack developer portfolio with interactive 3D experience',
  keywords: 'portfolio, 3D, Three.js, React, Next.js, developer',
  openGraph: {
    title: 'Neon Veil',
    description: 'Interactive 3D portfolio showcasing Kotlin, Python, TypeScript projects',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className="bg-[#0A0A0A] text-white font-sans">
        {children}
      </body>
    </html>
  )
}