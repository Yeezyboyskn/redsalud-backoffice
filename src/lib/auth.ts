import { NextRequest, NextResponse } from "next/server"

export type Session = { rut: string; role: "doctor" | "agendamiento" | "jefatura" | "admin" | null }

export function getSession(req: NextRequest): Session {
  const rut = req.cookies.get("rut")?.value || ""
  const role = (req.cookies.get("role")?.value as Session["role"]) || null
  return { rut, role }
}

export function requireRole(req: NextRequest, roles: Session["role"][]): Session {
  const session = getSession(req)
  if (!session.rut || !session.role || !roles.includes(session.role)) {
    throw NextResponse.json({ message: "No autorizado" }, { status: 401 })
  }
  return session
}
