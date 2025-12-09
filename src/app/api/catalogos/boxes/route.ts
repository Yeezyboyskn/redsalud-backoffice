/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"
import { boxSchema } from "@/lib/validators"
import { logAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["admin", "agendamiento", "jefatura"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const items = await db.collection("boxes").find({}).sort({ id: 1 }).toArray()
  return NextResponse.json(items.map((b: any) => ({ id: b.id ?? b.codigo ?? Number(b._id), piso: b.piso, especialidad: b.especialidad, estado: b.estado })))
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
  if (!parsed.success) return NextResponse.json({ message: "payload inválido", issues: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data
  const doc: any = { ...data, createdAt: new Date().toISOString() }
  const res = await db.collection("boxes").insertOne(doc)
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "create", entity: "boxes", entityId: String(res.insertedId), details: data })
  return NextResponse.json({ id: data.id, ...data }, { status: 201 })
}

