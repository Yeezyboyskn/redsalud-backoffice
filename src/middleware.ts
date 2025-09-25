import { NextResponse, NextRequest } from "next/server"

const ACL: Record<string, Array<"doctor"|"agendamiento"|"jefatura"|"admin">> = {
  "/doctor": ["doctor","admin"],
  "/agendamiento": ["agendamiento","admin"],
  "/jefatura": ["jefatura","admin"],
  "/admin": ["admin"],
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const role = req.cookies.get("role")?.value

  // redirigir home -> /login
  if (pathname === "/") {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // proteger secciones
  for (const base of Object.keys(ACL)) {
    if (pathname.startsWith(base)) {
      if (!role || !ACL[base].includes(role as any)) {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/","/doctor/:path*","/agendamiento/:path*","/jefatura/:path*","/admin/:path*"],
}
