import { cleanRut } from "./rut"

export type Role = "doctor" | "agendamiento" | "jefatura" | "admin"

export type MockUser = {
  rut: string
  role: Role
  password?: string
  name?: string
  email?: string
}

const GENERIC_PASSWORD = process.env.NEXT_PUBLIC_DOCTOR_PASSWORD || "doctor123"

export const MOCK_USERS: MockUser[] = [
  // Agendamiento
  { rut: "22.222.222-2", role: "agendamiento", password: GENERIC_PASSWORD, name: "Equipo Agendamiento" },
  { rut: "9.999.999-9", role: "agendamiento", password: GENERIC_PASSWORD, name: "Nicolas Aravena", email: "nicolas.aravena@redsalud.cl" },
  { rut: "8.888.888-8", role: "agendamiento", password: GENERIC_PASSWORD, name: "Ruben Santander", email: "ruben.santander@redsalud.cl" },
  // Jefatura
  { rut: "33.333.333-3", role: "jefatura", password: GENERIC_PASSWORD, name: "Jefatura" },
  { rut: "16.499.437-6", role: "jefatura", password: GENERIC_PASSWORD, name: "Monica Andrea Baeza Guerra", email: "monica.baeza@redsalud.cl" },
  { rut: "20.538.048-5", role: "jefatura", password: GENERIC_PASSWORD, name: "Oscar Farias Baeza", email: "oscar.farias.ext@redsalud.com" },
  // Admin
  { rut: "44.444.444-4", role: "admin", password: GENERIC_PASSWORD, name: "Administrador" },
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
