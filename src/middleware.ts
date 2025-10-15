import { NextResponse, NextRequest } from "next/server"

type Role = "doctor" | "agendamiento" | "jefatura" | "admin"

type AccessControlList = Record<string, Role[]>

const ACL: AccessControlList = {
  "/doctor": ["doctor", "admin"],
  "/agendamiento": ["agendamiento", "admin"],
  "/jefatura": ["jefatura", "admin"],
  "/admin": ["admin"],
}

const allowedRoles = new Set<Role>(Object.values(ACL).flat() as Role[])

const isRole = (value: string | undefined): value is Role => Boolean(value && allowedRoles.has(value as Role))

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const cookieRole = req.cookies.get("role")?.value
  const role = isRole(cookieRole) ? cookieRole : undefined

  if (pathname === "/") {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  for (const base of Object.keys(ACL)) {
    if (pathname.startsWith(base)) {
      const permittedRoles = ACL[base]
      if (!role || !permittedRoles.includes(role)) {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/doctor/:path*", "/agendamiento/:path*", "/jefatura/:path*", "/admin/:path*"],
}
