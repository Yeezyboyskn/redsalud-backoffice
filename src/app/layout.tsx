import type { Metadata } from "next"
import "./globals.css"
import Providers from "@/lib/providers"
export const metadata: Metadata = { title: "RedSalud Backoffice", description: "Prototipo UI" }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
