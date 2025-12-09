"use client"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

function getCookie(name: string) {
  if (typeof document === "undefined") return ""
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return m ? decodeURIComponent(m[2]) : ""
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    setRole(getCookie("role") || null)
  }, [])

  // Solo mostrar sidebar si el usuario es admin
  const showSidebar = Boolean(pathname && !pathname.startsWith("/login") && pathname !== "/" && role === "admin")
  
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

