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
    <aside className="w-56 border-r h-dvh p-3 sticky top-0">
      <h2 className="font-semibold mb-3">RedSalud</h2>
      <nav className="space-y-1">
        {items.map(i=>(
          <Link key={i.href} href={i.href}
            className={`block rounded px-3 py-2 text-sm ${path.startsWith(i.href)?"bg-muted font-medium":"hover:bg-muted"}`}>
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
