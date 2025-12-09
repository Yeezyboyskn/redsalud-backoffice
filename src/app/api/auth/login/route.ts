/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/mongodb"
import { detectRoleByRut, getUserByRut } from "@/lib/mock-roles"
import { cleanRut } from "@/lib/rut"

const schema = z.object({
  rut: z.string().min(4),
  password: z.string().min(4),
})

const sanitizeRut = (s?: string | null) => (s ? s.toUpperCase().replace(/[^0-9K]/g, "") : "")
const buildRutRegex = (rutSan: string) => rutSan.split("").join("[^0-9A-Z]*")
const buildLooseRutRegex = (rutSan: string) => {
  if (!rutSan) return ".*"
  const base = rutSan.slice(0, -1)
  const dvPart = rutSan.slice(-1)
  const baseRegex = base.split("").join("[^0-9A-Z]*")
  return `${baseRegex}[^0-9A-Z]*(${dvPart}|[0-9A-Z])?`
}

const rutFilter = (rutSan: string, rawRut: string) => {
  const rawSan = sanitizeRut(rawRut)
  const loose = buildLooseRutRegex(rutSan || rawSan)
  const regexes = [
    { $regex: buildRutRegex(rutSan), $options: "i" },
    { $regex: buildRutRegex(rawSan), $options: "i" },
    { $regex: loose, $options: "i" },
  ]
  const or: any[] = [
    { rut: rutSan },
    { rut_clean: rutSan },
    { rut: rawSan },
    { rut_clean: rawSan },
  ]
  regexes.forEach((r) => {
    or.push({ rut: r })
    or.push({ rut_clean: r })
  })
  return {
    $or: or,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: "Payload invalido" }, { status: 400 })
  const rutSan = sanitizeRut(parsed.data.rut)
  const password = parsed.data.password

  const generic = process.env.NEXT_PUBLIC_DOCTOR_PASSWORD || "doctor123"
  const rawRut = parsed.data.rut

  // 1) Buscar en BD real: doctors primero (profesionales)
  try {
    const db = await getDb()
    const doctor = await db.collection("doctors").findOne(rutFilter(rutSan, rawRut))
    if (doctor) {
      if (password !== generic) return NextResponse.json({ message: "Contrasena incorrecta" }, { status: 401 })
      // upsert en users para futuras autenticaciones unificadas
      await db.collection("users").updateOne({ rut: rutSan }, { $set: { rut: rutSan, role: "doctor", name: doctor.nombre ?? "" } }, { upsert: true })
      const res = NextResponse.json({ role: "doctor" })
      res.cookies.set("rut", rutSan, { path: "/" })
      res.cookies.set("role", "doctor", { path: "/" })
      return res
    }
    // 2) Buscar usuarios operativos (agendamiento/jefatura/admin) en coleccion users, usando password generica tambien
    const user = await db.collection("users").findOne(rutFilter(rutSan, rawRut))
    if (user) {
      if (password !== generic && user.password && user.password !== password) {
        return NextResponse.json({ message: "Contrasena incorrecta" }, { status: 401 })
      }
      const role = user.role ?? "agendamiento"
      const res = NextResponse.json({ role })
      res.cookies.set("rut", rutSan, { path: "/" })
      res.cookies.set("role", role, { path: "/" })
      return res
    }
  } catch (e) {
    // log? omitimos para evitar filtrar errores
  }

  // 3) Fallback a mock (si esta habilitado) o al dataset local, siempre aceptando la clave generica
  const mockUser = getUserByRut(parsed.data.rut)
  const mockRole = detectRoleByRut(parsed.data.rut)
  const mockEnabled = process.env.MOCK_DB === "true"
  if (mockUser && (mockEnabled || password === generic || !process.env.MOCK_DB_FALLBACK || process.env.MOCK_DB_FALLBACK === "true")) {
    if (!mockUser.password || mockUser.password === password || password === generic) {
      const role = mockRole ?? mockUser.role
      const res = NextResponse.json({ role })
      res.cookies.set("rut", cleanRut(parsed.data.rut), { path: "/" })
      res.cookies.set("role", role, { path: "/" })
      return res
    }
  }

  // 4) Ultimo recurso: si la clave es la generica y no encontramos registro, crear usuario doctor temporal
  if (password === generic) {
    try {
      const db = await getDb()
      await db.collection("users").updateOne({ rut: rutSan }, { $set: { rut: rutSan, role: "doctor", name: "" } }, { upsert: true })
    } catch {}
    const res = NextResponse.json({ role: "doctor" })
    res.cookies.set("rut", rutSan, { path: "/" })
    res.cookies.set("role", "doctor", { path: "/" })
    return res
  }

  return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
}
