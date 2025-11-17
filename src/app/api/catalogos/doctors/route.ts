import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function GET(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const especialidad = url.searchParams.get("especialidad")?.trim()
  const pisoStr = url.searchParams.get("piso")?.trim()
  const boxStr = url.searchParams.get("box")?.trim()
  const rut = url.searchParams.get("rut")?.trim()
  const q = url.searchParams.get("q")?.trim()

  const where: any = {}
  if (especialidad) where.especialidad = especialidad
  if (pisoStr) where.pisos = Number.isFinite(Number(pisoStr)) ? Number(pisoStr) : pisoStr
  if (boxStr) where.boxes = Number.isFinite(Number(boxStr)) ? String(Number(boxStr)) : String(boxStr)
  if (rut) where.rut = rut
  if (q) where.nombre = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }

  const items = await db
    .collection("doctors")
    .find(where, { projection: { _id: 0 } })
    .sort({ nombre: 1 })
    .limit(500)
    .toArray()

  return NextResponse.json({ items })
}
