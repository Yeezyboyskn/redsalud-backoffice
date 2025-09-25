import type { Metadata } from "next"
import { Nunito, Open_Sans } from "next/font/google"
import "./globals.css"
import Providers from "@/lib/providers"

const headingFont = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-brand-heading", display: "swap" })
const bodyFont = Open_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-brand-body", display: "swap" })

export const metadata: Metadata = { title: "RedSalud Backoffice", description: "Prototipo UI" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${headingFont.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}


