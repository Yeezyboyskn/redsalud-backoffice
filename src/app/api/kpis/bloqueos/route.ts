/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"
import { minutesBetween } from "@/lib/time"

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
  const bloques = await db.collection("block_requests").find({ fecha: { $gte: from, $lte: to } }).toArray()
  const byMotivo = new Map<string, number>()
  for (const b of bloques) {
    const minutos = minutesBetween(b.inicio, b.fin)
    byMotivo.set(b.motivo, (byMotivo.get(b.motivo) ?? 0) + minutos)
  }
  const total = Array.from(byMotivo.values()).reduce((a, b) => a + b, 0)
  const items = Array.from(byMotivo.entries()).map(([motivo, minutos]) => ({
    motivo,
    minutos,
    porcentaje: total === 0 ? 0 : Math.round((minutos / total) * 100),
  }))
  return NextResponse.json({ total, items })
}
