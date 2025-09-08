import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '../components/error-boundary'

export const metadata: Metadata = {
  title: 'KBL Bites Kitchen Dashboard',
  description: 'Kitchen order management system for KBL Bites',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
