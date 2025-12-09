/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { bloqueoOperativoSchema } from "@/lib/validators"
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
  const boxId = url.searchParams.get("boxId")
  const fecha = url.searchParams.get("fecha")
  const estado = url.searchParams.get("estado")
  const filter: any = {}
  if (boxId) filter.boxId = isNaN(Number(boxId)) ? boxId : Number(boxId)
  if (fecha) filter.fecha = fecha
  if (estado) filter.estado = estado
  const items = await db.collection("operational_blocks").find(filter).sort({ fecha: 1, inicio: 1 }).toArray()
  return NextResponse.json(items.map((b: any) => ({ id: String(b._id), ...b })))
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ["agendamiento", "admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  const parsed = bloqueoOperativoSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: "payload invalido", issues: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data
  const doc: any = { ...data, estado: "pendiente", createdAt: new Date().toISOString() }
  const res = await db.collection("operational_blocks").insertOne(doc)
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "create", entity: "operational_blocks", entityId: String(res.insertedId), details: data })
  return NextResponse.json({ id: String(res.insertedId), ...data, estado: doc.estado }, { status: 201 })
}
