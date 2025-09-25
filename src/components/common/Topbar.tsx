"use client"
import ThemeToggle from "./ThemeToggle"
import LogoutButton from "./LogoutButton"

export default function Topbar() {
  return (
    <header className="h-12 border-b bg-background">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="font-semibold">RedSalud Backoffice</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
