"use client"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import { usePathname } from "next/navigation"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = Boolean(pathname && pathname.startsWith("/admin"))
  return (
    <div className="flex min-h-screen">
      {showSidebar ? <Sidebar /> : null}
      <div className="flex-1 min-w-0 bg-transparent">
        <Topbar />
        <main className="px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

