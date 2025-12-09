/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireRole(req, ["admin", "agendamiento"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  const update: any = {}
  for (const key of ["estado", "especialidad", "piso"]) {
    if (key in body) update[key] = body[key]
  }
  const query = ObjectId.isValid(params.id) ? { _id: new ObjectId(params.id) } : { id: params.id }
  const res = await db.collection("boxes").findOneAndUpdate(query, { $set: update }, { returnDocument: "after" })
  if (!res.value) return NextResponse.json({ message: "no encontrado" }, { status: 404 })
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "update", entity: "boxes", entityId: params.id, details: update })
  return NextResponse.json(res.value)
}
