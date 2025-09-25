import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const roleRoot = { doctor:"/doctor", agendamiento:"/agendamiento", jefatura:"/jefatura", admin:"/admin" } as const

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname
  if (p === "/mockServiceWorker.js") return NextResponse.next()
  if (p === "/") return NextResponse.redirect(new URL("/login", req.url))
  if (p.startsWith("/login")) return NextResponse.next()

  const role = req.cookies.get("role")?.value as keyof typeof roleRoot | undefined
  if (!role) return NextResponse.redirect(new URL("/login", req.url))

  const expected = roleRoot[role]
  if (["/doctor","/agendamiento","/jefatura","/admin"].some(r=>p.startsWith(r)) && !p.startsWith(expected)) {
    return NextResponse.redirect(new URL(expected, req.url))
  }
  return NextResponse.next()
}
export const config = { matcher: ["/((?!_next|static|favicon.ico|mockServiceWorker\\.js).*)"] }
