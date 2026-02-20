import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Till-FC',
  description: 'Fußballspiel für Till',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}