"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  { href: "/doctor", label: "Doctor" },
  { href: "/agendamiento", label: "Agendamiento" },
  { href: "/jefatura", label: "Jefatura" },
  { href: "/admin", label: "Admin" },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="hidden md:flex w-64 min-h-dvh bg-gradient-to-b from-sidebar via-white to-[#eef7f7] border-r border-sidebar-border/70 shadow-[8px_0_24px_-12px_rgba(0,78,82,0.25)] sticky top-0">
      <div className="flex flex-1 flex-col">
        <div className="px-5 pt-7 pb-5 border-b border-sidebar-border/80">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary text-lg font-semibold shadow-inner shadow-primary/10">
              RS
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-primary">RedSalud</p>
              <p className="text-sm font-semibold text-sidebar-foreground/90">Backoffice</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {items.map((item) => {
            const active = path === item.href || path.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`size-2 rounded-full transition-all ${
                    active ? "scale-110 bg-primary-foreground" : "bg-transparent group-hover:bg-sidebar-accent-foreground/60"
                  }`}
                />
              </Link>
            )
          })}
        </nav>
        <div className="px-5 pb-6 text-xs text-muted-foreground/80">
          <p className="font-semibold uppercase tracking-wide text-secondary/80">Comprometidos con las personas</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Gestion agil y humana para apoyar a cada centro de RedSalud.
          </p>
        </div>
      </div>
    </aside>
  )
}





