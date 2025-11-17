"use client"
import ThemeToggle from "./ThemeToggle"
import LogoutButton from "./LogoutButton"

export default function Topbar() {
  return (
    <header className="sticky top-0 z-40 h-20 bg-gradient-to-r from-primary via-[#00b7ae] to-[#009389] text-primary-foreground shadow-[0_18px_40px_-24px_rgba(0,78,82,0.65)]">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-6">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary-foreground/80">
            RedSalud
          </span>
          <span className="text-2xl font-semibold">Rematador de box</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}



