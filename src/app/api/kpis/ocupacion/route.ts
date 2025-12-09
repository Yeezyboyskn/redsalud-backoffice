/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { minutesBetween } from "@/lib/time"
import { requireRole } from "@/lib/auth"

const parseDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null)
const toISO = (d: Date) => d.toISOString().slice(0, 10)

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["jefatura", "admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const from = url.searchParams.get("from") || "2025-01-01"
  const to = url.searchParams.get("to") || "2025-12-31"

  const weekly = await db.collection("weekly_slots_import").find({}).toArray()
  const bloques = await db
    .collection("block_requests")
    .find({ fecha: { $gte: from, $lte: to }, estado: { $in: ["pendiente", "aprobado"] } })
    .toArray()

  const capacidadPorPiso = new Map<number, number>()
  for (const w of weekly) {
    const minutos = minutesBetween(w.inicio, w.fin)
    const piso = Number(w.piso ?? Math.floor((Number(w.box) || 0) / 100)) || 0
    capacidadPorPiso.set(piso, (capacidadPorPiso.get(piso) ?? 0) + minutos)
  }

  const bloqueadoPorPiso = new Map<number, number>()
  for (const b of bloques) {
    const piso = Number(b.piso ?? Math.floor((Number(b.boxId) || 0) / 100)) || 0
    const minutos = minutesBetween(b.inicio, b.fin)
    bloqueadoPorPiso.set(piso, (bloqueadoPorPiso.get(piso) ?? 0) + minutos)
  }

  const result = Array.from(capacidadPorPiso.entries()).map(([piso, capacidad]) => {
    const bloqueado = bloqueadoPorPiso.get(piso) ?? 0
    const disponible = Math.max(capacidad - bloqueado, 0)
    const ocupacion = capacidad === 0 ? 0 : Math.round((disponible / capacidad) * 100)
    return { piso, ocupacion }
  })

  return NextResponse.json(result)
}
