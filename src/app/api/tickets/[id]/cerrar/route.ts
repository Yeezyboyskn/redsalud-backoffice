/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { logAudit } from "@/lib/audit"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  const _id = new ObjectId(params.id)
  const res = await db.collection("tickets").findOneAndUpdate({ _id }, { $set: { estado: "cerrado", closedAt: new Date().toISOString() } }, { returnDocument: "after" })
  if (!res.value) return NextResponse.json({ message: "no encontrado" }, { status: 404 })
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "change_status", entity: "tickets", entityId: params.id, details: { estado: "cerrado" } })
  return NextResponse.json({ id: params.id, estado: "cerrado" })
}
