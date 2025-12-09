/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireRole(req, ["admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const id = Number(params.id)
  if (Number.isNaN(id)) return NextResponse.json({ message: "ID inválido" }, { status: 400 })
  const res = await db.collection("boxes").deleteOne({ id })
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "delete", entity: "boxes", entityId: params.id, details: {} })
  return NextResponse.json({ removed: res.deletedCount === 1 })
}

