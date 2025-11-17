import { cleanRut } from "./rut"

export type Role = "doctor" | "agendamiento" | "jefatura" | "admin"

export type MockUser = {
  rut: string
  role: Role
  password?: string
  name?: string
}

export const MOCK_USERS: MockUser[] = [
  // Para roles distintos a doctor mantenemos credenciales de prueba
  { rut: "22.222.222-2", role: "agendamiento", password: "agenda123", name: "Equipo Agendamiento" },
  { rut: "33.333.333-3", role: "jefatura", password: "jefatura123", name: "Jefatura" },
  { rut: "44.444.444-4", role: "admin", password: "admin123", name: "Administrador" },
]

const map = new Map(MOCK_USERS.map((u) => [cleanRut(u.rut), u]))

export function getUserByRut(rut: string) {
  return map.get(cleanRut(rut)) || null
}

export function detectRoleByRut(rut: string) {
  return getUserByRut(rut)?.role ?? null
}

export function roleHomePath(role: Role) {
  if (role === "doctor") return "/doctor-v2"
  if (role === "agendamiento") return "/agendamiento"
  if (role === "jefatura") return "/jefatura"
  return "/admin"
}
