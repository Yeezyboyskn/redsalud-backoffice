/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { boxSchema } from "@/lib/validators"
import { requireRole } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["agendamiento", "admin", "jefatura"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const estado = url.searchParams.get("estado")
  const especialidad = url.searchParams.get("especialidad")
  const piso = url.searchParams.get("piso")
  const filter: any = {}
  if (estado) filter.estado = estado
  if (especialidad) filter.especialidad = especialidad
  if (piso) filter.piso = Number(piso)
  const items = await db.collection("boxes").find(filter).limit(500).toArray()
  return NextResponse.json(items.map((b: any) => ({ id: b.id ?? b.codigo ?? b._id, ...b })))
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ["admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  const parsed = boxSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: "payload invalido", issues: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data
  const doc: any = { ...data, createdAt: new Date().toISOString() }
  const res = await db.collection("boxes").insertOne(doc)
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "create", entity: "boxes", entityId: String(res.insertedId), details: data })
  return NextResponse.json({ id: String(res.insertedId), ...data }, { status: 201 })
}
